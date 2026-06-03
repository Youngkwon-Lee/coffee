"use client";

import { useMemo, useRef } from "react";
import {
  Bean,
  CalendarDays,
  Eye,
  EyeOff,
  MapPin,
  MessageSquareText,
  Move,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import type {
  SensorySceneProfile,
  SensoryScenePreset,
  SharePayload,
  ShareVisibility,
  StickerScale,
  StickerStyle,
  StoryRatio,
  StorySticker,
} from "../utils/share";
import { createDefaultStoryStickers, getSensorySceneProfile, getSensoryTrailPoints } from "../utils/share";

const ratioOptions: StoryRatio[] = ["9:16", "4:5", "1:1"];
const sensorySceneOptions: { key: SensoryScenePreset; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "kenya-clarity", label: "Kenya Clarity" },
  { key: "fruit-bloom", label: "Fruit Bloom" },
  { key: "amber-nectar", label: "Amber Nectar" },
  { key: "velvet-night", label: "Velvet Night" },
];

const ratioClassMap: Record<StoryRatio, string> = {
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]",
  "1:1": "aspect-square",
};

const widthClassMap: Record<StickerScale, string> = {
  sm: "w-[34%]",
  md: "w-[48%]",
  lg: "w-[70%]",
};

function getStickerWidthClass(sticker: StorySticker) {
  if (sticker.kind === "location" || sticker.kind === "meta" || sticker.kind === "origin") {
    return sticker.scale === "lg" ? "w-[52%]" : sticker.scale === "md" ? "w-[44%]" : "w-[40%]";
  }
  if (sticker.kind === "review") {
    return sticker.scale === "lg" ? "w-[74%]" : sticker.scale === "md" ? "w-[58%]" : "w-[44%]";
  }
  if (sticker.kind === "title") {
    return sticker.scale === "lg" ? "w-[72%]" : sticker.scale === "md" ? "w-[56%]" : "w-[44%]";
  }
  if (sticker.kind === "flavors") {
    return sticker.scale === "lg" ? "w-[84%]" : sticker.scale === "md" ? "w-[68%]" : "w-[52%]";
  }
  return widthClassMap[sticker.scale];
}

const projectionOpacityMap: Record<StickerStyle, string> = {
  glass: "opacity-100",
  solid: "opacity-95",
  outline: "opacity-80",
};

const stickerLabelMap: Record<string, string> = {
  title: "Hero Type",
  score: "Glow Score",
  flavors: "Flavor Path",
  location: "Place Mark",
  meta: "Time Stamp",
  origin: "Scene Note",
  review: "Aftertaste",
};

const stickerIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  title: Bean,
  score: Star,
  flavors: Sparkles,
  location: MapPin,
  meta: CalendarDays,
  origin: Bean,
  review: MessageSquareText,
};

const scaleBounds: Record<StickerScale, { minX: number; maxX: number; minY: number; maxY: number }> = {
  sm: { minX: 10, maxX: 90, minY: 8, maxY: 92 },
  md: { minX: 14, maxX: 86, minY: 10, maxY: 90 },
  lg: { minX: 18, maxX: 82, minY: 12, maxY: 88 },
};

function clampStickerPosition(scale: StickerScale, axis: "x" | "y", value: number) {
  const bounds = scaleBounds[scale];
  if (axis === "x") {
    return Math.min(bounds.maxX, Math.max(bounds.minX, value));
  }
  return Math.min(bounds.maxY, Math.max(bounds.minY, value));
}

function buildHeroWidth(scale: StickerScale) {
  if (scale === "lg") return "text-[1.82rem] leading-[0.94] sm:text-[2.55rem]";
  if (scale === "md") return "text-[1.42rem] leading-[0.96] sm:text-[1.95rem]";
  return "text-[1.15rem] leading-[1.02] sm:text-[1.4rem]";
}

function AtmosphereLayer({ profile }: { profile: SensorySceneProfile }) {
  const [primary, secondary, tertiary] = profile.flavors;
  const particles = getSensoryTrailPoints(profile, 5);

  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,5,5,0.08),rgba(6,5,5,0.12)_36%,rgba(6,5,5,0.56))]" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${profile.baseTint}, rgba(0,0,0,0.08) 38%, ${profile.depthTint})` }} />
      <div
        className="absolute inset-x-[8%] bottom-[8%] h-[32%] rounded-[50%] blur-3xl"
        style={{ background: `radial-gradient(circle, ${profile.horizonGlow} 0%, transparent 72%)` }}
      />
      <div
        className="absolute left-[-8%] top-[16%] h-[34%] w-[52%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${primary?.color ?? "#ff7b9c"}55 0%, transparent 72%)` }}
      />
      <div
        className="absolute right-[-8%] top-[30%] h-[30%] w-[40%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${secondary?.color ?? "#d8a66a"}44 0%, transparent 70%)` }}
      />
      <div
        className="absolute bottom-[12%] left-[18%] h-[26%] w-[54%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${tertiary?.color ?? "#f6dcc4"}38 0%, transparent 72%)` }}
      />
      {particles.map((point, index) => (
        <div
          key={`${point.x}-${point.y}`}
          className="absolute h-2.5 w-2.5 rounded-full blur-[1px]"
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            background: profile.particleAccent,
            boxShadow: `0 0 26px ${profile.particleAccent}`,
            opacity: 0.7 - index * 0.08,
          }}
        />
      ))}
    </>
  );
}

function FlavorPath({
  flavors,
  profile,
}: {
  flavors: string[];
  profile: SensorySceneProfile;
}) {
  const labels = flavors.slice(0, 4);
  const points = getSensoryTrailPoints(profile, Math.max(labels.length, 2));
  const pathWidth = 100;
  const pathHeight = 92;
  const pathD = points
    .map((point, index) => {
      const px = point.x * pathWidth;
      const py = point.y * pathHeight;
      if (index === 0) return `M ${px} ${py}`;
      const prev = points[index - 1];
      const prevX = prev.x * pathWidth;
      const prevY = prev.y * pathHeight;
      const midX = (prevX + px) / 2;
      return `C ${midX} ${prevY}, ${midX} ${py}, ${px} ${py}`;
    })
    .join(" ");

  return (
    <div className="relative min-h-[150px]">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/56">Flavor path</div>
      <div className="relative h-[120px]">
        <svg viewBox="0 0 100 92" className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d={pathD}
            fill="none"
            stroke={`${profile.flavors[0]?.glow ?? "#ff7b9c"}22`}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke={profile.trailStroke}
            strokeWidth="1.9"
            strokeLinecap="round"
            className="drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
          />
        </svg>
        <div
          className="absolute inset-x-[6%] top-[28%] h-[36px] rounded-full blur-2xl"
          style={{ background: `linear-gradient(90deg, ${profile.flavors[0]?.glow ?? "#ff7b9c"}00, ${profile.flavors[0]?.glow ?? "#ff7b9c"}55 24%, ${profile.flavors[1]?.glow ?? "#d8a66a"}45 58%, ${profile.flavors[2]?.glow ?? "#f6dcc4"}00 100%)` }}
        />
        {labels.map((flavor, index) => {
          const tone = profile.flavors[index] || profile.flavors[0];
          const point = points[index] || points[points.length - 1];
          const isUpper = index % 2 === 0;
          return (
            <div
              key={flavor}
              className="absolute -translate-x-1/2"
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
              }}
            >
              <div
                className="mx-auto h-3 w-3 rounded-full shadow-[0_0_24px_rgba(255,255,255,0.28)]"
                style={{ backgroundColor: tone?.glow ?? "#f0b27a" }}
              />
              <div
                className={`min-w-[66px] max-w-[78px] ${isUpper ? "-translate-y-[106%]" : "translate-y-[16px]"}`}
              >
                <div className="text-[12px] font-semibold leading-tight text-white sm:text-[13px]">{flavor}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/42">{profile.atmosphereLabel}</div>
    </div>
  );
}

function StickerOverlay({
  payload,
  visibility,
  sticker,
  isActive,
  profile,
}: {
  payload: SharePayload;
  visibility: ShareVisibility;
  sticker: StorySticker;
  isActive: boolean;
  profile: SensorySceneProfile;
}) {
  const baseClass = `${getStickerWidthClass(sticker)} ${projectionOpacityMap[sticker.style]} ${
    isActive ? "drop-shadow-[0_0_26px_rgba(255,255,255,0.24)]" : "drop-shadow-[0_12px_26px_rgba(0,0,0,0.24)]"
  }`;
  const accent = profile.flavors[0]?.glow ?? "#f0b27a";

  if (sticker.kind === "title") {
    return (
      <div className={`text-white ${baseClass}`}>
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/56">{profile.sceneTitle}</div>
        <div className={`font-cafe-heading ${buildHeroWidth(sticker.scale)}`}>{payload.title}</div>
        <div className="mt-3 max-w-[90%] text-sm text-white/76 sm:text-base">
          {payload.cafe} · {payload.subtitle}
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/46">{profile.sceneNote}</div>
      </div>
    );
  }

  if (sticker.kind === "score") {
    return (
      <div className={`relative ${baseClass}`}>
        <div
          className="absolute inset-[-18%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent}66 0%, transparent 72%)` }}
        />
        <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/16 bg-white/6 text-white backdrop-blur-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/54">Glow score</div>
          <div className="mt-1 text-4xl font-bold">{payload.rating.toFixed(1)}</div>
        </div>
      </div>
    );
  }

  if (sticker.kind === "flavors") {
    return (
      <div className={`text-white ${baseClass}`}>
        <FlavorPath flavors={payload.flavors} profile={profile} />
      </div>
    );
  }

  if (sticker.kind === "meta") {
    return (
      <div className={`text-white ${baseClass}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/46">Time stamp</div>
        <div className="mt-1 whitespace-nowrap border-b border-white/18 pb-2 text-sm font-semibold sm:text-base">{payload.dateLabel}</div>
      </div>
    );
  }

  if (sticker.kind === "location") {
    return (
      <div className={`text-white ${baseClass}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/46">Place mark</div>
        <div className="mt-1 whitespace-nowrap border-b border-white/18 pb-2 text-sm font-semibold sm:text-base">
          {visibility.showLocation ? payload.locationLabel : payload.cafe}
        </div>
      </div>
    );
  }

  if (sticker.kind === "origin") {
    return (
      <div className={`text-white ${baseClass}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/46">Scene note</div>
        <div className="mt-1 whitespace-nowrap border-b border-white/18 pb-2 text-sm font-semibold sm:text-base">
          {[payload.originLabel, payload.roastLabel].filter(Boolean).join(" · ") || profile.atmosphereLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={`text-white ${baseClass}`}>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/46">Aftertaste</div>
      <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-black/18 p-4 backdrop-blur-sm">
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: `linear-gradient(180deg, ${accent}, transparent 92%)` }}
        />
        <p className="line-clamp-4 pl-3 text-[13px] leading-relaxed text-white/88 sm:text-sm">{payload.review}</p>
      </div>
    </div>
  );
}

export default function StoryEditor({
  payload,
  visibility,
  ratio,
  scenePreset,
  stickers,
  activeStickerId,
  onRatioChange,
  onScenePresetChange,
  onStickersChange,
  onActiveStickerChange,
}: {
  payload: SharePayload;
  visibility: ShareVisibility;
  ratio: StoryRatio;
  scenePreset: SensoryScenePreset;
  stickers: StorySticker[];
  activeStickerId: string;
  onRatioChange: (ratio: StoryRatio) => void;
  onScenePresetChange: (preset: SensoryScenePreset) => void;
  onStickersChange: (stickers: StorySticker[]) => void;
  onActiveStickerChange: (stickerId: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ stickerId: string; pointerId: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const profile = useMemo(() => getSensorySceneProfile(payload, scenePreset), [payload, scenePreset]);

  const activeSticker = stickers.find((sticker) => sticker.id === activeStickerId) || stickers[0];
  const ActiveStickerIcon = stickerIconMap[activeSticker?.id] || Move;

  const updateStickerPosition = (stickerId: string, clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const drag = dragRef.current;
    if (!rect || !drag || drag.stickerId !== stickerId) return;
    const draggedSticker = stickers.find((sticker) => sticker.id === stickerId);
    if (!draggedSticker) return;

    const left = clientX - rect.left - drag.offsetX + drag.width / 2;
    const top = clientY - rect.top - drag.offsetY + drag.height / 2;
    const x = (left / rect.width) * 100;
    const y = (top / rect.height) * 100;

    onStickersChange(
      stickers.map((sticker) =>
        sticker.id === stickerId
          ? {
              ...sticker,
              x: clampStickerPosition(draggedSticker.scale, "x", x),
              y: clampStickerPosition(draggedSticker.scale, "y", y),
            }
          : sticker,
      ),
    );
  };

  const updateActiveSticker = (patch: Partial<StorySticker>) => {
    onStickersChange(stickers.map((sticker) => (sticker.id === activeStickerId ? { ...sticker, ...patch } : sticker)));
  };

  const moveActiveSticker = (dx: number, dy: number) => {
    onStickersChange(
      stickers.map((sticker) =>
        sticker.id === activeStickerId
          ? {
              ...sticker,
              x: clampStickerPosition(sticker.scale, "x", sticker.x + dx),
              y: clampStickerPosition(sticker.scale, "y", sticker.y + dy),
            }
          : sticker,
      ),
    );
  };

  const toggleStickerVisibility = (stickerId: string) => {
    onStickersChange(stickers.map((sticker) => (sticker.id === stickerId ? { ...sticker, visible: !sticker.visible } : sticker)));
    onActiveStickerChange(stickerId);
  };

  const resetStoryLayout = () => {
    const defaults = createDefaultStoryStickers(payload, visibility);
    onStickersChange(defaults);
    onActiveStickerChange(defaults[0]?.id || "title");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-coffee-light">Sensory Editor</div>
            <p className="mt-1 text-xs text-coffee-light/60">
              향미를 카드로 나열하지 않고, 공간에 퍼지는 레이어와 투영 타이포로 배치해보세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {ratioOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onRatioChange(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  ratio === option ? "bg-coffee-gold text-coffee-dark" : "bg-white/8 text-coffee-light/70"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={resetStoryLayout}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-coffee-light/75"
            >
              기본 배치로 되돌리기
            </button>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-coffee-light/52">Scene preset</div>
          <div className="flex flex-wrap gap-2">
            {sensorySceneOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onScenePresetChange(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  scenePreset === option.key ? "bg-coffee-gold text-coffee-dark" : "bg-white/8 text-coffee-light/70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`relative mx-auto overflow-hidden rounded-[30px] border border-white/10 bg-[#160f0b] shadow-[0_24px_60px_rgba(0,0,0,0.4)] ${ratioClassMap[ratio]} w-full max-w-[420px] touch-none`}
      >
        <img src={payload.imageUrl} alt={payload.title} className="absolute inset-0 h-full w-full object-cover" />
        <AtmosphereLayer profile={profile} />
        <div className="pointer-events-none absolute inset-[6%] rounded-[28px] border border-dashed border-white/14" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-coffee-50/78 backdrop-blur-sm">
          sensory anchors
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-coffee-50/72 backdrop-blur-sm">
          {profile.atmosphereLabel}
        </div>

        {stickers.filter((sticker) => sticker.visible).map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            onClick={() => onActiveStickerChange(sticker.id)}
            onPointerDown={(event) => {
              const stickerRect = event.currentTarget.getBoundingClientRect();
              dragRef.current = {
                stickerId: sticker.id,
                pointerId: event.pointerId,
                offsetX: event.clientX - stickerRect.left,
                offsetY: event.clientY - stickerRect.top,
                width: stickerRect.width,
                height: stickerRect.height,
              };
              onActiveStickerChange(sticker.id);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!dragRef.current || dragRef.current.stickerId !== sticker.id || dragRef.current.pointerId !== event.pointerId) return;
              updateStickerPosition(sticker.id, event.clientX, event.clientY);
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-left ${
              activeStickerId === sticker.id ? "outline outline-1 outline-coffee-gold/60" : "outline outline-1 outline-transparent"
            } rounded-[26px] p-1`}
            style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}
          >
            <StickerOverlay
              payload={payload}
              visibility={visibility}
              sticker={sticker}
              isActive={activeStickerId === sticker.id}
              profile={profile}
            />
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-coffee-light">레이어 컨트롤</div>
            <p className="mt-1 text-xs text-coffee-light/60">각 anchor는 공간 속 정보의 위치를 정하는 기준점입니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stickers.map((sticker) => {
              const StickerIcon = stickerIconMap[sticker.id] || Move;
              return (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => onActiveStickerChange(sticker.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    activeStickerId === sticker.id
                      ? "bg-coffee-gold text-coffee-dark"
                      : sticker.visible
                        ? "bg-white/8 text-coffee-light/70"
                        : "bg-white/5 text-coffee-light/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <StickerIcon className="h-3.5 w-3.5" />
                    <span>{stickerLabelMap[sticker.id]}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${sticker.visible ? "bg-emerald-300" : "bg-white/25"}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {activeSticker && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-coffee-light">
                  <ActiveStickerIcon className="h-4 w-4 text-coffee-gold" />
                  <span>{stickerLabelMap[activeSticker.id]}</span>
                </div>
                <div className="mt-1 text-xs text-coffee-light/55">
                  {activeSticker.visible ? "현재 공간에 투영되고 있습니다." : "현재 레이어에서 숨겨져 있습니다."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleStickerVisibility(activeSticker.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  activeSticker.visible ? "bg-white/8 text-coffee-light/75" : "bg-coffee-gold/12 text-coffee-gold"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {activeSticker.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{activeSticker.visible ? "숨기기" : "다시 보이기"}</span>
                </span>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">size</div>
                <div className="flex flex-wrap gap-2">
                  {(["sm", "md", "lg"] as StickerScale[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateActiveSticker({ scale: size })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        activeSticker.scale === size ? "bg-coffee-gold text-coffee-dark" : "bg-white/8 text-coffee-light/70"
                      }`}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">projection</div>
                <div className="flex flex-wrap gap-2">
                  {(["glass", "solid", "outline"] as StickerStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => updateActiveSticker({ style })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        activeSticker.style === style ? "bg-coffee-gold text-coffee-dark" : "bg-white/8 text-coffee-light/70"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-coffee-light/55">nudge</div>
              <div className="grid max-w-[180px] grid-cols-3 gap-2 rounded-[22px] border border-white/8 bg-black/10 p-3">
                <div />
                <button type="button" onClick={() => moveActiveSticker(0, -2)} className="rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-coffee-light/75">
                  ↑
                </button>
                <div />
                <button type="button" onClick={() => moveActiveSticker(-2, 0)} className="rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-coffee-light/75">
                  ←
                </button>
                <button type="button" onClick={resetStoryLayout} className="rounded-xl bg-white/5 px-3 py-2 text-[11px] font-semibold text-coffee-light/60">
                  <RotateCcw className="mx-auto h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveActiveSticker(2, 0)} className="rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-coffee-light/75">
                  →
                </button>
                <div />
                <button type="button" onClick={() => moveActiveSticker(0, 2)} className="rounded-xl bg-white/8 px-3 py-2 text-sm font-semibold text-coffee-light/75">
                  ↓
                </button>
                <div />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-coffee-light/45">
                <Move className="h-3.5 w-3.5" />
                <span>감각 레이어는 drag로, 세밀한 정렬은 방향 패드로 맞추면 편합니다.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-coffee-gold/25 bg-coffee-gold/5 p-4 text-xs leading-relaxed text-coffee-light/65">
        Sensory 모드는 정보를 카드로 얹는 대신 배경의 공기, 향의 흐름, 잔향 텍스트가 함께 존재하도록 만드는 메인 경험입니다.
      </div>
    </div>
  );
}
