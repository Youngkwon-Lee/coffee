"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";

type BeanDoc = {
  id: string;
  name?: string;
  brand?: string;
  price?: string | number;
  origin?: string;
  region?: string;
  producer?: string;
  process?: string;
  processing?: string;
  flavor_notes?: string;
  tasting_notes?: string;
  flavor?: string | string[];
  image?: string;
  imageUrl?: string;
  img?: string;
  thumbnail?: string;
  link?: string;
  url?: string;
  product_url?: string;
  updatedAt?: Timestamp | string | Date;
  createdAt?: Timestamp | string | Date;
  isActive?: boolean;
  isSample?: boolean;
};

type BrandStat = {
  brand: string;
  total: number;
  active: number;
  latest: Date | null;
};

const fallbackImg =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop&crop=center";

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

const pickText = (...vals: Array<unknown>) => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "-";
};

export default function CrawlMonitorClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beans, setBeans] = useState<BeanDoc[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hideSamples, setHideSamples] = useState(true);

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

  const filteredBeans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beans.filter((bean) => {
      if (hideSamples && bean.isSample) return false;
      if (selectedBrand !== "all" && (bean.brand || "unknown") !== selectedBrand) return false;
      if (!q) return true;

      const hay = [bean.name, bean.brand, bean.origin, bean.process, bean.flavor_notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [beans, search, selectedBrand, hideSamples]);

  return (
    <div className="p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-coffee-light">크롤링 모니터</h1>
        <p className="text-sm text-coffee-light opacity-70 mt-1">Firestore beans 기준 수집 현황 + 상세 원두 목록</p>
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
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-200 text-sm mb-4">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-coffee-medium rounded-xl border border-coffee-gold border-opacity-10 overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-coffee-gold border-opacity-10 text-sm opacity-80">카페별 최신 상태</div>
            <div className="divide-y divide-coffee-gold divide-opacity-10">
              {stats.map((item) => (
                <button
                  key={item.brand}
                  type="button"
                  onClick={() => setSelectedBrand(item.brand)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-coffee-dark/30 transition ${
                    selectedBrand === item.brand ? "bg-coffee-dark/40" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-coffee-light">{item.brand}</div>
                    <div className="text-xs opacity-70">최근 업데이트: {formatDateTime(item.latest)}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>전체 {item.total}</div>
                    <div className="opacity-70">활성 {item.active}</div>
                  </div>
                </button>
              ))}
              {stats.length === 0 && <div className="px-4 py-8 text-center text-sm opacity-70">표시할 데이터가 없습니다.</div>}
            </div>
          </div>

          <div className="bg-coffee-medium rounded-xl border border-coffee-gold border-opacity-10 p-3 mb-4 flex flex-col md:flex-row gap-3">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-coffee-dark border border-coffee-gold border-opacity-20 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">전체 카페</option>
              {stats.map((s) => (
                <option key={s.brand} value={s.brand}>
                  {s.brand}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="원두명/원산지/프로세스 검색"
              className="flex-1 bg-coffee-dark border border-coffee-gold border-opacity-20 rounded-lg px-3 py-2 text-sm"
            />
            <label className="px-3 py-2 rounded-lg bg-coffee-dark border border-coffee-gold border-opacity-20 text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={hideSamples}
                onChange={(e) => setHideSamples(e.target.checked)}
              />
              샘플 숨기기
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedBrand("all");
                setSearch("");
                setHideSamples(true);
              }}
              className="px-3 py-2 rounded-lg bg-coffee-dark border border-coffee-gold border-opacity-20 text-sm"
            >
              초기화
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredBeans.map((bean) => {
              const updated = toDate(bean.updatedAt) || toDate(bean.createdAt);
              const imgSrc = pickText(bean.image, bean.imageUrl, bean.img, bean.thumbnail, fallbackImg);
              const originText = pickText(bean.origin, bean.region, bean.producer);
              const processText = pickText(bean.process, bean.processing);
              const noteText = Array.isArray(bean.flavor)
                ? bean.flavor.join(", ")
                : pickText(bean.flavor_notes, bean.tasting_notes, bean.flavor);
              const sourceLink = pickText(bean.link, bean.url, bean.product_url);

              return (
                <div key={bean.id} className="bg-coffee-medium rounded-xl p-3 border border-coffee-gold border-opacity-10">
                  <div className="flex gap-3">
                    <img
                      src={imgSrc}
                      alt={bean.name || "bean"}
                      className="w-20 h-20 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackImg;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-2">
                        <span>{bean.name || "(이름 없음)"}</span>
                        {bean.isSample && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-700/40 border border-yellow-500/40 text-yellow-200">
                            SAMPLE
                          </span>
                        )}
                      </div>
                      <div className="text-xs opacity-70 truncate">{bean.brand || "unknown"}</div>
                      <div className="text-xs mt-1">가격: {bean.price ?? "-"}</div>
                      <div className="text-xs opacity-80 truncate">원산지: {originText}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-80">프로세스: {processText}</div>
                  <div className="mt-1 text-xs opacity-70 line-clamp-2">노트: {noteText}</div>
                  <div className="mt-2 text-[11px] opacity-60">업데이트: {formatDateTime(updated)}</div>
                  {sourceLink !== "-" && (
                    <a href={sourceLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-coffee-gold underline">
                      원문 보기
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {filteredBeans.length === 0 && <div className="text-center text-sm opacity-70 py-10">조건에 맞는 원두가 없습니다.</div>}
        </>
      )}
    </div>
  );
}
