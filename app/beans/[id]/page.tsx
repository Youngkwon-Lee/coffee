import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * 원두 상세 — 검색 유입용 페이지.
 *
 * 목록만 색인되면 "프릳츠 원두 재입고" 같은 질의에 닿지 않는다. 원두 하나하나가
 * 자기 URL과 제목을 가져야 검색 결과에 걸린다.
 *
 * beans는 firestore.rules에서 공개 읽기라 REST로 서버에서 직접 읽는다.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coffee-37b81";

type Bean = {
  name?: string;
  brand?: string;
  price?: string | number;
  flavor?: string | string[];
  roast?: string;
  desc?: string;
  link?: string;
  url?: string;
  image?: string;
  lastUpdated?: string;
};

function val(f: Record<string, unknown> | undefined): unknown {
  if (!f) return undefined;
  const o = f as Record<string, unknown>;
  if ("stringValue" in o) return o.stringValue;
  if ("integerValue" in o) return Number(o.integerValue);
  if ("doubleValue" in o) return o.doubleValue;
  if ("timestampValue" in o) return o.timestampValue;
  if ("arrayValue" in o) {
    const av = o.arrayValue as { values?: Record<string, unknown>[] };
    return (av.values ?? []).map((v) => val(v));
  }
  return undefined;
}

async function getBean(id: string): Promise<Bean | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/beans/${encodeURIComponent(id)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  if (!json.fields) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json.fields)) out[k] = val(v);
  return out as Bean;
}

function flavorText(f: Bean["flavor"]): string {
  if (!f) return "";
  return Array.isArray(f) ? f.join(", ") : String(f);
}

function priceText(p: Bean["price"]): string {
  if (p === undefined || p === null || p === "") return "가격 문의";
  const n = Number(String(p).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("ko-KR")}원` : String(p);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bean = await getBean(id);
  if (!bean?.name) return { title: "원두를 찾을 수 없습니다" };

  const brand = bean.brand ? `${bean.brand} ` : "";
  const title = `${brand}${bean.name}`;
  const bits = [
    bean.brand,
    priceText(bean.price),
    flavorText(bean.flavor),
    bean.roast,
  ].filter(Boolean);

  return {
    title,
    description: `${title} — ${bits.join(" · ")}. 재입고와 가격 변동을 알림으로 받아보세요.`,
    openGraph: {
      title: `${title} | 원두레이더`,
      description: bits.join(" · "),
      images: bean.image ? [{ url: bean.image }] : undefined,
    },
    alternates: { canonical: `/beans/${encodeURIComponent(id)}` },
  };
}

export default async function BeanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bean = await getBean(id);
  if (!bean?.name) notFound();

  const buyUrl = bean.link || bean.url;
  const flavors = flavorText(bean.flavor);

  // 구조화 데이터(JSON-LD)는 넣지 않는다. 원두명·설명은 외부 로스터리 사이트에서
  // 크롤한 값이라 script 태그에 주입하면 XSS 경로가 된다. 제목·설명 메타데이터로
  // 얻는 효과가 대부분이고, 굳이 넣으려면 별도 이스케이프 계층이 먼저 필요하다.

  return (
    <main className="min-h-screen p-4 pb-24 max-w-2xl mx-auto">
      <nav className="mb-4 text-xs text-coffee-light/50">
        <Link href="/beans" className="hover:underline">
          원두 찾기
        </Link>
        <span className="mx-1.5">/</span>
        <span>{bean.brand || "원두"}</span>
      </nav>

      <article className="card-coffee p-5 space-y-4">
        <header>
          {bean.brand && (
            <p className="text-sm font-semibold text-[#c5a880]">{bean.brand}</p>
          )}
          {/* 레이아웃 헤더가 이미 h1("Coffee Tracker")을 쓴다. 한 문서에 h1이
              둘이면 검색엔진이 주제를 잡기 어려우니 h2로 둔다. */}
          <h2 className="mt-1 font-display text-2xl font-bold text-coffee-light">
            {bean.name}
          </h2>
          <p className="mt-2 text-lg font-semibold text-coffee-light">
            {priceText(bean.price)}
          </p>
        </header>

        <dl className="space-y-2 text-sm border-t border-white/5 pt-4">
          {flavors && (
            <div className="flex gap-3">
              <dt className="shrink-0 w-16 text-coffee-light/50">향미</dt>
              <dd className="text-coffee-light/85">{flavors}</dd>
            </div>
          )}
          {bean.roast && (
            <div className="flex gap-3">
              <dt className="shrink-0 w-16 text-coffee-light/50">로스팅</dt>
              <dd className="text-coffee-light/85">{bean.roast}</dd>
            </div>
          )}
        </dl>

        {bean.desc && (
          <p className="text-sm leading-relaxed text-coffee-light/70 border-t border-white/5 pt-4">
            {bean.desc}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-4">
          {buyUrl && (
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 flex-1 inline-flex items-center justify-center rounded-lg bg-[#c5a880] font-semibold text-[#120f0d]"
            >
              로스터리에서 구매
            </a>
          )}
          <Link
            href="/beans"
            className="min-h-11 flex-1 inline-flex items-center justify-center rounded-lg border border-white/10 font-semibold text-coffee-light/80"
          >
            다른 원두 보기
          </Link>
        </div>

        <p className="text-xs text-coffee-light/40">
          재입고와 가격 변동을 알림으로 받으려면 원두 찾기에서 찜해두세요.
        </p>
      </article>
    </main>
  );
}
