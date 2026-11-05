import type { Metadata } from "next";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import { ChangesViewSignal, TrackedLink, TrackedExternalLink } from "@/components/CoffeeFunnelActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이번 주 원두 변동 — 가격 인하·새로 확인된 원두",
  description:
    "국내 로스터리의 최근 7일간 가격 인하, 새로 확인된 원두, 판매 목록 재등장을 한곳에서 확인하세요. 실제 판매 가격과 재고는 판매처 기준입니다.",
  alternates: { canonical: "/changes" },
};

const WINDOW_DAYS = 7;
const EVENT_SCAN_LIMIT = 200;
const DISPLAY_LIMIT = 40;

type ChangeKind = "price_drop" | "new" | "restored";
type ChangeEntry = {
  id: string;
  beanId: string;
  brand: string;
  name: string;
  kind: ChangeKind;
  detectedAt: Date;
  oldPrice: number | null;
  price: number | null;
  sourceUrl: string | null;
};

function numericPrice(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = value.replace(/\s/g, "").match(/(\d{1,3}(?:,\d{3})+|\d+)/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function sourceLink(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatPrice(price: number | null): string {
  return price === null ? "가격 정보 없음" : `${price.toLocaleString("ko-KR")}원`;
}

function formatKst(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function labelFor(kind: ChangeKind): string {
  if (kind === "price_drop") return "가격 인하 확인";
  if (kind === "restored") return "판매 목록 재등장";
  return "새로 확인된 원두";
}

async function loadChanges(): Promise<{ rows: ChangeEntry[]; error: boolean }> {
  try {
    const since = Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 86_400_000);
    const [eventSnap, beanSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "bean_events"),
          where("detected_at", ">=", since),
          orderBy("detected_at", "desc"),
          limit(EVENT_SCAN_LIMIT)
        )
      ),
      // An event is generated before crawl validation. Cross-check the
      // current, applied beans collection before publishing it as a change.
      getDocs(collection(db, "beans")),
    ]);

    const liveBeans = new Map(beanSnap.docs.map((doc) => [doc.id, doc.data()]));
    const seen = new Set<string>();
    const rows: ChangeEntry[] = [];

    for (const eventDoc of eventSnap.docs) {
      const event = eventDoc.data();
      const beanId = typeof event.bean_id === "string" ? event.bean_id : "";
      const bean = liveBeans.get(beanId);
      if (
        !beanId ||
        seen.has(beanId) ||
        !bean ||
        bean.isActive === false ||
        bean.active === false ||
        bean.isSample === true ||
        bean.linkStatus === "dead" ||
        typeof event.brand !== "string" ||
        typeof event.name !== "string" ||
        event.brand !== bean.brand ||
        event.name !== bean.name
      ) {
        continue;
      }

      const detectedAt =
        event.detected_at instanceof Timestamp
          ? event.detected_at.toDate()
          : null;
      if (!detectedAt || !Number.isFinite(detectedAt.getTime())) continue;

      const price = numericPrice(bean.price_krw ?? bean.price);
      const oldPrice = numericPrice(event.old_price_krw);
      const eventPrice = numericPrice(event.new_price_krw);
      let kind: ChangeKind;

      if (event.type === "price_change") {
        // Show only real decreases that agree with the applied catalog.
        if (
          oldPrice === null ||
          eventPrice === null ||
          price === null ||
          eventPrice >= oldPrice ||
          price !== eventPrice
        ) {
          continue;
        }
        kind = "price_drop";
      } else if (event.type === "restored") {
        kind = "restored";
      } else if (event.type === "new") {
        kind = "new";
      } else {
        continue;
      }

      seen.add(beanId);
      rows.push({
        id: eventDoc.id,
        beanId,
        brand: event.brand,
        name: event.name,
        kind,
        detectedAt,
        oldPrice: kind === "price_drop" ? oldPrice : null,
        price,
        sourceUrl: sourceLink(bean.link || bean.url),
      });
      if (rows.length >= DISPLAY_LIMIT) break;
    }

    return { rows, error: false };
  } catch (error) {
    console.error("Recent bean changes could not be loaded:", error);
    return { rows: [], error: true };
  }
}

export default async function ChangesPage() {
  const { rows, error } = await loadChanges();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-7 text-coffee-light">
      <ChangesViewSignal />
      <header className="mb-7">
        <p className="mb-2 text-xs font-semibold tracking-wide text-coffee-gold">
          원두레이더 / 최근 7일
        </p>
        <h2 className="text-2xl font-bold">이번 주 원두 변동</h2>
        <p className="mt-3 text-sm leading-6 text-coffee-light/70">
          국내 로스터리에서 새로 확인된 상품, 가격 인하, 판매 목록 재등장을
          수집 기록과 현재 원두 목록을 대조해 보여드립니다.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/beans"
          className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-medium"
        >
          전체 원두 비교
        </Link>
        <TrackedLink
          event="alerts_interest"
          href="/settings/alerts"
          className="inline-flex min-h-11 items-center rounded-xl bg-coffee-gold px-4 text-sm font-semibold text-coffee-dark"
        >
          무료 알림 연결하기
        </TrackedLink>
      </div>

      {error ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-semibold">최근 변동을 불러오지 못했습니다.</h3>
          <p className="mt-2 text-sm text-coffee-light/65">
            일시적인 조회 오류일 수 있습니다. 원두 전체 목록은 별도로 확인할 수 있습니다.
          </p>
        </section>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-semibold">최근 7일간 표시할 변동이 없습니다.</h3>
          <p className="mt-2 text-sm text-coffee-light/65">
            변화가 없거나 현재 원두 목록과 교차 확인되지 않은 변경은 표시하지 않습니다.
          </p>
        </section>
      ) : (
        <section aria-label="최근 원두 변동" className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-coffee-gold/10 px-2.5 py-1 text-xs font-semibold text-coffee-gold">
                  {labelFor(row.kind)}
                </span>
                <time
                  dateTime={row.detectedAt.toISOString()}
                  className="text-xs text-coffee-light/45"
                >
                  {formatKst(row.detectedAt)}
                </time>
              </div>
              <p className="mt-4 text-sm text-coffee-light/60">{row.brand}</p>
              <h3 className="mt-1 text-lg font-semibold">{row.name}</h3>
              {row.kind === "price_drop" ? (
                <p className="mt-2 text-sm">
                  <span className="text-coffee-light/45 line-through">
                    {formatPrice(row.oldPrice)}
                  </span>
                  <span className="ml-2 font-semibold text-coffee-gold">
                    {formatPrice(row.price)}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-coffee-light/70">
                  현재 목록에 표시된 가격: {formatPrice(row.price)}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <TrackedLink
                  event="change_detail_open"
                  href={`/beans/${encodeURIComponent(row.beanId)}`}
                  className="font-semibold text-coffee-gold underline underline-offset-4"
                >
                  원두 상세
                </TrackedLink>
                {row.sourceUrl && (
                  <TrackedExternalLink
                    event="changes_store_open"
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-coffee-light/80 underline underline-offset-4"
                  >
                    판매처에서 확인
                  </TrackedExternalLink>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <p className="mt-7 text-xs leading-6 text-coffee-light/55">
        수집 결과는 실시간 재고가 아닙니다. 새로 확인된 상품은 신규 출시를,
        판매 목록 재등장은 실제 재입고를 보장하지 않습니다. 가격은
        중량·선택 옵션에 따라 달라질 수 있으므로 최종 가격과 판매 여부는
        로스터리 상품 페이지에서 확인하세요.
      </p>
    </main>
  );
}
