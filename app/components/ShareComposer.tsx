"use client";

import { useEffect, useMemo, useState } from "react";
import StoryEditor from "./StoryEditor";
import {
  DEFAULT_SHARE_VISIBILITY,
  getSensorySceneProfile,
  renderStoryEditorBlob,
  ShareCaptionTone,
  ShareTemplate,
  ShareVisibility,
  buildShareCaption,
  downloadStoryEditorImage,
  mapRecordToSharePayload,
  shareStoryEditorImage,
  syncStoryStickers,
  type CoffeeShareSourceRecord,
  type SensoryScenePreset,
  type StoryRatio,
  type StorySticker,
} from "../utils/share";

interface ShareComposerProps {
  record: CoffeeShareSourceRecord | null;
  open: boolean;
  onClose: () => void;
  onToast?: (message: string) => void;
  initialLayoutMode?: "card" | "story" | "ai";
}

const CAPTION_TEMPLATE: ShareTemplate = "minimal";

const captionToneOptions: { key: ShareCaptionTone; label: string; description: string }[] = [
  { key: "journal", label: "기록형", description: "담백하게 남기는 커피 로그" },
  { key: "mood", label: "감성형", description: "분위기와 여운을 강조한 문구" },
  { key: "promo", label: "추천형", description: "저장하고 공유하기 좋은 소개형 문구" },
];

const sensorySceneOptions: { key: SensoryScenePreset; label: string; description: string }[] = [
  { key: "auto", label: "Auto", description: "사진과 향미를 보고 자동으로 톤을 맞춥니다." },
  { key: "kenya-clarity", label: "Kenya Clarity", description: "차갑고 또렷한 berry lift" },
  { key: "fruit-bloom", label: "Fruit Bloom", description: "과일 향이 퍼지는 sunset haze" },
  { key: "amber-nectar", label: "Amber Nectar", description: "허니처럼 점도 있는 glow" },
  { key: "velvet-night", label: "Velvet Night", description: "짙은 그림자와 lingering smoke" },
];

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-black/25 px-3 py-1 text-[11px] font-medium tracking-[0.02em] text-coffee-50 backdrop-blur-sm">
      {children}
    </span>
  );
}

export default function ShareComposer({
  record,
  open,
  onClose,
  onToast,
}: ShareComposerProps) {
  const [captionTone, setCaptionTone] = useState<ShareCaptionTone>("journal");
  const [visibility, setVisibility] = useState<ShareVisibility>(DEFAULT_SHARE_VISIBILITY);
  const [storyRatio, setStoryRatio] = useState<StoryRatio>("9:16");
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  const [activeStoryStickerId, setActiveStoryStickerId] = useState<string>("title");
  const [storyScenePreset, setStoryScenePreset] = useState<SensoryScenePreset>("auto");
  const [isBusy, setIsBusy] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const [captionSource, setCaptionSource] = useState<"rule" | "openai">("rule");

  const payload = useMemo(() => (record ? mapRecordToSharePayload(record) : null), [record]);
  const sensoryProfile = useMemo(
    () => (payload ? getSensorySceneProfile(payload, storyScenePreset) : null),
    [payload, storyScenePreset],
  );
  const generatedCaption = useMemo(() => {
    if (!payload) return "";
    return buildShareCaption(payload, visibility, CAPTION_TEMPLATE, captionTone);
  }, [captionTone, payload, visibility]);
  const caption = aiCaption || generatedCaption;

  useEffect(() => {
    setAiCaption(null);
    setCaptionSource("rule");
  }, [generatedCaption]);

  useEffect(() => {
    setVisibility(DEFAULT_SHARE_VISIBILITY);
    setStoryScenePreset("auto");
    setStoryRatio("9:16");
  }, [record?.id]);

  useEffect(() => {
    if (!payload) return;
    setStoryStickers((prev) => syncStoryStickers(prev, payload, visibility));
  }, [payload, visibility]);

  useEffect(() => {
    if (!payload || storyStickers.length === 0) {
      setPreviewImageUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const renderPreview = async () => {
      setIsPreviewRendering(true);
      try {
        const blob = await renderStoryEditorBlob(payload, visibility, storyRatio, storyStickers, storyScenePreset);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return objectUrl;
        });
      } catch {
        if (!cancelled) {
          setPreviewImageUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewRendering(false);
        }
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload, storyRatio, storyScenePreset, storyStickers, visibility]);

  if (!open || !payload) return null;

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
      await downloadStoryEditorImage(
        payload,
        visibility,
        storyRatio,
        storyStickers,
        storyScenePreset,
        `coffee-story-${record?.id || "card"}-${storyRatio.replace(":", "x")}.png`,
      );
      onToast?.("공유 이미지를 저장했어요 💾");
    } finally {
      setIsBusy(false);
    }
  };

  const handleShare = async () => {
    setIsBusy(true);
    try {
      const shared = await shareStoryEditorImage(
        payload,
        visibility,
        storyRatio,
        storyStickers,
        storyScenePreset,
        `coffee-story-${record?.id || "card"}-${storyRatio.replace(":", "x")}.png`,
        caption,
      );
      onToast?.(shared ? "공유 시트를 열었어요 🚀" : "공유 시트를 못 열어서 이미지 저장으로 대체했어요");
    } catch {
      onToast?.("공유를 열지 못했어요");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAiRewrite = async () => {
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
          template: CAPTION_TEMPLATE,
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#2d221d] p-4 pb-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-coffee-light">공유 카드</h3>
            <p className="mt-1 text-sm text-coffee-light/65">
              카드 하나만 보여주고, 여기서 바로 위치와 향미 오버레이를 다듬습니다.
            </p>
          </div>
          <button type="button" className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-coffee-light/75" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-coffee-gold/15 bg-coffee-gold/8 px-4 py-3 text-sm text-coffee-light/80">
          이 카드 한 장이 최종 공유 이미지입니다. 먼저 결과만 보고, 필요할 때만 아래에서 세부 조정을 여세요.
        </div>

        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#1a120e] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs text-coffee-light/58">
              <span>{sensoryProfile?.sceneTitle || "Sensory scene"}</span>
              <span>{storyRatio}</span>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
              {previewImageUrl ? (
                <img src={previewImageUrl} alt={`${payload.title} share preview`} className="w-full object-cover" />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center text-sm text-coffee-light/50">
                  {isPreviewRendering ? "카드 렌더링 중..." : "카드 미리보기를 준비하지 못했습니다."}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">Preview summary</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill>{payload.title}</MetaPill>
            <MetaPill>{payload.cafe || "No cafe"}</MetaPill>
            <MetaPill>{payload.locationLabel || payload.subtitle}</MetaPill>
            <MetaPill>{sensoryProfile?.sceneTitle || sensorySceneOptions.find((option) => option.key === storyScenePreset)?.label}</MetaPill>
          </div>
        </div>

        <details className="mt-5 rounded-2xl border border-white/10 bg-white/5">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-coffee-light">
            세부 조정 열기
          </summary>
          <div className="border-t border-white/10 px-4 pb-4 pt-4">
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
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
          </div>
        </details>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-coffee-light" onClick={handleCopyCaption}>
            캡션 복사
          </button>
          <button
            type="button"
            className="rounded-2xl border border-coffee-gold/30 bg-coffee-gold/10 px-4 py-3 text-sm font-semibold text-coffee-gold disabled:opacity-50"
            onClick={handleDownload}
            disabled={isBusy}
          >
            {isBusy ? "처리 중..." : "이미지 저장"}
          </button>
          <button
            type="button"
            className="rounded-2xl bg-coffee-gold px-4 py-3 text-sm font-semibold text-coffee-dark disabled:opacity-50"
            onClick={handleShare}
            disabled={isBusy}
          >
            {isBusy ? "처리 중..." : "공유하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
