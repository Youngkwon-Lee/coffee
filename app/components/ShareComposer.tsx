"use client";

import { useEffect, useMemo, useState } from "react";
import StoryEditor from "./StoryEditor";
import {
  DEFAULT_SHARE_VISIBILITY,
  getSensorySceneProfile,
  ShareCaptionTone,
  ShareTemplate,
  ShareVisibility,
  buildShareCaption,
  downloadAiStyledCardImage,
  downloadShareCard,
  downloadStoryEditorImage,
  mapRecordToSharePayload,
  renderShareCardSvg,
  shareAiStyledCardImage,
  shareShareCard,
  shareStoryEditorImage,
  syncStoryStickers,
  type SensoryScenePreset,
  type StoryRatio,
  type StorySticker,
  type CoffeeShareSourceRecord,
} from "../utils/share";

interface ShareComposerProps {
  record: CoffeeShareSourceRecord | null;
  open: boolean;
  onClose: () => void;
  onToast?: (message: string) => void;
  initialLayoutMode?: ShareLayoutMode;
}

type ShareLayoutMode = "card" | "story" | "ai";
type AiStylePreset = "editorial" | "sticker" | "cinematic";

const aiStyleOptions: { key: AiStylePreset; label: string; description: string }[] = [
  { key: "editorial", label: "에디토리얼", description: "잡지 화보처럼 정돈된 고급 카드" },
  { key: "sticker", label: "스티커 무드", description: "오버레이와 캡슐 태그가 있는 SNS형" },
  { key: "cinematic", label: "시네마틱", description: "명암과 분위기를 살린 포스터형" },
];

const templateOptions: { key: ShareTemplate; label: string; description: string }[] = [
  { key: "minimal", label: "미니멀", description: "사진 중심 저널 카드" },
  { key: "editorial", label: "에디토리얼", description: "잡지형 리뷰 레이아웃" },
  { key: "strava", label: "Strava 무드", description: "스탯 오버레이 카드" },
];

const captionToneOptions: { key: ShareCaptionTone; label: string; description: string }[] = [
  { key: "journal", label: "기록형", description: "담백하게 남기는 커피 로그" },
  { key: "mood", label: "감성형", description: "분위기와 여운을 강조한 문구" },
  { key: "promo", label: "추천형", description: "저장하고 공유하기 좋은 소개형 문구" },
];

const sensorySceneOptions: { key: SensoryScenePreset; label: string; description: string }[] = [
  { key: "auto", label: "Auto", description: "원산지와 가공방식으로 자동 추정" },
  { key: "kenya-clarity", label: "Kenya Clarity", description: "차갑고 또렷한 berry lift" },
  { key: "fruit-bloom", label: "Fruit Bloom", description: "과일 향이 퍼지는 sunset haze" },
  { key: "amber-nectar", label: "Amber Nectar", description: "허니처럼 점도 있는 glow" },
  { key: "velvet-night", label: "Velvet Night", description: "짙은 그림자와 lingering smoke" },
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

export default function ShareComposer({
  record,
  open,
  onClose,
  onToast,
  initialLayoutMode = "card",
}: ShareComposerProps) {
  const [layoutMode, setLayoutMode] = useState<ShareLayoutMode>(initialLayoutMode);
  const [template, setTemplate] = useState<ShareTemplate>("minimal");
  const [captionTone, setCaptionTone] = useState<ShareCaptionTone>("journal");
  const [visibility, setVisibility] = useState<ShareVisibility>(DEFAULT_SHARE_VISIBILITY);
  const [storyRatio, setStoryRatio] = useState<StoryRatio>("9:16");
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  const [activeStoryStickerId, setActiveStoryStickerId] = useState<string>("title");
  const [storyScenePreset, setStoryScenePreset] = useState<SensoryScenePreset>("auto");
  const [isBusy, setIsBusy] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [captionSource, setCaptionSource] = useState<"rule" | "openai">("rule");
  const [aiStylePreset, setAiStylePreset] = useState<AiStylePreset>("editorial");
  const [aiStyledImage, setAiStyledImage] = useState<string | null>(null);
  const [isGeneratingAiStyle, setIsGeneratingAiStyle] = useState(false);
  const [aiStyleError, setAiStyleError] = useState<string | null>(null);

  const payload = useMemo(() => (record ? mapRecordToSharePayload(record) : null), [record]);
  const sensoryProfile = useMemo(
    () => (payload ? getSensorySceneProfile(payload, storyScenePreset) : null),
    [payload, storyScenePreset],
  );
  const generatedCaption = useMemo(() => {
    if (!payload) return "";
    return buildShareCaption(payload, visibility, template, captionTone);
  }, [captionTone, payload, visibility, template]);
  const caption = aiCaption || generatedCaption;

  useEffect(() => {
    setAiCaption(null);
    setCaptionSource("rule");
  }, [generatedCaption]);

  useEffect(() => {
    setLayoutMode(initialLayoutMode);
  }, [initialLayoutMode, record?.id]);

  useEffect(() => {
    setVisibility(DEFAULT_SHARE_VISIBILITY);
  }, [record?.id]);

  useEffect(() => {
    setStoryScenePreset("auto");
  }, [record?.id]);

  useEffect(() => {
    if (!payload) return;
    setStoryStickers((prev) => syncStoryStickers(prev, payload, visibility));
  }, [payload, visibility]);

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
      if (layoutMode === "ai") {
        if (!aiStyledImage) {
          onToast?.("먼저 AI 스타일 카드를 생성해주세요.");
          return;
        }
        await downloadAiStyledCardImage(
          aiStyledImage,
          payload,
          visibility,
          storyScenePreset,
          `coffee-ai-style-${record?.id || "card"}-${aiStylePreset}.png`,
        );
        onToast?.("AI 스타일 이미지를 저장했어요 💾");
      } else if (layoutMode === "story") {
        await downloadStoryEditorImage(
          payload,
          visibility,
          storyRatio,
          storyStickers,
          storyScenePreset,
          `coffee-story-${record?.id || "card"}-${storyRatio.replace(":", "x")}.png`,
        );
        onToast?.("Sensory 이미지를 저장했어요 💾");
      } else {
        await downloadShareCard(svg, fileName);
        onToast?.("SNS용 이미지를 저장했어요 💾");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    setIsBusy(true);
    try {
      if (layoutMode === "ai") {
        if (!aiStyledImage) {
          onToast?.("먼저 AI 스타일 카드를 생성해주세요.");
          return;
        }
        const shared = await shareAiStyledCardImage(
          aiStyledImage,
          payload,
          visibility,
          storyScenePreset,
          `coffee-ai-style-${record?.id || "card"}-${aiStylePreset}.png`,
          caption,
        );
        onToast?.(shared ? "AI 스타일 카드 공유 시트를 열었어요 🚀" : "공유 시트를 못 열어서 이미지 저장으로 대체했어요");
      } else if (layoutMode === "story") {
        const shared = await shareStoryEditorImage(
          payload,
          visibility,
          storyRatio,
          storyStickers,
          storyScenePreset,
          `coffee-story-${record?.id || "card"}-${storyRatio.replace(":", "x")}.png`,
          caption,
        );
        onToast?.(shared ? "Sensory 공유 시트를 열었어요 🚀" : "공유 시트를 못 열어서 이미지 저장으로 대체했어요");
      } else {
        const shared = await shareShareCard(svg, fileName, caption);
        onToast?.(shared ? "공유 시트를 열었어요 🚀" : "공유 시트를 못 열어서 이미지 저장으로 대체했어요");
      }
    } catch {
      onToast?.("공유를 열지 못했어요");
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateAiStyle = async () => {
    setIsGeneratingAiStyle(true);
    setAiStyleError(null);
    try {
      const response = await fetch("/api/share-style-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload,
          visibility,
          stylePreset: aiStylePreset,
          scenePreset: storyScenePreset,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.details || result?.error || "AI 스타일 카드 생성에 실패했습니다.");
      }
      if (typeof result?.imageDataUrl === "string" && result.imageDataUrl.startsWith("data:image/")) {
        setAiStyledImage(result.imageDataUrl);
        onToast?.("AI 스타일 카드를 만들었어요 ✨");
      } else {
        throw new Error("AI 이미지 응답이 비어 있습니다.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 스타일 카드 생성에 실패했어요";
      setAiStyleError(message);
      onToast?.(message);
    } finally {
      setIsGeneratingAiStyle(false);
    }
  };

  const handleAiRewrite = async () => {
    if (!payload) return;

    setIsGeneratingCaption(true);
    try {
      const response = await fetch("/api/share-caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload,
          visibility,
          template,
          tone: captionTone,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.details || result?.error || "AI 캡션 생성에 실패했습니다.");
      }

      if (typeof result?.caption === "string" && result.caption.trim()) {
        setAiCaption(result.caption.trim());
        setCaptionSource(result?.source === "openai" ? "openai" : "rule");
        onToast?.(result?.source === "openai" ? "AI가 캡션을 다시 다듬었어요 ✨" : "기본 캡션 규칙으로 다시 정리했어요.");
      }
    } catch (error) {
      console.error("AI caption rewrite failed:", error);
      onToast?.(error instanceof Error ? error.message : "AI 캡션 생성에 실패했어요");
    } finally {
      setIsGeneratingCaption(false);
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

        <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setLayoutMode("card")}
            className={`rounded-2xl px-4 py-3 text-left transition-colors ${
              layoutMode === "card"
                ? "bg-coffee-gold/12 text-coffee-light ring-1 ring-coffee-gold/40"
                : "bg-transparent text-coffee-light/65 hover:bg-white/5"
            }`}
          >
            <div className="text-sm font-semibold">Quick Share</div>
            <div className="mt-1 text-xs opacity-75">기존 포스터형 카드로 빠르게 저장/공유</div>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("story")}
            className={`rounded-2xl px-4 py-3 text-left transition-colors ${
              layoutMode === "story"
                ? "bg-coffee-gold/12 text-coffee-light ring-1 ring-coffee-gold/40"
                : "bg-transparent text-coffee-light/65 hover:bg-white/5"
            }`}
          >
            <div className="text-sm font-semibold">Sensory Editor</div>
            <div className="mt-1 text-xs opacity-75">향미가 공간에 퍼지도록 레이어와 타이포를 직접 배치</div>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("ai")}
            className={`rounded-2xl px-4 py-3 text-left transition-colors ${
              layoutMode === "ai"
                ? "bg-coffee-gold/12 text-coffee-light ring-1 ring-coffee-gold/40"
                : "bg-transparent text-coffee-light/65 hover:bg-white/5"
            }`}
          >
            <div className="text-sm font-semibold">AI 스타일 카드 (beta)</div>
            <div className="mt-1 text-xs opacity-75">AI가 사진 분위기를 재해석하고, 텍스트는 정확하게 다시 얹어줌</div>
          </button>
        </div>

        {layoutMode === "card" ? (
          <ShareCardPreview payload={payload} template={template} visibility={visibility} />
        ) : layoutMode === "story" ? (
          <StoryEditor
            payload={payload}
            visibility={visibility}
            ratio={storyRatio}
            scenePreset={storyScenePreset}
            stickers={storyStickers}
            activeStickerId={activeStoryStickerId}
            onRatioChange={setStoryRatio}
            onScenePresetChange={setStoryScenePreset}
            onStickersChange={setStoryStickers}
            onActiveStickerChange={setActiveStoryStickerId}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-coffee-light">
                    <span>AI 스타일 카드</span>
                    <span className="rounded-full border border-coffee-gold/20 bg-coffee-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-coffee-gold">beta</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-coffee-light/60">
                    AI가 원본 사진을 바탕으로 감성적인 카드 이미지를 만들고, 원두명/카페명/향미 같은 핵심 텍스트는 정확하게 다시 얹어줍니다.
                  </p>
                </div>
                <div className="rounded-full border border-coffee-gold/20 bg-coffee-gold/10 px-3 py-1 text-[11px] font-semibold text-coffee-gold">
                  생성 시 API 비용 발생 가능
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {aiStyleOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAiStylePreset(option.key)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      aiStylePreset === option.key
                        ? "border-coffee-gold bg-coffee-gold/12 text-coffee-light"
                        : "border-white/10 bg-white/5 text-coffee-light/75 hover:bg-white/10"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="mt-1 text-xs opacity-75">{option.description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-coffee-light/52">Sensory preset</div>
                <div className="flex flex-wrap gap-2">
                  {sensorySceneOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setStoryScenePreset(option.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        storyScenePreset === option.key ? "bg-coffee-gold text-coffee-dark" : "bg-white/8 text-coffee-light/70"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAiStyle}
                  disabled={isGeneratingAiStyle}
                  className="rounded-full border border-coffee-gold/30 bg-coffee-gold/10 px-4 py-2 text-sm font-semibold text-coffee-gold disabled:opacity-50"
                >
                  {isGeneratingAiStyle ? "AI 카드 생성 중..." : aiStyledImage ? "다시 생성하기" : "AI 스타일 카드 만들기"}
                </button>
                {aiStyledImage && (
                  <button
                    type="button"
                    onClick={() => setLayoutMode("story")}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-coffee-light/75"
                  >
                    편집기로 돌아가기
                  </button>
                )}
              </div>
              {aiStyleError && (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {aiStyleError}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#160f0b] shadow-[0_20px_50px_rgba(0,0,0,0.35)] aspect-[9/16] w-full max-w-[420px] mx-auto">
              <img
                src={aiStyledImage || payload.imageUrl}
                alt={aiStyledImage ? `${payload.title} AI style preview` : payload.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {aiStyledImage ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/55" />
                  <div
                    className="absolute left-[6%] right-[18%] top-[50%] h-[28px] rounded-full blur-2xl"
                    style={{ background: `linear-gradient(90deg, ${(sensoryProfile?.flavors[0]?.glow ?? "#ff7b9c")}00, ${(sensoryProfile?.flavors[0]?.glow ?? "#ff7b9c")}66 26%, ${(sensoryProfile?.flavors[1]?.glow ?? "#d8a66a")}55 62%, ${(sensoryProfile?.flavors[2]?.glow ?? "#f6dcc4")}00 100%)` }}
                  />
                  <div className="absolute left-4 top-4 rounded-full border border-coffee-gold/20 bg-coffee-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-coffee-gold backdrop-blur-sm">
                    AI STYLE CARD BETA
                  </div>
                  <div className="absolute left-4 top-14 flex flex-wrap gap-2">
                    {visibility.showLocation && <MetaPill>{payload.locationLabel}</MetaPill>}
                    {visibility.showDate && <MetaPill>{payload.dateLabel}</MetaPill>}
                  </div>
                  <div className="absolute left-4 top-24 max-w-[72%]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/56">
                      {sensoryProfile?.sceneTitle || "Sensory scene"}
                    </div>
                    <div className="mt-2 font-cafe-heading text-3xl leading-[0.95] text-coffee-light">{payload.title}</div>
                    <div className="mt-2 text-sm text-coffee-100/80">{payload.cafe} · {payload.subtitle}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-coffee-100/55">
                      {sensoryProfile?.sceneNote}
                    </div>
                  </div>
                  <div className="absolute inset-x-4 top-[47%]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/52">Flavor path</div>
                    <div className="relative mt-2 h-[72px]">
                      <div className="absolute left-0 right-0 top-[34px] h-px bg-white/12" />
                      <div className="absolute left-[10%] right-[12%] top-[26px] h-[16px] rounded-full blur-xl" style={{ background: `linear-gradient(90deg, ${(sensoryProfile?.flavors[0]?.glow ?? "#ff7b9c")}00, ${(sensoryProfile?.flavors[0]?.glow ?? "#ff7b9c")}66 24%, ${(sensoryProfile?.flavors[1]?.glow ?? "#d8a66a")}55 62%, ${(sensoryProfile?.flavors[2]?.glow ?? "#f6dcc4")}00 100%)` }} />
                      <div className="relative flex items-center justify-between gap-3 pt-6">
                        {payload.flavors.slice(0, 4).map((flavor) => (
                          <div key={flavor} className="flex-1 text-center">
                            <div className="mx-auto mb-2 h-2.5 w-2.5 rounded-full bg-white/90" />
                            <div className="text-[12px] font-semibold text-white">{flavor}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/10 bg-[#140e0b]/56 p-4 backdrop-blur-md">
                    <div className="font-cafe-heading text-2xl leading-tight text-coffee-light">{payload.title}</div>
                    <div className="mt-2 text-sm text-coffee-100/80">{payload.cafe} · {payload.subtitle}</div>
                    <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-coffee-100/48">
                      {sensorySceneOptions.find((option) => option.key === storyScenePreset)?.label} · {sensoryProfile?.atmosphereLabel}
                    </div>
                    {visibility.showRating && payload.rating > 0 && (
                      <div className="mt-3 text-sm font-semibold text-coffee-light">평점 {payload.rating.toFixed(1)} / 5.0</div>
                    )}
                    {visibility.showReview && payload.review && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-coffee-50/88">{payload.review}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/65" />
                  <div className="absolute inset-x-6 top-6 rounded-[24px] border border-white/10 bg-black/30 p-4 backdrop-blur-md">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-coffee-gold">AI Style Preview</div>
                    <div className="mt-2 font-cafe-heading text-2xl text-coffee-light">{payload.title}</div>
                    <p className="mt-2 text-sm leading-relaxed text-coffee-light/72">
                      사진을 기반으로 새로운 분위기의 카드 한 장을 만들고 싶다면 위 옵션을 고른 뒤 생성해보세요.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">Preview summary</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill>{payload.cafe}</MetaPill>
            <MetaPill>{payload.subtitle}</MetaPill>
            {payload.originLabel && <MetaPill>{payload.originLabel}</MetaPill>}
            {payload.roastLabel && <MetaPill>{payload.roastLabel}</MetaPill>}
            {layoutMode === "story" && <MetaPill>{sensorySceneOptions.find((option) => option.key === storyScenePreset)?.label}</MetaPill>}
          </div>
        </div>

        {layoutMode === "card" && (
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
        )}

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold text-coffee-light">캡션 톤</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {captionToneOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setCaptionTone(option.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  captionTone === option.key
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
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-coffee-light">SNS 캡션</div>
            <div className="text-right text-xs text-coffee-light/55">
              <div>현재 톤: {captionToneOptions.find((option) => option.key === captionTone)?.label}</div>
              <div>{captionSource === "openai" ? "AI 다듬음" : "기본 규칙 캡션"}</div>
            </div>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-coffee-light/80">{caption}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-coffee-gold/25 bg-coffee-gold/10 px-3 py-1.5 text-xs font-semibold text-coffee-gold disabled:opacity-50"
              onClick={handleAiRewrite}
              disabled={isGeneratingCaption}
            >
              {isGeneratingCaption ? "AI 캡션 생성 중..." : "AI로 다시 쓰기"}
            </button>
            {aiCaption && (
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-coffee-light/75"
                onClick={() => {
                  setAiCaption(null);
                  setCaptionSource("rule");
                }}
              >
                기본 캡션으로 되돌리기
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-coffee-light" onClick={handleCopyCaption}>
            캡션 복사
          </button>
          <button
            type="button"
            className="rounded-2xl border border-coffee-gold/30 bg-coffee-gold/10 px-4 py-3 text-sm font-semibold text-coffee-gold disabled:opacity-50"
            onClick={handleDownload}
            disabled={isBusy || (layoutMode === "story" && storyStickers.length === 0) || (layoutMode === "ai" && !aiStyledImage)}
          >
            {isBusy ? "처리 중..." : layoutMode === "story" ? "Sensory 이미지 저장" : layoutMode === "ai" ? "AI 카드 저장" : "이미지 저장"}
          </button>
          <button
            type="button"
            className="rounded-2xl bg-coffee-gold px-4 py-3 text-sm font-semibold text-coffee-dark disabled:opacity-50"
            onClick={handleShare}
            disabled={isBusy || (layoutMode === "story" && storyStickers.length === 0) || (layoutMode === "ai" && !aiStyledImage)}
          >
            {isBusy ? "처리 중..." : layoutMode === "story" ? "Sensory 공유하기" : layoutMode === "ai" ? "AI 카드 공유하기" : "공유 시트 열기"}
          </button>
        </div>
      </div>
    </div>
  );
}
