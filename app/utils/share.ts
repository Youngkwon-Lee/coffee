import { Timestamp } from "firebase/firestore";

export type ShareTemplate = "minimal" | "editorial" | "strava";

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

export const DEFAULT_SHARE_VISIBILITY: ShareVisibility = {
  showReview: true,
  showFlavors: true,
  showRating: true,
  showDate: true,
  showLocation: false,
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

export function buildShareCaption(payload: SharePayload, visibility: ShareVisibility, template: ShareTemplate) {
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
