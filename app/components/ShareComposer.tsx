"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_SHARE_VISIBILITY,
  ShareTemplate,
  ShareVisibility,
  buildShareCaption,
  downloadShareCard,
  mapRecordToSharePayload,
  renderShareCardSvg,
  shareShareCard,
  type CoffeeShareSourceRecord,
} from "../utils/share";

interface ShareComposerProps {
  record: CoffeeShareSourceRecord | null;
  open: boolean;
  onClose: () => void;
  onToast?: (message: string) => void;
}

const templateOptions: { key: ShareTemplate; label: string; description: string }[] = [
  { key: "minimal", label: "미니멀", description: "사진 중심 저널 카드" },
  { key: "editorial", label: "에디토리얼", description: "잡지형 리뷰 레이아웃" },
  { key: "strava", label: "Strava 무드", description: "스탯 오버레이 카드" },
];

function MetaPill({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.02em] ${
        tone === "light" ? "bg-[#ead8c2] text-[#6d523f]" : "bg-black/25 text-coffee-50 backdrop-blur-sm"
      }`}
    >
      {children}
    </span>
  );
}

function FlavorFocusPanel({
  flavors,
  originLabel,
  roastLabel,
  methodLabel,
}: {
  flavors: string[];
  originLabel: string;
  roastLabel: string;
  methodLabel: string;
}) {
  const topFlavors = flavors.filter(Boolean).slice(0, 3);
  const leadFlavor = topFlavors[0] || "Tasting notes";
  const supportingFlavors = topFlavors.slice(1);
  const meta = [
    { label: "Origin", value: originLabel },
    { label: "Roast", value: roastLabel },
    { label: "Method", value: methodLabel },
  ].filter((item) => item.value);

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#140e0b]/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(197,139,60,0.14),transparent_36%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-full bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-[#dcc4a5] backdrop-blur-sm">
            Flavor Focus
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-coffee-100/50">coffee profile</div>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/8 bg-black/18 p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-coffee-100/42">Top note</div>
          <div className="mt-1 text-lg font-semibold text-coffee-50">{leadFlavor}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {supportingFlavors.length > 0 ? supportingFlavors.map((flavor) => (
              <span key={flavor} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-coffee-50">
                {flavor}
              </span>
            )) : (
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-coffee-50/70">
                add more tasting notes
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {meta.map((item) => (
            <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-coffee-100/45">
                {item.label}
              </div>
              <div className="mt-1 text-sm font-medium text-coffee-50">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-coffee-100/52">
          <div>taste-first card</div>
          <div className="rounded-full border border-white/8 bg-white/6 px-2.5 py-1">notes over location</div>
        </div>
      </div>
    </div>
  );
}

function ShareCardPreview({
  payload,
  template,
  visibility,
}: {
  payload: ReturnType<typeof mapRecordToSharePayload>;
  template: ShareTemplate;
  visibility: ShareVisibility;
}) {
  const showMetaLine = Boolean(payload.originLabel || payload.roastLabel);

  if (template === "editorial") {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#f3e8db] shadow-[0_20px_50px_rgba(0,0,0,0.35)] aspect-[4/5]">
        <img src={payload.imageUrl} alt={payload.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#f6efe7]/10 via-transparent to-[#f3e7d8]/85" />
        <div className="absolute left-5 top-5 z-10">
          <MetaPill tone="light">{visibility.showLocation ? payload.locationLabel : payload.cafe}</MetaPill>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="rounded-[24px] bg-[#f6efe7]/92 p-5 text-[#2c211b] shadow-2xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#8f6c52]">Coffee Review</div>
            <div className="mt-2 font-cafe-heading text-3xl leading-tight">{payload.title}</div>
            <div className="mt-2 text-sm text-[#6f5542]">{payload.cafe} · {payload.subtitle}</div>
            {visibility.showRating && payload.rating > 0 && (
              <div className="mt-4 text-sm font-semibold text-coffee-700">평점 {payload.rating.toFixed(1)} / 5.0</div>
            )}
            {visibility.showFlavors && payload.flavors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {payload.flavors.map((flavor) => (
                  <span key={flavor} className="rounded-full bg-[#ead8c2] px-3 py-1 text-xs font-medium text-[#6d523f]">
                    {flavor}
                  </span>
                ))}
              </div>
            )}
            {showMetaLine && (
              <div className="mt-3 text-xs text-[#8b7260]">
                {payload.originLabel && <span>Origin · {payload.originLabel}</span>}
                {payload.originLabel && payload.roastLabel && <span>  /  </span>}
                {payload.roastLabel && <span>Roast · {payload.roastLabel}</span>}
              </div>
            )}
            {visibility.showReview && payload.review && (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#3d2d23]">{payload.review}</p>
            )}
            <div className="mt-4 text-xs text-[#8b7260]">
              {visibility.showDate && <span>{payload.dateLabel}</span>}
              {visibility.showDate && visibility.showLocation && <span> · </span>}
              {visibility.showLocation && <span>{payload.locationLabel}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (template === "strava") {
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-coffee-dark shadow-[0_20px_50px_rgba(0,0,0,0.35)] aspect-[4/5]">
        <img src={payload.imageUrl} alt={payload.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/75" />
        <div className="absolute left-5 top-5 z-10">
          <MetaPill>{visibility.showLocation ? payload.locationLabel : payload.cafe}</MetaPill>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="rounded-[24px] border border-white/10 bg-[#1e140f]/78 p-5 backdrop-blur-md">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#dcc4a5]">Coffee Journal</div>
            <div className="font-cafe-heading text-3xl leading-tight text-coffee-light">{payload.title}</div>
            <div className="mt-2 text-sm text-coffee-100/80">{payload.cafe} · {payload.subtitle}</div>

            <div className="mt-4">
              <FlavorFocusPanel
                flavors={payload.flavors}
                originLabel={payload.originLabel}
                roastLabel={payload.roastLabel}
                methodLabel={payload.methodLabel}
              />
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              {visibility.showRating && payload.rating > 0 ? (
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-white">{payload.rating.toFixed(1)}</span>
                  <span className="pb-1 text-sm text-coffee-100/70">/ 5.0</span>
                </div>
              ) : <div />}
              <div className="text-right text-[11px] text-coffee-100/65">
                {visibility.showDate && <div>{payload.dateLabel}</div>}
                {visibility.showLocation && <div>{payload.locationLabel}</div>}
              </div>
            </div>
            {showMetaLine && (
              <div className="mt-3 text-xs text-[#ceb393]">
                {payload.originLabel && <span>{payload.originLabel}</span>}
                {payload.originLabel && payload.roastLabel && <span> · </span>}
                {payload.roastLabel && <span>{payload.roastLabel}</span>}
              </div>
            )}

            {visibility.showReview && payload.review && (
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-coffee-50/90">{payload.review}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-coffee-dark shadow-[0_20px_50px_rgba(0,0,0,0.35)] aspect-[4/5]">
      <img src={payload.imageUrl} alt={payload.title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/70" />
      <div className="absolute left-5 top-5 z-10 flex gap-2">
        <MetaPill>{visibility.showLocation ? payload.locationLabel : payload.cafe}</MetaPill>
        {visibility.showDate && <MetaPill>{payload.dateLabel}</MetaPill>}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="rounded-[24px] border border-[#c58b3c]/15 bg-[#241914]/76 p-5 backdrop-blur-md">
          <div className="font-cafe-heading text-3xl leading-tight text-coffee-light">{payload.title}</div>
          <div className="mt-2 text-sm text-coffee-100/80">{payload.cafe} · {payload.subtitle}</div>

          {visibility.showRating && payload.rating > 0 && (
            <div className="mt-4 flex items-end gap-2">
              <span className="text-3xl font-bold text-white">{payload.rating.toFixed(1)}</span>
              <span className="pb-1 text-sm text-coffee-100/70">/ 5.0</span>
            </div>
          )}

          {visibility.showFlavors && payload.flavors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {payload.flavors.map((flavor) => (
                <span key={flavor} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-coffee-50">
                  {flavor}
                </span>
              ))}
            </div>
          )}

          {showMetaLine && (
            <div className="mt-3 text-xs text-[#d0b392]">
              {payload.originLabel && <span>{payload.originLabel}</span>}
              {payload.originLabel && payload.roastLabel && <span> · </span>}
              {payload.roastLabel && <span>{payload.roastLabel}</span>}
            </div>
          )}

          {visibility.showReview && payload.review && (
            <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-coffee-50/90">{payload.review}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShareComposer({ record, open, onClose, onToast }: ShareComposerProps) {
  const [template, setTemplate] = useState<ShareTemplate>("minimal");
  const [visibility, setVisibility] = useState<ShareVisibility>(DEFAULT_SHARE_VISIBILITY);
  const [isBusy, setIsBusy] = useState(false);

  const payload = useMemo(() => (record ? mapRecordToSharePayload(record) : null), [record]);
  const caption = useMemo(() => {
    if (!payload) return "";
    return buildShareCaption(payload, visibility, template);
  }, [payload, visibility, template]);

  if (!open || !payload) return null;

  const svg = renderShareCardSvg(payload, template, visibility);
  const fileName = `coffee-share-${record?.id || "card"}-${template}.svg`;

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      onToast?.("SNS 캡션을 복사했어요 ✍️");
    } catch {
      onToast?.("캡션 복사에 실패했어요");
    }
  };

  const handleDownload = async () => {
    setIsBusy(true);
    try {
      await downloadShareCard(svg, fileName);
      onToast?.("SNS용 이미지를 저장했어요 💾");
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    setIsBusy(true);
    try {
      const shared = await shareShareCard(svg, fileName, caption);
      onToast?.(shared ? "공유 시트를 열었어요 🚀" : "공유 시트를 못 열어서 이미지 저장으로 대체했어요");
    } catch {
      onToast?.("공유를 열지 못했어요");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#2d221d] p-4 pb-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-coffee-light">SNS용 카드 만들기</h3>
            <p className="mt-1 text-sm text-coffee-light/65">기록을 SNS에 올리기 좋은 이미지와 캡션으로 정리해요.</p>
          </div>
          <button type="button" className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-coffee-light/75" onClick={onClose}>
            닫기
          </button>
        </div>

        <ShareCardPreview payload={payload} template={template} visibility={visibility} />

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">Preview summary</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill>{payload.cafe}</MetaPill>
            <MetaPill>{payload.subtitle}</MetaPill>
            {payload.originLabel && <MetaPill>{payload.originLabel}</MetaPill>}
            {payload.roastLabel && <MetaPill>{payload.roastLabel}</MetaPill>}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold text-coffee-light">템플릿</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {templateOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setTemplate(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  template === option.key
                    ? "border-coffee-gold bg-coffee-gold/12 text-coffee-light"
                    : "border-white/10 bg-white/5 text-coffee-light/75 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div className="mt-1 text-xs opacity-75">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { key: "showReview", label: "메모" },
            { key: "showFlavors", label: "향미" },
            { key: "showRating", label: "평점" },
            { key: "showDate", label: "날짜" },
            { key: "showLocation", label: "위치" },
          ].map((item) => {
            const typedKey = item.key as keyof ShareVisibility;
            const active = visibility[typedKey];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setVisibility((prev) => ({ ...prev, [typedKey]: !prev[typedKey] }))}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-coffee-gold text-coffee-dark" : "bg-white/5 text-coffee-light/70"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-sm font-semibold text-coffee-light">SNS 캡션</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-coffee-light/80">{caption}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-coffee-light" onClick={handleCopyCaption}>
            캡션 복사
          </button>
          <button type="button" className="rounded-2xl border border-coffee-gold/30 bg-coffee-gold/10 px-4 py-3 text-sm font-semibold text-coffee-gold disabled:opacity-50" onClick={handleDownload} disabled={isBusy}>
            {isBusy ? "처리 중..." : "이미지 저장"}
          </button>
          <button type="button" className="rounded-2xl bg-coffee-gold px-4 py-3 text-sm font-semibold text-coffee-dark disabled:opacity-50" onClick={handleShare} disabled={isBusy}>
            {isBusy ? "처리 중..." : "공유 시트 열기"}
          </button>
        </div>
      </div>
    </div>
  );
}
