import { Timestamp } from "firebase/firestore";

export type ShareTemplate = "minimal" | "editorial" | "strava";
export type ShareCaptionTone = "journal" | "mood" | "promo";

export interface CoffeeShareSourceRecord {
  id: string;
  bean?: string;
  beanName?: string;
  cafe?: string;
  flavor?: string | string[];
  flavors?: string[];
  rating?: number;
  brewMethod?: string;
  processing?: string;
  createdAt?: string | Timestamp;
  imageUrl?: string;
  review?: string;
  notes?: string;
  origin?: string;
  roastLevel?: string;
  locationLabel?: string;
}

export interface ShareVisibility {
  showReview: boolean;
  showFlavors: boolean;
  showRating: boolean;
  showDate: boolean;
  showLocation: boolean;
}

export interface SharePayload {
  title: string;
  cafe: string;
  subtitle: string;
  rating: number;
  flavors: string[];
  review: string;
  imageUrl: string;
  dateLabel: string;
  locationLabel: string;
  methodLabel: string;
  originLabel: string;
  roastLabel: string;
}

export interface SensoryFlavorNode {
  label: string;
  color: string;
  glow: string;
  mist: string;
}

export interface SensorySceneProfile {
  sceneTitle: string;
  sceneNote: string;
  atmosphereLabel: string;
  baseTint: string;
  depthTint: string;
  steamTint: string;
  typographyTint: string;
  trailStroke: string;
  horizonGlow: string;
  particleAccent: string;
  trailMode: "clarity" | "bloom" | "nectar" | "velvet";
  flavors: SensoryFlavorNode[];
}

export interface SensoryTrailPoint {
  x: number;
  y: number;
}

export type SensoryScenePreset = "auto" | "kenya-clarity" | "fruit-bloom" | "amber-nectar" | "velvet-night";

export type StoryRatio = "9:16" | "4:5" | "1:1";
export type StickerKind = "title" | "score" | "flavors" | "meta" | "review" | "origin" | "location";
export type StickerScale = "sm" | "md" | "lg";
export type StickerStyle = "glass" | "solid" | "outline";

export interface StorySticker {
  id: string;
  kind: StickerKind;
  x: number;
  y: number;
  scale: StickerScale;
  style: StickerStyle;
  visible: boolean;
}

export const DEFAULT_SHARE_VISIBILITY: ShareVisibility = {
  showReview: true,
  showFlavors: true,
  showRating: true,
  showDate: true,
  showLocation: true,
};

const STORY_RATIO_DIMENSIONS: Record<StoryRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(createdAt?: string | Timestamp) {
  if (!createdAt) return "오늘의 커피 기록";
  const date = createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt);

  if (Number.isNaN(date.getTime())) return "오늘의 커피 기록";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function mapRecordToSharePayload(record: CoffeeShareSourceRecord): SharePayload {
  const title = record.bean?.trim() || record.beanName?.trim() || "오늘의 커피";
  const cafe = record.cafe?.trim() || "나의 커피 로그";
  const review = record.review?.trim() || record.notes?.trim() || "";
  const baseFlavors = Array.isArray(record.flavor)
    ? record.flavor
    : typeof record.flavor === "string"
      ? record.flavor.split(",").map((item) => item.trim())
      : record.flavors || [];

  const flavors = baseFlavors.filter(Boolean).slice(0, 4);
  const methodLabel = record.brewMethod?.trim() || record.processing?.trim() || "Coffee Journal";
  const dateLabel = formatDate(record.createdAt);
  const locationLabel = record.locationLabel?.trim() || cafe;
  const originLabel = record.origin?.trim() || "";
  const roastLabel = record.roastLevel?.trim() || "";

  return {
    title,
    cafe,
    subtitle: methodLabel,
    rating: record.rating || 0,
    flavors,
    review,
    imageUrl: record.imageUrl || FALLBACK_IMAGE,
    dateLabel,
    locationLabel,
    methodLabel,
    originLabel,
    roastLabel,
  };
}

export function createDefaultStoryStickers(payload: SharePayload, visibility: ShareVisibility): StorySticker[] {
  return [
    { id: "title", kind: "title", x: 35, y: 25, scale: "lg", style: "glass", visible: true },
    { id: "score", kind: "score", x: 82, y: 76, scale: "md", style: "solid", visible: visibility.showRating && payload.rating > 0 },
    { id: "flavors", kind: "flavors", x: 50, y: 57, scale: "lg", style: "glass", visible: visibility.showFlavors && payload.flavors.length > 0 },
    { id: "location", kind: "location", x: 21, y: 12, scale: "sm", style: "outline", visible: true },
    { id: "meta", kind: "meta", x: 80, y: 11, scale: "sm", style: "outline", visible: visibility.showDate },
    { id: "origin", kind: "origin", x: 23, y: 78, scale: "sm", style: "glass", visible: Boolean(payload.originLabel || payload.roastLabel) },
    { id: "review", kind: "review", x: 40, y: 87, scale: "md", style: "glass", visible: visibility.showReview && Boolean(payload.review) },
  ];
}

function normalizeVisualToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildFlavorNode(label: string): SensoryFlavorNode {
  const token = normalizeVisualToken(label);

  if (/(raspberry|cranberry|berry|strawberry|cherry)/.test(token)) {
    return { label, color: "#ff7b9c", glow: "#ff4f7d", mist: "berry mist" };
  }
  if (/(black tea|tea|oolong|earl grey|bergamot)/.test(token)) {
    return { label, color: "#d8a66a", glow: "#b86a28", mist: "amber tea vapor" };
  }
  if (/(silky|cream|creamy|milk|velvet|smooth)/.test(token)) {
    return { label, color: "#f6dcc4", glow: "#e8c39b", mist: "cream glow" };
  }
  if (/(citrus|orange|grapefruit|lemon|lime)/.test(token)) {
    return { label, color: "#ffd36e", glow: "#ffb347", mist: "citrus flare" };
  }
  if (/(floral|jasmine|rose|lavender|violet)/.test(token)) {
    return { label, color: "#d9a8ff", glow: "#b06aff", mist: "floral haze" };
  }
  if (/(chocolate|cacao|cocoa|nut|almond|hazelnut)/.test(token)) {
    return { label, color: "#b98863", glow: "#825236", mist: "cocoa warmth" };
  }

  return { label, color: "#f2c79b", glow: "#cb8650", mist: "aroma trail" };
}

export function getSensorySceneProfile(
  payload: SharePayload,
  preset: SensoryScenePreset = "auto",
): SensorySceneProfile {
  const methodToken = normalizeVisualToken(payload.methodLabel || payload.subtitle || "");
  const originToken = normalizeVisualToken(payload.originLabel || "");
  const roastToken = normalizeVisualToken(payload.roastLabel || "");
  const flavorNodes = (payload.flavors.length > 0 ? payload.flavors : [payload.subtitle || payload.title])
    .filter(Boolean)
    .slice(0, 4)
    .map((flavor) => buildFlavorNode(flavor));

  let sceneTitle = "Lingering coffee atmosphere";
  let sceneNote = "Taste suspended in warm light";
  let atmosphereLabel = "diffused aroma field";
  let baseTint = "rgba(14, 10, 8, 0.18)";
  let depthTint = "rgba(7, 5, 5, 0.64)";
  let steamTint = "rgba(255, 226, 197, 0.32)";
  const typographyTint = "#f9efe4";
  let trailStroke = flavorNodes[0]?.glow || "#f0b27a";
  let horizonGlow = "rgba(255, 176, 120, 0.18)";
  let particleAccent = "#ffb788";
  let trailMode: SensorySceneProfile["trailMode"] = "velvet";

  if (methodToken.includes("washed")) {
    sceneTitle = "Kenya washed clarity";
    sceneNote = "Cool light, reflective air, clean finish";
    atmosphereLabel = "bright reflective wash";
    baseTint = "rgba(125, 160, 171, 0.16)";
    depthTint = "rgba(10, 9, 14, 0.56)";
    steamTint = "rgba(230, 245, 255, 0.28)";
    trailStroke = flavorNodes[0]?.glow || "#ff7b9c";
    horizonGlow = "rgba(149, 210, 255, 0.14)";
    particleAccent = "#d8f0ff";
    trailMode = "clarity";
  } else if (methodToken.includes("natural")) {
    sceneTitle = "Fruit bloom atmosphere";
    sceneNote = "Sun-warm haze with syrupy diffusion";
    atmosphereLabel = "sunset fruit bloom";
    baseTint = "rgba(143, 57, 45, 0.18)";
    depthTint = "rgba(24, 10, 10, 0.58)";
    steamTint = "rgba(255, 208, 148, 0.28)";
    horizonGlow = "rgba(255, 120, 120, 0.14)";
    particleAccent = "#ff91c3";
    trailMode = "bloom";
  } else if (methodToken.includes("honey")) {
    sceneTitle = "Honeyed amber flow";
    sceneNote = "Glossy sweetness with glowing edges";
    atmosphereLabel = "amber nectar field";
    baseTint = "rgba(167, 111, 38, 0.18)";
    depthTint = "rgba(26, 15, 7, 0.58)";
    steamTint = "rgba(255, 220, 166, 0.3)";
    horizonGlow = "rgba(255, 193, 94, 0.16)";
    particleAccent = "#ffd068";
    trailMode = "nectar";
  }

  if (originToken.includes("ethiopia")) {
    sceneTitle = "Ethiopia bloom";
    sceneNote = "Floral lift with dreamy fruit diffusion";
    atmosphereLabel = "floral fruit drift";
    baseTint = "rgba(134, 72, 118, 0.18)";
    depthTint = "rgba(19, 8, 20, 0.58)";
    steamTint = "rgba(255, 195, 228, 0.28)";
    horizonGlow = "rgba(196, 118, 255, 0.15)";
    particleAccent = "#e9a8ff";
    trailMode = "bloom";
  } else if (originToken.includes("colombia")) {
    sceneTitle = "Colombia soft glow";
    sceneNote = "Elegant sweetness with polished depth";
    atmosphereLabel = "rose-gold diffusion";
    baseTint = "rgba(160, 101, 74, 0.17)";
    horizonGlow = "rgba(255, 170, 112, 0.14)";
    particleAccent = "#ffb18d";
  } else if (originToken.includes("kenya")) {
    sceneTitle = "Kenya bright finish";
    sceneNote = "Crisp acidity with vivid berry lift";
    atmosphereLabel = "high-clarity berry trail";
    particleAccent = "#ff7b9c";
    trailMode = "clarity";
  }

  if (roastToken.includes("light")) {
    sceneNote = `${sceneNote.split(".")[0]}. Crisp, lifted, transparent`;
    steamTint = "rgba(250, 246, 238, 0.3)";
  } else if (roastToken.includes("medium")) {
    sceneNote = `${sceneNote.split(".")[0]}. Balanced glow with soft depth`;
  } else if (roastToken.includes("dark")) {
    sceneNote = `${sceneNote.split(".")[0]}. Deeper shadows and cocoa warmth`;
    depthTint = "rgba(8, 5, 4, 0.68)";
    horizonGlow = "rgba(141, 83, 54, 0.18)";
    particleAccent = "#b88057";
    trailMode = "nectar";
  }

  const profile: SensorySceneProfile = {
    sceneTitle,
    sceneNote,
    atmosphereLabel,
    baseTint,
    depthTint,
    steamTint,
    typographyTint,
    trailStroke,
    horizonGlow,
    particleAccent,
    trailMode,
    flavors: flavorNodes,
  };

  if (preset === "kenya-clarity") {
    return {
      ...profile,
      sceneTitle: "Kenya bright finish",
      sceneNote: "Crisp acidity with lifted berry clarity and reflective air",
      atmosphereLabel: "high-clarity berry trail",
      baseTint: "rgba(125, 160, 171, 0.16)",
      depthTint: "rgba(10, 9, 14, 0.56)",
      steamTint: "rgba(230, 245, 255, 0.28)",
      trailStroke: profile.flavors[0]?.glow || "#ff7b9c",
      horizonGlow: "rgba(149, 210, 255, 0.14)",
      particleAccent: "#d8f0ff",
      trailMode: "clarity",
    };
  }

  if (preset === "fruit-bloom") {
    return {
      ...profile,
      sceneTitle: "Fruit bloom atmosphere",
      sceneNote: "Sun-warm haze with floral fruit diffusion and soft lift",
      atmosphereLabel: "sunset fruit bloom",
      baseTint: "rgba(143, 57, 45, 0.18)",
      depthTint: "rgba(24, 10, 10, 0.58)",
      steamTint: "rgba(255, 208, 148, 0.28)",
      trailStroke: profile.flavors[0]?.glow || "#ff7b9c",
      horizonGlow: "rgba(255, 120, 120, 0.14)",
      particleAccent: "#ff91c3",
      trailMode: "bloom",
    };
  }

  if (preset === "amber-nectar") {
    return {
      ...profile,
      sceneTitle: "Honeyed amber flow",
      sceneNote: "Glossy sweetness with honey glow and syrupy motion",
      atmosphereLabel: "amber nectar field",
      baseTint: "rgba(167, 111, 38, 0.18)",
      depthTint: "rgba(26, 15, 7, 0.58)",
      steamTint: "rgba(255, 220, 166, 0.3)",
      trailStroke: profile.flavors[0]?.glow || "#ffb347",
      horizonGlow: "rgba(255, 193, 94, 0.16)",
      particleAccent: "#ffd068",
      trailMode: "nectar",
    };
  }

  if (preset === "velvet-night") {
    return {
      ...profile,
      sceneTitle: "Velvet night roast",
      sceneNote: "Deeper shadows, cocoa warmth, and lingering smoke",
      atmosphereLabel: "velvet roast afterglow",
      baseTint: "rgba(71, 42, 35, 0.18)",
      depthTint: "rgba(7, 5, 5, 0.72)",
      steamTint: "rgba(255, 223, 198, 0.2)",
      trailStroke: profile.flavors[0]?.glow || "#b88057",
      horizonGlow: "rgba(141, 83, 54, 0.18)",
      particleAccent: "#b88057",
      trailMode: "velvet",
    };
  }

  return profile;
}

export function getSensoryTrailPoints(profile: SensorySceneProfile, count: number) {
  const templates: Record<SensorySceneProfile["trailMode"], SensoryTrailPoint[]> = {
    clarity: [
      { x: 0.05, y: 0.58 },
      { x: 0.32, y: 0.7 },
      { x: 0.64, y: 0.6 },
      { x: 0.92, y: 0.52 },
    ],
    bloom: [
      { x: 0.06, y: 0.64 },
      { x: 0.31, y: 0.48 },
      { x: 0.61, y: 0.7 },
      { x: 0.9, y: 0.5 },
    ],
    nectar: [
      { x: 0.06, y: 0.62 },
      { x: 0.33, y: 0.72 },
      { x: 0.62, y: 0.66 },
      { x: 0.91, y: 0.6 },
    ],
    velvet: [
      { x: 0.06, y: 0.62 },
      { x: 0.33, y: 0.66 },
      { x: 0.63, y: 0.62 },
      { x: 0.92, y: 0.56 },
    ],
  };

  const source = templates[profile.trailMode];
  if (count <= source.length) {
    return source.slice(0, count);
  }

  const points: SensoryTrailPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    const scaled = t * (source.length - 1);
    const baseIndex = Math.floor(scaled);
    const nextIndex = Math.min(source.length - 1, baseIndex + 1);
    const localT = scaled - baseIndex;
    const start = source[baseIndex];
    const end = source[nextIndex];
    points.push({
      x: start.x + (end.x - start.x) * localT,
      y: start.y + (end.y - start.y) * localT,
    });
  }
  return points;
}

export function syncStoryStickers(
  current: StorySticker[] | null | undefined,
  payload: SharePayload,
  visibility: ShareVisibility,
) {
  const defaults = createDefaultStoryStickers(payload, visibility);
  if (!current || current.length === 0) {
    return defaults;
  }

  const currentMap = new Map(current.map((sticker) => [sticker.id, sticker]));
  return defaults.map((sticker) => {
    const existing = currentMap.get(sticker.id);
    return existing
      ? {
          ...sticker,
          x: existing.x,
          y: existing.y,
          scale: existing.scale,
          style: existing.style,
        }
      : sticker;
  });
}

function buildJournalCaption(payload: SharePayload, visibility: ShareVisibility, template: ShareTemplate) {
  const lines: string[] = [];
  lines.push(`${payload.cafe}에서 마신 ${payload.title}`);

  if (visibility.showRating && payload.rating > 0) {
    lines.push(`평점 ${payload.rating.toFixed(1)} / 5.0`);
  }

  if (visibility.showFlavors && payload.flavors.length > 0) {
    lines.push(`향미: ${payload.flavors.join(", ")}`);
  }

  if (payload.originLabel) {
    lines.push(`Origin: ${payload.originLabel}`);
  }

  if (visibility.showReview && payload.review) {
    lines.push(payload.review);
  }

  if (visibility.showDate) {
    lines.push(payload.dateLabel);
  }

  lines.push(`#coffee #coffejournal #${template}`);
  return lines.join("\n");
}

function buildMoodCaption(payload: SharePayload, visibility: ShareVisibility, template: ShareTemplate) {
  const lines: string[] = [];
  const leadFlavor = payload.flavors[0];

  lines.push(`${payload.title}, 오늘은 이 한 잔.`);

  if (leadFlavor && visibility.showFlavors) {
    lines.push(`${leadFlavor}부터 시작해서 ${payload.flavors.slice(1, 3).join(", ") || payload.subtitle}로 이어지는 무드.`);
  } else {
    lines.push(`${payload.cafe}에서 만난 ${payload.subtitle} 한 잔.`);
  }

  if (visibility.showReview && payload.review) {
    lines.push(payload.review);
  }

  if (visibility.showLocation) {
    lines.push(payload.locationLabel);
  } else {
    lines.push(payload.cafe);
  }

  if (visibility.showDate) {
    lines.push(payload.dateLabel);
  }

  lines.push(`#coffee #dailybrew #${template}`);
  return lines.join("\n");
}

function buildPromoCaption(payload: SharePayload, visibility: ShareVisibility, template: ShareTemplate) {
  const lines: string[] = [];
  lines.push(`${payload.cafe}에서 ${payload.title} 마셔봤어요.`);

  if (visibility.showRating && payload.rating > 0) {
    lines.push(`체감 평점은 ${payload.rating.toFixed(1)} / 5.0`);
  }

  if (visibility.showFlavors && payload.flavors.length > 0) {
    lines.push(`추천 포인트: ${payload.flavors.join(", ")}`);
  }

  if (payload.originLabel || payload.methodLabel) {
    const detail = [payload.originLabel, payload.methodLabel].filter(Boolean).join(" · ");
    lines.push(detail);
  }

  if (visibility.showReview && payload.review) {
    lines.push(`한 줄 메모: ${payload.review}`);
  }

  lines.push(`커피 좋아하시면 저장해두고 다음에 한 번 드셔보세요.`);
  lines.push(`#카페추천 #원두기록 #${template}`);
  return lines.join("\n");
}

export function buildShareCaption(
  payload: SharePayload,
  visibility: ShareVisibility,
  template: ShareTemplate,
  tone: ShareCaptionTone = "journal",
) {
  switch (tone) {
    case "mood":
      return buildMoodCaption(payload, visibility, template);
    case "promo":
      return buildPromoCaption(payload, visibility, template);
    case "journal":
    default:
      return buildJournalCaption(payload, visibility, template);
  }
}

function renderStars(rating: number) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

function buildFlavorPanelSvg(payload: SharePayload) {
  const topFlavors = payload.flavors.slice(0, 3);
  const leadFlavor = escapeXml(topFlavors[0] || "Tasting notes");
  const flavorNodes = topFlavors.slice(1).map((flavor, index) => {
    const x = 52 + index * 198;
    const y = 124;
    return `
      <rect x="${x}" y="${y}" width="186" height="30" rx="15" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.08)"/>
      <text x="${x + 18}" y="${y + 20}" font-size="15" fill="#f6e7d5" font-family="Arial, sans-serif">${escapeXml(flavor)}</text>`;
  }).join("");

  const meta = [
    { label: "Origin", value: payload.originLabel },
    { label: "Roast", value: payload.roastLabel },
    { label: "Method", value: payload.methodLabel },
  ].filter((item) => item.value);

  const metaNodes = meta.map((item, index) => {
    const x = 28 + index * 284;
    return `
      <rect x="${x}" y="146" width="256" height="54" rx="18" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.06)"/>
      <text x="${x + 18}" y="166" font-size="12" letter-spacing="2.2" fill="rgba(246,231,213,0.48)" font-family="Arial, sans-serif">${item.label.toUpperCase()}</text>
      <text x="${x + 18}" y="189" font-size="18" fill="#f6e7d5" font-family="Arial, sans-serif">${escapeXml(item.value)}</text>`;
  }).join("");

  return `
    <g transform="translate(88 344)">
      <rect width="904" height="242" rx="28" fill="rgba(13,9,7,0.68)" stroke="rgba(255,255,255,0.08)" />
      <rect width="904" height="242" rx="28" fill="url(#panelGlow)" opacity="0.92" />
      <rect x="28" y="24" width="176" height="34" rx="17" fill="rgba(0,0,0,0.28)"/>
      <text x="50" y="46" font-size="16" font-weight="700" letter-spacing="3.2" fill="#dcc4a5" font-family="Arial, sans-serif">FLAVOR FOCUS</text>
      <text x="752" y="46" font-size="13" letter-spacing="2.4" fill="rgba(246,231,213,0.56)" font-family="Arial, sans-serif">COFFEE PROFILE</text>
      <rect x="28" y="68" width="360" height="64" rx="22" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.06)"/>
      <text x="52" y="92" font-size="12" letter-spacing="2.2" fill="rgba(246,231,213,0.42)" font-family="Arial, sans-serif">TOP NOTE</text>
      <text x="52" y="117" font-size="28" font-weight="700" fill="#f6e7d5" font-family="Arial, sans-serif">${leadFlavor}</text>
      ${flavorNodes || `<rect x="52" y="124" width="186" height="30" rx="15" fill="rgba(255,255,255,0.08)"/><text x="70" y="144" font-size="15" fill="#f6e7d5" font-family="Arial, sans-serif">add more tasting notes</text>`}
      ${metaNodes}
      <text x="28" y="234" font-size="14" fill="rgba(246,231,213,0.56)" font-family="Arial, sans-serif">taste-first card</text>
      <rect x="736" y="212" width="140" height="24" rx="12" fill="rgba(255,255,255,0.08)"/>
      <text x="758" y="228" font-size="13" fill="#f6e7d5" font-family="Arial, sans-serif">notes over location</text>
    </g>`;
}

export function renderShareCardSvg(
  payload: SharePayload,
  template: ShareTemplate,
  visibility: ShareVisibility,
) {
  const width = 1080;
  const height = 1350;
  const title = escapeXml(payload.title);
  const cafe = escapeXml(payload.cafe);
  const subtitle = escapeXml(payload.subtitle);
  const review = escapeXml(payload.review || "");
  const dateLabel = escapeXml(payload.dateLabel);
  const locationLabel = escapeXml(payload.locationLabel);
  const flavorText = escapeXml(payload.flavors.join(" • "));
  const stars = escapeXml(renderStars(payload.rating));
  const safeImage = escapeXml(payload.imageUrl);
  const originLabel = escapeXml(payload.originLabel);
  const roastLabel = escapeXml(payload.roastLabel);

  const footerMeta = [
    visibility.showDate ? dateLabel : "",
    visibility.showLocation ? locationLabel : "",
  ].filter(Boolean).join("  ·  ");

  if (template === "editorial") {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f7f0e8" />
      <stop offset="100%" stop-color="#eadcc8" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="72" y="72" width="936" height="720" rx="52" fill="#2f221b" />
  <image href="${safeImage}" x="72" y="72" width="936" height="720" preserveAspectRatio="xMidYMid slice" />
  <rect x="72" y="72" width="936" height="720" rx="52" fill="rgba(20,15,10,0.16)" />
  <rect x="88" y="102" width="170" height="42" rx="21" fill="rgba(246,239,231,0.9)" />
  <text x="120" y="130" font-size="22" fill="#7b5f49" font-family="Arial, sans-serif">${visibility.showLocation ? locationLabel : cafe}</text>
  <text x="88" y="930" font-size="32" fill="#8e6a4b" font-family="Georgia, serif">Coffee Review</text>
  <text x="88" y="1000" font-size="64" font-weight="700" fill="#2f221b" font-family="Georgia, serif">${title}</text>
  <text x="88" y="1055" font-size="34" fill="#5f4938" font-family="Arial, sans-serif">${cafe} · ${subtitle}</text>
  ${visibility.showRating ? `<text x="88" y="1110" font-size="34" fill="#c58b3c" font-family="Arial, sans-serif">${stars}</text>` : ""}
  ${visibility.showFlavors && flavorText ? `<text x="88" y="1170" font-size="28" fill="#6f5947" font-family="Arial, sans-serif">${flavorText}</text>` : ""}
  ${originLabel ? `<text x="88" y="1210" font-size="24" fill="#8f7866" font-family="Arial, sans-serif">Origin · ${originLabel}${roastLabel ? `  /  Roast · ${roastLabel}` : ""}</text>` : roastLabel ? `<text x="88" y="1210" font-size="24" fill="#8f7866" font-family="Arial, sans-serif">Roast · ${roastLabel}</text>` : ""}
  ${visibility.showReview && review ? `<foreignObject x="88" y="1238" width="900" height="84"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #3a2b20; font-size: 28px; line-height: 1.45;">${review}</div></foreignObject>` : ""}
  <text x="88" y="1290" font-size="24" fill="#8f7866" font-family="Arial, sans-serif">${escapeXml(footerMeta)}</text>
</svg>`.trim();
  }

  if (template === "strava") {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="panelGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.10)" />
      <stop offset="100%" stop-color="rgba(197,139,60,0.12)" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#241914" />
  <image href="${safeImage}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="1080" height="1350" fill="rgba(0,0,0,0.28)" />
  <rect x="56" y="72" width="968" height="1206" rx="48" fill="rgba(28,18,14,0.44)" stroke="rgba(255,255,255,0.12)" />
  <rect x="88" y="106" width="210" height="48" rx="24" fill="rgba(19,12,9,0.58)" />
  <text x="124" y="138" font-size="24" fill="#f1dfc2" font-family="Arial, sans-serif">${visibility.showLocation ? locationLabel : cafe}</text>
  <text x="88" y="220" font-size="60" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">${title}</text>
  <text x="88" y="274" font-size="30" fill="#f0d7b1" font-family="Arial, sans-serif">${cafe}</text>
  ${buildFlavorPanelSvg(payload)}
  <rect x="88" y="980" width="904" height="240" rx="32" fill="rgba(17,11,8,0.72)" />
  <text x="128" y="1052" font-size="26" fill="#bfa58b" font-family="Arial, sans-serif">${subtitle}</text>
  ${visibility.showRating ? `<text x="128" y="1114" font-size="54" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">${payload.rating.toFixed(1)}</text><text x="262" y="1114" font-size="28" fill="#c6aa88" font-family="Arial, sans-serif">/ 5.0</text>` : ""}
  ${visibility.showFlavors && flavorText ? `<text x="128" y="1168" font-size="28" fill="#f5e1c9" font-family="Arial, sans-serif">${flavorText}</text>` : ""}
  ${originLabel ? `<text x="128" y="1206" font-size="24" fill="#ceb393" font-family="Arial, sans-serif">${originLabel}${roastLabel ? `  ·  ${roastLabel}` : ""}</text>` : roastLabel ? `<text x="128" y="1206" font-size="24" fill="#ceb393" font-family="Arial, sans-serif">${roastLabel}</text>` : ""}
  ${visibility.showReview && review ? `<foreignObject x="128" y="1222" width="824" height="86"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #f8efe4; font-size: 26px; line-height: 1.4;">${review}</div></foreignObject>` : ""}
  <text x="128" y="1264" font-size="24" fill="#bfa58b" font-family="Arial, sans-serif">${escapeXml(footerMeta)}</text>
</svg>`.trim();
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#281d17" />
  <image href="${safeImage}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="1080" height="1350" fill="rgba(20,12,8,0.18)" />
  <rect x="72" y="88" width="188" height="44" rx="22" fill="rgba(22,14,11,0.45)" />
  <text x="106" y="117" font-size="22" fill="#f2e4d1" font-family="Arial, sans-serif">${visibility.showLocation ? locationLabel : cafe}</text>
  <rect x="56" y="898" width="968" height="340" rx="42" fill="rgba(36,24,19,0.8)" />
  <text x="96" y="980" font-size="56" font-weight="700" fill="#fff7f0" font-family="Georgia, serif">${title}</text>
  <text x="96" y="1028" font-size="30" fill="#e5c8a6" font-family="Arial, sans-serif">${cafe} · ${subtitle}</text>
  ${visibility.showRating ? `<text x="96" y="1078" font-size="32" fill="#c58b3c" font-family="Arial, sans-serif">${stars}</text>` : ""}
  ${visibility.showFlavors && flavorText ? `<text x="96" y="1130" font-size="26" fill="#f4dfc4" font-family="Arial, sans-serif">${flavorText}</text>` : ""}
  ${originLabel ? `<text x="96" y="1170" font-size="24" fill="#d0b392" font-family="Arial, sans-serif">${originLabel}${roastLabel ? `  ·  ${roastLabel}` : ""}</text>` : roastLabel ? `<text x="96" y="1170" font-size="24" fill="#d0b392" font-family="Arial, sans-serif">${roastLabel}</text>` : ""}
  ${visibility.showReview && review ? `<foreignObject x="96" y="1194" width="888" height="84"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #f8efe4; font-size: 26px; line-height: 1.42;">${review}</div></foreignObject>` : ""}
  <text x="96" y="1216" font-size="24" fill="#bba089" font-family="Arial, sans-serif">${escapeXml(footerMeta)}</text>
</svg>`.trim();
}

export async function downloadShareCard(svg: string, fileName: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareShareCard(svg: string, fileName: string, text: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const file = new File([blob], fileName, { type: "image/svg+xml" });

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      text,
      files: [file],
      title: fileName,
    });
    return true;
  }

  await downloadShareCard(svg, fileName);
  return false;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => `${char}${char}`).join("")
    : value;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawProjectionLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options?: {
    font?: string;
    color?: string;
    accent?: string;
    uppercase?: boolean;
  },
) {
  const {
    font = "600 24px sans-serif",
    color = "#f8efe4",
    accent = "rgba(255,255,255,0.22)",
    uppercase = false,
  } = options || {};
  const label = uppercase ? text.toUpperCase() : text;

  ctx.save();
  ctx.font = font;
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
  const width = ctx.measureText(label).width;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.lineTo(x + Math.min(width + 24, 220), y + 12);
  ctx.stroke();
  ctx.restore();
}

function drawSteamField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: SensorySceneProfile,
) {
  ctx.save();
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, profile.baseTint);
  base.addColorStop(0.42, "rgba(0,0,0,0.08)");
  base.addColorStop(1, profile.depthTint);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const horizon = ctx.createRadialGradient(width * 0.5, height * 0.84, 0, width * 0.5, height * 0.84, width * 0.42);
  horizon.addColorStop(0, profile.horizonGlow);
  horizon.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, 0, width, height);

  profile.flavors.forEach((flavor, index) => {
    const glowX = width * (0.18 + index * 0.2);
    const glowY = height * (0.28 + index * 0.12);
    const radius = width * (0.2 + index * 0.03);
    const gradient = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, radius);
    gradient.addColorStop(0, hexToRgba(flavor.color, 0.34));
    gradient.addColorStop(0.45, hexToRgba(flavor.glow, 0.18));
    gradient.addColorStop(1, hexToRgba(flavor.glow, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(glowX, glowY, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  getSensoryTrailPoints(profile, 5).forEach((point, index) => {
    const px = point.x * width;
    const py = point.y * height;
    const particle = ctx.createRadialGradient(px, py, 0, px, py, width * 0.035);
    particle.addColorStop(0, hexToRgba(profile.particleAccent, 0.58 - index * 0.06));
    particle.addColorStop(1, hexToRgba(profile.particleAccent, 0));
    ctx.fillStyle = particle;
    ctx.beginPath();
    ctx.arc(px, py, width * 0.03, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawFlavorTrail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  profile: SensorySceneProfile,
) {
  const flavors = profile.flavors;
  if (flavors.length === 0) return;
  const points = getSensoryTrailPoints(profile, flavors.length).map((point) => ({
    x: x + point.x * width,
    y: y - 14 + point.y * 92,
  }));

  ctx.save();
  ctx.strokeStyle = hexToRgba(profile.flavors[0]?.glow || "#f0b27a", 0.26);
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.shadowColor = hexToRgba(profile.flavors[0]?.glow || "#f0b27a", 0.42);
  ctx.shadowBlur = 26;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    const previous = points[index - 1];
    const midX = (previous.x + point.x) / 2;
    ctx.bezierCurveTo(midX, previous.y, midX, point.y, point.x, point.y);
  });
  ctx.stroke();

  ctx.strokeStyle = profile.trailStroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    const previous = points[index - 1];
    const midX = (previous.x + point.x) / 2;
    ctx.bezierCurveTo(midX, previous.y, midX, point.y, point.x, point.y);
  });
  ctx.stroke();

  flavors.forEach((flavor, index) => {
    const px = points[index]?.x ?? points[points.length - 1].x;
    const py = points[index]?.y ?? points[points.length - 1].y;

    const bubble = ctx.createRadialGradient(px, py, 0, px, py, 56);
    bubble.addColorStop(0, hexToRgba(flavor.color, 0.46));
    bubble.addColorStop(0.45, hexToRgba(flavor.glow, 0.2));
    bubble.addColorStop(1, hexToRgba(flavor.glow, 0));
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(px, py, 56, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = profile.typographyTint;
    ctx.font = "700 24px sans-serif";
    ctx.fillText(flavor.label, px - 18, py + (index % 2 === 0 ? -28 : 44));
    ctx.fillStyle = "rgba(249,239,228,0.46)";
    ctx.font = "500 16px sans-serif";
    ctx.fillText(flavor.mist.toUpperCase(), px - 18, py + (index % 2 === 0 ? -2 : 66));
  });

  ctx.fillStyle = "rgba(249,239,228,0.72)";
  ctx.font = "700 18px sans-serif";
  ctx.fillText("FLAVOR PATH", x, y - 54);
  ctx.fillStyle = "rgba(249,239,228,0.52)";
  ctx.font = "500 18px sans-serif";
  ctx.fillText(profile.atmosphereLabel, x, y + 58);
  ctx.restore();
}

function getStickerBox(sticker: StorySticker, canvasWidth: number) {
  const baseWidths: Record<StickerScale, number> = {
    sm: canvasWidth * 0.28,
    md: canvasWidth * 0.42,
    lg: canvasWidth * 0.58,
  };

  let width = baseWidths[sticker.scale];
  if (sticker.kind === "title") width = canvasWidth * (sticker.scale === "lg" ? 0.62 : sticker.scale === "md" ? 0.5 : 0.42);
  if (sticker.kind === "review") width = canvasWidth * (sticker.scale === "lg" ? 0.66 : sticker.scale === "md" ? 0.52 : 0.42);
  if (sticker.kind === "meta" || sticker.kind === "origin" || sticker.kind === "location") {
    width = canvasWidth * (sticker.scale === "lg" ? 0.48 : sticker.scale === "md" ? 0.4 : 0.34);
  }
  return width;
}

function drawStorySticker(
  ctx: CanvasRenderingContext2D,
  sticker: StorySticker,
  payload: SharePayload,
  visibility: ShareVisibility,
  canvasWidth: number,
  canvasHeight: number,
  preset: SensoryScenePreset = "auto",
) {
  const profile = getSensorySceneProfile(payload, preset);
  const width = getStickerBox(sticker, canvasWidth);
  const x = canvasWidth * (sticker.x / 100) - width / 2;
  const fg = sticker.style === "solid" ? "#fff4e4" : profile.typographyTint;

  if (sticker.kind === "meta") {
    const y = canvasHeight * (sticker.y / 100);
    drawProjectionLine(ctx, payload.dateLabel, x, y, {
      font: "700 22px sans-serif",
      color: fg,
      accent: "rgba(255,255,255,0.18)",
      uppercase: false,
    });
    return;
  }

  if (sticker.kind === "location") {
    const y = canvasHeight * (sticker.y / 100);
    drawProjectionLine(ctx, visibility.showLocation ? payload.locationLabel : payload.cafe, x, y, {
      font: "700 24px sans-serif",
      color: fg,
      accent: "rgba(255,255,255,0.2)",
    });
    return;
  }

  if (sticker.kind === "origin") {
    const y = canvasHeight * (sticker.y / 100);
    const metaLine = [payload.originLabel, payload.roastLabel].filter(Boolean).join(" · ") || profile.sceneTitle;
    drawProjectionLine(ctx, metaLine, x, y, {
      font: "700 22px sans-serif",
      color: fg,
      accent: hexToRgba(profile.flavors[0]?.glow || "#f0b27a", 0.4),
    });
    return;
  }

  if (sticker.kind === "score") {
    const centerX = canvasWidth * (sticker.x / 100);
    const centerY = canvasHeight * (sticker.y / 100);
    const ring = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 110);
    ring.addColorStop(0, hexToRgba(profile.flavors[0]?.color || "#f6dcc4", 0.34));
    ring.addColorStop(0.48, hexToRgba(profile.flavors[0]?.glow || "#cb8650", 0.14));
    ring.addColorStop(1, hexToRgba(profile.flavors[0]?.glow || "#cb8650", 0));
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 84, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.font = "700 18px sans-serif";
    ctx.fillText("GLOW SCORE", centerX - 48, centerY - 12);
    ctx.font = "700 58px sans-serif";
    ctx.fillText(payload.rating.toFixed(1), centerX - 34, centerY + 48);
    return;
  }

  if (sticker.kind === "flavors") {
    const centerY = canvasHeight * (sticker.y / 100);
    drawFlavorTrail(ctx, x + 18, centerY, width - 36, profile);
    return;
  }

  if (sticker.kind === "review") {
    const y = canvasHeight * (sticker.y / 100);
    const gradient = ctx.createLinearGradient(x, y - 92, x, y + 54);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.35, "rgba(0,0,0,0.12)");
    gradient.addColorStop(1, "rgba(0,0,0,0.36)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 10, y - 92, width + 20, 146);

    ctx.fillStyle = "rgba(249,239,228,0.6)";
    ctx.font = "700 18px sans-serif";
    ctx.fillText("AFTERTASTE", x, y - 18);
    ctx.fillStyle = fg;
    ctx.font = "500 26px sans-serif";
    const lines = wrapText(ctx, payload.review, width).slice(0, 3);
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + 16 + index * 34);
    });
    return;
  }

  const y = canvasHeight * (sticker.y / 100);
  ctx.fillStyle = "rgba(249,239,228,0.62)";
  ctx.font = "700 18px sans-serif";
  ctx.fillText(profile.sceneTitle.toUpperCase(), x, y - 42);
  ctx.fillStyle = fg;
  ctx.shadowColor = "rgba(0,0,0,0.24)";
  ctx.shadowBlur = 32;
  ctx.font = "700 68px sans-serif";
  const titleLines = wrapText(ctx, payload.title, width).slice(0, 2);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * 72);
  });
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(249,239,228,0.82)";
  ctx.font = "500 28px sans-serif";
  ctx.fillText(`${payload.cafe} · ${payload.subtitle}`, x, y + titleLines.length * 72 + 18);
  ctx.fillStyle = "rgba(249,239,228,0.58)";
  ctx.font = "500 22px sans-serif";
  ctx.fillText(profile.sceneNote, x, y + titleLines.length * 72 + 52);
}

export async function renderStoryEditorBlob(
  payload: SharePayload,
  visibility: ShareVisibility,
  ratio: StoryRatio,
  stickers: StorySticker[],
  preset: SensoryScenePreset = "auto",
) {
  const dimensions = STORY_RATIO_DIMENSIONS[ratio];
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("스토리 이미지를 렌더링할 수 없습니다.");
  }

  const image = await loadImage(payload.imageUrl);
  const imageRatio = image.width / image.height;
  const targetRatio = dimensions.width / dimensions.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (imageRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  const profile = getSensorySceneProfile(payload, preset);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dimensions.width, dimensions.height);
  drawSteamField(ctx, dimensions.width, dimensions.height, profile);

  stickers.filter((sticker) => sticker.visible).forEach((sticker) => {
    drawStorySticker(ctx, sticker, payload, visibility, dimensions.width, dimensions.height, preset);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("스토리 이미지를 만들지 못했습니다."));
    }, "image/png", 0.96);
  });
}

export async function downloadStoryEditorImage(
  payload: SharePayload,
  visibility: ShareVisibility,
  ratio: StoryRatio,
  stickers: StorySticker[],
  preset: SensoryScenePreset,
  fileName: string,
) {
  const blob = await renderStoryEditorBlob(payload, visibility, ratio, stickers, preset);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareStoryEditorImage(
  payload: SharePayload,
  visibility: ShareVisibility,
  ratio: StoryRatio,
  stickers: StorySticker[],
  preset: SensoryScenePreset,
  fileName: string,
  text: string,
) {
  const blob = await renderStoryEditorBlob(payload, visibility, ratio, stickers, preset);
  const file = new File([blob], fileName, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      text,
      files: [file],
      title: fileName,
    });
    return true;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return false;
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options?: {
    fillStyle?: string;
    textStyle?: string;
    strokeStyle?: string;
    font?: string;
    paddingX?: number;
    height?: number;
    radius?: number;
  },
) {
  const {
    fillStyle = "rgba(15, 10, 8, 0.46)",
    textStyle = "#f8efe4",
    strokeStyle = "rgba(255,255,255,0.12)",
    font = "600 24px sans-serif",
    paddingX = 22,
    height = 48,
    radius = 24,
  } = options || {};

  ctx.save();
  ctx.font = font;
  const width = ctx.measureText(text).width + paddingX * 2;
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = textStyle;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + paddingX, y + height / 2);
  ctx.restore();
  return width;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  return wrapText(ctx, text, maxWidth).slice(0, maxLines);
}

export async function renderAiStyledCardBlob(
  baseImageSrc: string,
  payload: SharePayload,
  visibility: ShareVisibility,
  preset: SensoryScenePreset = "auto",
) {
  const dimensions = STORY_RATIO_DIMENSIONS["9:16"];
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("AI 스타일 카드를 렌더링할 수 없습니다.");
  }

  const image = await loadImage(baseImageSrc);
  const imageRatio = image.width / image.height;
  const targetRatio = dimensions.width / dimensions.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (imageRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  const profile = getSensorySceneProfile(payload, preset);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dimensions.width, dimensions.height);
  drawSteamField(ctx, dimensions.width, dimensions.height, profile);

  drawPill(ctx, "AI STYLE CARD BETA", 72, 72, {
    fillStyle: "rgba(197,139,60,0.22)",
    textStyle: "#f8e5c8",
    strokeStyle: "rgba(197,139,60,0.32)",
    font: "700 20px sans-serif",
    paddingX: 20,
    height: 44,
    radius: 22,
  });

  let metaCursorX = 72;
  const metaY = 132;
  if (visibility.showLocation) {
    metaCursorX += drawPill(ctx, payload.locationLabel, metaCursorX, metaY) + 14;
  }
  if (visibility.showDate) {
    drawPill(ctx, payload.dateLabel, metaCursorX, metaY);
  }

  ctx.fillStyle = "rgba(249,239,228,0.64)";
  ctx.font = "700 22px sans-serif";
  ctx.fillText(profile.sceneTitle.toUpperCase(), 72, 318);

  ctx.fillStyle = "#fff7f0";
  ctx.shadowColor = "rgba(0,0,0,0.26)";
  ctx.shadowBlur = 28;
  ctx.font = "700 74px serif";
  const titleLines = wrapTextLines(ctx, payload.title, 760, 2);
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 72, 392 + index * 84);
  });
  ctx.shadowBlur = 0;

  const titleBlockHeight = 392 + Math.max(0, titleLines.length - 1) * 84;
  ctx.fillStyle = "rgba(249,239,228,0.88)";
  ctx.font = "500 30px sans-serif";
  ctx.fillText(`${payload.cafe} · ${payload.subtitle}`, 72, titleBlockHeight + 120);
  ctx.fillStyle = "rgba(249,239,228,0.68)";
  ctx.font = "500 24px sans-serif";
  ctx.fillText(profile.sceneNote, 72, titleBlockHeight + 166);

  if (visibility.showFlavors && payload.flavors.length > 0) {
    drawFlavorTrail(ctx, 246, 1050, 560, profile);
  }

  const infoY = 1568;
  if (visibility.showRating && payload.rating > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 56px sans-serif";
    ctx.fillText(payload.rating.toFixed(1), 848, infoY);
    ctx.fillStyle = "#c9af91";
    ctx.font = "500 28px sans-serif";
    ctx.fillText("/ 5.0", 976, infoY);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(908, 1524, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(249,239,228,0.52)";
    ctx.font = "700 18px sans-serif";
    ctx.fillText("GLOW SCORE", 836, 1468);
  }

  const originLine = [payload.originLabel, payload.roastLabel].filter(Boolean).join(" · ");
  if (originLine) {
    drawProjectionLine(ctx, originLine, 86, 1506, {
      font: "700 26px sans-serif",
      color: "#f8efe4",
      accent: hexToRgba(profile.flavors[0]?.glow || "#f0b27a", 0.4),
    });
  }

  if (visibility.showReview && payload.review) {
    const panelX = 76;
    const panelY = 1666;
    const panelWidth = 648;
    const panelHeight = 176;
    const reviewGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    reviewGradient.addColorStop(0, "rgba(16, 10, 8, 0.18)");
    reviewGradient.addColorStop(1, "rgba(16, 10, 8, 0.52)");
    ctx.fillStyle = reviewGradient;
    drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 24);
    ctx.fill();

    ctx.fillStyle = "rgba(249,239,228,0.6)";
    ctx.font = "700 18px sans-serif";
    ctx.fillText("AFTERTASTE", panelX + 24, panelY + 34);
    ctx.fillStyle = "#f8efe4";
    ctx.font = "500 26px sans-serif";
    const reviewLines = wrapTextLines(ctx, payload.review, panelWidth - 48, 3);
    reviewLines.forEach((line, index) => {
      ctx.fillText(line, panelX + 24, panelY + 82 + index * 34);
    });
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("AI 스타일 카드 이미지를 만들지 못했습니다."));
    }, "image/png", 0.96);
  });
}

export async function downloadAiStyledCardImage(
  baseImageSrc: string,
  payload: SharePayload,
  visibility: ShareVisibility,
  preset: SensoryScenePreset,
  fileName: string,
) {
  const blob = await renderAiStyledCardBlob(baseImageSrc, payload, visibility, preset);
  downloadBlob(blob, fileName);
}

export async function shareAiStyledCardImage(
  baseImageSrc: string,
  payload: SharePayload,
  visibility: ShareVisibility,
  preset: SensoryScenePreset,
  fileName: string,
  text: string,
) {
  const blob = await renderAiStyledCardBlob(baseImageSrc, payload, visibility, preset);
  const file = new File([blob], fileName, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] })
  ) {
    await navigator.share({
      text,
      files: [file],
      title: fileName,
    });
    return true;
  }

  downloadBlob(blob, fileName);
  return false;
}
