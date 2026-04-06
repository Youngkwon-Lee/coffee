"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";

type BeanDoc = {
  id: string;
  name?: string;
  brand?: string;
  updatedAt?: Timestamp | string | Date;
  createdAt?: Timestamp | string | Date;
  isActive?: boolean;
};

type BrandStat = {
  brand: string;
  total: number;
  active: number;
  latest: Date | null;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDateTime = (value: Date | null) => {
  if (!value) return "-";
  return value.toLocaleString("ko-KR", { hour12: false });
};

export default function CrawlMonitorClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beans, setBeans] = useState<BeanDoc[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const beansRef = collection(db, "beans");

        const [countSnap, recentSnap] = await Promise.all([
          getCountFromServer(beansRef),
          getDocs(query(beansRef, orderBy("updatedAt", "desc"), limit(500))),
        ]);

        setTotalCount(countSnap.data().count);
        setBeans(
          recentSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<BeanDoc, "id">),
          }))
        );
      } catch (e) {
        console.error(e);
        setError("크롤링 모니터 데이터를 불러오지 못했습니다. Firebase 인덱스/권한 설정을 확인해주세요.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, BrandStat>();
    for (const bean of beans) {
      const brand = bean.brand || "unknown";
      const updated = toDate(bean.updatedAt) || toDate(bean.createdAt);
      const isActive = bean.isActive !== false;

      if (!map.has(brand)) {
        map.set(brand, { brand, total: 0, active: 0, latest: updated });
      }

      const cur = map.get(brand)!;
      cur.total += 1;
      if (isActive) cur.active += 1;
      if (updated && (!cur.latest || updated > cur.latest)) {
        cur.latest = updated;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const at = a.latest?.getTime() ?? 0;
      const bt = b.latest?.getTime() ?? 0;
      return bt - at;
    });
  }, [beans]);

  const latestUpdate = useMemo(() => {
    if (stats.length === 0) return null;
    return stats[0].latest;
  }, [stats]);

  return (
    <div className="p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-coffee-light">크롤링 모니터</h1>
        <p className="text-sm text-coffee-light opacity-70 mt-1">
          Firestore beans 컬렉션 기준 최근 크롤링 상태
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-coffee-medium rounded-xl p-4 border border-coffee-gold border-opacity-10">
          <div className="text-xs opacity-70">전체 원두(서버 카운트)</div>
          <div className="text-2xl font-semibold mt-1">{totalCount ?? "-"}</div>
        </div>
        <div className="bg-coffee-medium rounded-xl p-4 border border-coffee-gold border-opacity-10">
          <div className="text-xs opacity-70">최근 분석 범위</div>
          <div className="text-2xl font-semibold mt-1">{beans.length}</div>
        </div>
        <div className="bg-coffee-medium rounded-xl p-4 border border-coffee-gold border-opacity-10">
          <div className="text-xs opacity-70">가장 최근 업데이트</div>
          <div className="text-sm font-medium mt-1">{formatDateTime(latestUpdate)}</div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[180px]">
          <div className="loading-spinner w-8 h-8 rounded-full" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-200 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-coffee-medium rounded-xl border border-coffee-gold border-opacity-10 overflow-hidden">
          <div className="px-4 py-3 border-b border-coffee-gold border-opacity-10 text-sm opacity-80">
            카페별 최신 상태
          </div>
          <div className="divide-y divide-coffee-gold divide-opacity-10">
            {stats.map((item) => (
              <div key={item.brand} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-coffee-light">{item.brand}</div>
                  <div className="text-xs opacity-70">최근 업데이트: {formatDateTime(item.latest)}</div>
                </div>
                <div className="text-right text-sm">
                  <div>전체 {item.total}</div>
                  <div className="opacity-70">활성 {item.active}</div>
                </div>
              </div>
            ))}
            {stats.length === 0 && (
              <div className="px-4 py-8 text-center text-sm opacity-70">표시할 데이터가 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
