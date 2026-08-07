import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * 카페(로스터리) 상세 — 검색 유입용 페이지.
 *
 * 사이트맵에 /cafes/<id> 38개를 넣어두고 이 경로를 만들지 않아 전부 404였다.
 * 없는 URL을 사이트맵에 올리면 Search Console이 오류로 잡고 사이트 신뢰도가 깎인다.
 *
 * "테라로사 강릉", "앤트러사이트 성수" 같은 로스터리명 검색이 원두명 검색보다
 * 흔하므로, 이 페이지에서 해당 로스터리의 원두 목록으로 내부 링크를 건다.
 *
 * cafes/beans 모두 firestore.rules에서 공개 읽기라 REST로 서버에서 직접 읽는다.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "coffee-37b81";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type Cafe = {
  name?: string;
  address?: string;
  description?: string;
  website?: string;
  operatingHours?: string;
  flavorMain?: string;
  flavorTags?: string[];
  signatureMenu?: string[];
  tags?: string[];
  rating?: number;
};

type BeanRow = { id: string; name: string; price?: string };

/**
 * Next.js 15 App Router는 params에 **이미 퍼센트 인코딩된** 원본 세그먼트를 넘긴다.
 * 그대로 encodeURIComponent를 걸면 이중 인코딩되어("%EB%B9%84" → "%25EB%25B9%2584")
 * Firestore가 404를 준다. 한글 문서 ID를 쓰는 카페 28곳이 전부 이 경로로 404였다.
 * 잘못된 인코딩(%zz)이면 decodeURIComponent가 던지므로 원본을 그대로 쓴다.
 */
function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function val(f: Record<string, unknown> | undefined): unknown {
  if (!f) return undefined;
  const o = f as Record<string, unknown>;
  if ("stringValue" in o) return o.stringValue;
  if ("integerValue" in o) return Number(o.integerValue);
  if ("doubleValue" in o) return o.doubleValue;
  if ("booleanValue" in o) return o.booleanValue;
  if ("timestampValue" in o) return o.timestampValue;
  if ("arrayValue" in o) {
    const av = o.arrayValue as { values?: Record<string, unknown>[] };
    return (av.values ?? []).map((v) => val(v));
  }
  return undefined;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

async function getCafe(rawId: string): Promise<Cafe | null> {
  const id = decodeParam(rawId);
  const res = await fetch(`${BASE}/cafes/${encodeURIComponent(id)}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  if (!json.fields) return null;
  const f = json.fields;
  return {
    name: val(f.name) as string | undefined,
    address: val(f.address) as string | undefined,
    description: val(f.description) as string | undefined,
    website: val(f.website) as string | undefined,
    operatingHours: val(f.operatingHours) as string | undefined,
    flavorMain: val(f.flavor_main) as string | undefined,
    flavorTags: strList(val(f.flavor_tags)),
    signatureMenu: strList(val(f.signature_menu)),
    tags: strList(val(f.tags)),
    rating: val(f.rating) as number | undefined,
  };
}

/**
 * 이 로스터리의 원두. beans.brand는 카페 이름의 앞부분과 일치한다
 * ("앤트러사이트 성수" → brand "앤트러사이트"). 지점명이 붙은 카페도 있으므로
 * 전체 이름으로 먼저 맞춰보고, 실패하면 첫 단어로 다시 맞춘다.
 */
async function getBeans(cafeName: string): Promise<BeanRow[]> {
  const candidates = [cafeName, cafeName.split(/[\s(]/)[0]].filter(
    (v, i, a) => v && a.indexOf(v) === i
  );

  for (const brand of candidates) {
    const res = await fetch(`${BASE}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "beans" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "brand" },
              op: "EQUAL",
              value: { stringValue: brand },
            },
          },
          limit: 40,
        },
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) continue;

    const rows = (await res.json()) as {
      document?: { name: string; fields?: Record<string, Record<string, unknown>> };
    }[];
    const beans = rows
      .filter((r) => r.document?.fields)
      .map((r) => ({
        id: r.document!.name.split("/").pop() as string,
        name: (val(r.document!.fields!.name) as string) ?? "",
        price: String(val(r.document!.fields!.price) ?? ""),
      }))
      .filter((b) => b.name);

    if (beans.length) return beans;
  }
  return [];
}

function priceText(p?: string): string {
  if (!p) return "";
  const n = Number(String(p).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("ko-KR")}원` : "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cafe = await getCafe(id);
  if (!cafe?.name) return { title: "카페를 찾을 수 없습니다" };

  const bits = [cafe.address, cafe.flavorMain && `${cafe.flavorMain} 계열`].filter(Boolean);
  const description =
    `${cafe.name} — ${bits.join(" · ")}. 판매 중인 원두와 재입고 알림을 확인하세요.`.slice(
      0,
      155
    );

  return {
    title: `${cafe.name} 원두`,
    description,
    openGraph: { title: `${cafe.name} 원두 | 원두레이더`, description },
    alternates: { canonical: `/cafes/${encodeURIComponent(decodeParam(id))}` },
  };
}

export default async function CafeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cafe = await getCafe(id);
  if (!cafe?.name) notFound();

  const beans = await getBeans(cafe.name);

  // 구조화 데이터(JSON-LD)는 넣지 않는다. 카페 이름·설명은 외부에서 수집한
  // 값이라 script 태그에 주입하면 XSS 경로가 된다. app/beans/[id]와 같은 이유다.

  return (
    <main className="min-h-screen p-4 pb-24 max-w-2xl mx-auto">
      <nav className="mb-4 text-xs text-coffee-light/50">
        <Link href="/cafes" className="hover:underline">
          카페 찾기
        </Link>
        <span className="mx-1.5">/</span>
        <span>{cafe.name}</span>
      </nav>

      <article className="card-coffee p-5 space-y-4">
        <header>
          {/* 레이아웃 헤더가 이미 h1을 쓰므로 h2로 둔다. */}
          <h2 className="font-display text-2xl font-bold text-coffee-light">{cafe.name}</h2>
          {cafe.address && (
            <p className="mt-1.5 text-sm text-coffee-light/60">{cafe.address}</p>
          )}
        </header>

        {cafe.description && (
          <p className="text-sm leading-relaxed text-coffee-light/75">{cafe.description}</p>
        )}

        <dl className="space-y-2 text-sm border-t border-white/5 pt-4">
          {cafe.operatingHours && (
            <div className="flex gap-3">
              <dt className="shrink-0 w-16 text-coffee-light/50">영업시간</dt>
              <dd className="text-coffee-light/85">{cafe.operatingHours}</dd>
            </div>
          )}
          {Boolean(cafe.flavorTags?.length) && (
            <div className="flex gap-3">
              <dt className="shrink-0 w-16 text-coffee-light/50">향미</dt>
              <dd className="text-coffee-light/85">{cafe.flavorTags!.join(", ")}</dd>
            </div>
          )}
          {Boolean(cafe.signatureMenu?.length) && (
            <div className="flex gap-3">
              <dt className="shrink-0 w-16 text-coffee-light/50">대표메뉴</dt>
              <dd className="text-coffee-light/85">{cafe.signatureMenu!.join(", ")}</dd>
            </div>
          )}
        </dl>

        <section className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-semibold text-coffee-light">
            판매 중인 원두 {beans.length > 0 && `${beans.length}종`}
          </h3>
          {beans.length ? (
            <ul className="mt-2.5 space-y-1.5">
              {beans.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/beans/${encodeURIComponent(b.id)}`}
                    className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-2 -mx-2 text-sm hover:bg-white/5"
                  >
                    <span className="text-coffee-light/85">{b.name}</span>
                    {priceText(b.price) && (
                      <span className="shrink-0 text-xs text-coffee-light/55">
                        {priceText(b.price)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-coffee-light/55">
              아직 수집된 원두가 없습니다.
            </p>
          )}
        </section>

        <div className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-4">
          {cafe.website && (
            <a
              href={cafe.website}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 flex-1 inline-flex items-center justify-center rounded-lg bg-[#c5a880] font-semibold text-[#120f0d]"
            >
              공식 사이트
            </a>
          )}
          <Link
            href="/cafes"
            className="min-h-11 flex-1 inline-flex items-center justify-center rounded-lg border border-white/10 font-semibold text-coffee-light/80"
          >
            다른 카페 보기
          </Link>
        </div>
      </article>
    </main>
  );
}
