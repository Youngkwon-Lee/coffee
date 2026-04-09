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
  acidity?: number;
  body?: number;
  sweetness?: number;
  overall?: number;
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

type WorkflowRun = {
  id: number;
  name?: string;
  status: string;
  conclusion: string | null;
  run_number: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch?: string;
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

const formatApiDateTime = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("ko-KR", { hour12: false });
};

const pickText = (...vals: Array<unknown>) => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "-";
};

const fmtRunStatus = (status: string, conclusion: string | null) => {
  const s = status.toLowerCase();
  const c = (conclusion || "").toLowerCase();
  if (s === "completed") {
    if (c === "success") return { text: "성공", tone: "text-green-300" };
    if (c === "failure") return { text: "실패", tone: "text-red-300" };
    if (c === "cancelled") return { text: "취소", tone: "text-yellow-300" };
    return { text: c || "완료", tone: "text-blue-300" };
  }
  if (s === "in_progress") return { text: "진행중", tone: "text-cyan-300" };
  if (s === "queued") return { text: "대기", tone: "text-yellow-300" };
  return { text: s, tone: "text-white/70" };
};

export default function CrawlMonitorClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beans, setBeans] = useState<BeanDoc[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hideSamples, setHideSamples] = useState(true);

  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowLoadError, setWorkflowLoadError] = useState<string | null>(null);

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

    const loadWorkflowRuns = async () => {
      try {
        const res = await fetch(
          "https://api.github.com/repos/Youngkwon-Lee/coffee/actions/workflows/coffee_crawler.yml/runs?per_page=8",
          {
            headers: {
              Accept: "application/vnd.github+json",
            },
          }
        );
        if (!res.ok) {
          setWorkflowLoadError(`GitHub Actions 실행 이력 호출 실패 (${res.status})`);
          return;
        }

        const data = await res.json();
        const rows = (data?.workflow_runs || []) as Array<{
          id: number;
          name?: string;
          status: string;
          conclusion: string | null;
          run_number: number;
          html_url: string;
          created_at: string;
          updated_at: string;
          head_branch?: string;
        }>;

        setWorkflowRuns(
          rows
            .filter((r) => !!r?.id)
            .map((r) => ({
              id: r.id,
              name: r.name,
              status: r.status,
              conclusion: r.conclusion,
              run_number: r.run_number,
              html_url: r.html_url,
              created_at: r.created_at,
              updated_at: r.updated_at,
              head_branch: r.head_branch,
            }))
        );
      } catch (e) {
        console.error(e);
        setWorkflowLoadError("GitHub Actions 실행 이력 네트워크 오류");
      }
    };

    load();
    loadWorkflowRuns();
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

  const hasRuns = workflowRuns.length > 0;

  return (
    <div className="p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-coffee-light">크롤링 모니터</h1>
        <p className="text-sm text-coffee-light opacity-70 mt-1">Firestore beans 기준 수집 현황 + 실행 run 로그(공개 GitHub Actions)</p>
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

      <div className="bg-coffee-medium rounded-xl border border-coffee-gold border-opacity-10 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-coffee-gold border-opacity-10 text-sm opacity-80">최근 GitHub Actions 실행 로그</div>
        {workflowLoadError && <div className="px-4 py-3 text-sm text-red-300">{workflowLoadError}</div>}
        <div className="divide-y divide-coffee-gold divide-opacity-10">
          {!hasRuns && !workflowLoadError && (
            <div className="px-4 py-6 text-sm opacity-70">실행 로그를 불러오지 못했거나 아직 이력이 없습니다.</div>
          )}
          {workflowRuns.slice(0, 6).map((run) => {
            const badge = fmtRunStatus(run.status, run.conclusion);
            return (
              <div key={run.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-coffee-light">{run.name || `coffee_crawler #${run.run_number}`}</div>
                  <div className="text-xs opacity-70">ID: {run.id}</div>
                  <div className="text-xs opacity-70">branch: {run.head_branch || "-"}</div>
                </div>
                <div className="text-xs md:text-right opacity-80">
                  <div className={`${badge.tone} font-semibold`}>상태: {badge.text} ({run.status})</div>
                  <div>시작: {formatApiDateTime(run.created_at)}</div>
                  <div>업데이트: {formatApiDateTime(run.updated_at)}</div>
                </div>
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-coffee-gold underline md:self-start"
                >
                  실행 링크
                </a>
              </div>
            );
          })}
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
              const flavorTags = Array.isArray(bean.flavor)
                ? bean.flavor.filter((v) => typeof v === "string" && v.trim())
                : typeof bean.flavor === "string" && bean.flavor.trim()
                ? bean.flavor.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
              const noteText = pickText(bean.flavor_notes, bean.tasting_notes);
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

                  {flavorTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {flavorTags.slice(0, 6).map((tag, i) => (
                        <span key={`${bean.id}-flavor-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-coffee-dark border border-coffee-gold/20">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {(typeof bean.acidity === "number" || typeof bean.body === "number" || typeof bean.sweetness === "number" || typeof bean.overall === "number") && (
                    <div className="mt-2 text-[11px] opacity-80 grid grid-cols-2 gap-x-2 gap-y-1">
                      {typeof bean.acidity === "number" && <div>산미: {bean.acidity}</div>}
                      {typeof bean.body === "number" && <div>바디: {bean.body}</div>}
                      {typeof bean.sweetness === "number" && <div>단맛: {bean.sweetness}</div>}
                      {typeof bean.overall === "number" && <div>Overall: {bean.overall}</div>}
                    </div>
                  )}

                  {noteText !== "-" && <div className="mt-1 text-xs opacity-70 line-clamp-2">노트: {noteText}</div>}
                  <div className="mt-2 text-[11px] opacity-60">업데이트: {formatDateTime(updated)}</div>
                  {sourceLink !== "-" && (
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={sourceLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-coffee-gold/20 border border-coffee-gold/40 text-coffee-gold"
                      >
                        구매하기
                      </a>
                      <a href={sourceLink} target="_blank" rel="noreferrer" className="text-xs text-coffee-gold underline">
                        원문 보기
                      </a>
                    </div>
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
