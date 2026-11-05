"use client";

import type { CoffeeFunnelEvent, CoffeeFunnelOrigin } from "./coffeeFunnelEvents";

// Only the fact that this tab visited the change feed, valid for 30 minutes.
// No account ID, cookie, URL, search term, fingerprint or persistent visitor ID.
const SOURCE_KEY = "coffee-funnel-changes-since-v1";
const MAX_SOURCE_AGE_MS = 30 * 60_000;

export function markChangesFunnelOrigin(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SOURCE_KEY, String(Date.now()));
  } catch {
    // Storage can be blocked. Events remain unattributed.
  }
}

function currentOrigin(): CoffeeFunnelOrigin {
  if (typeof window === "undefined") return "unattributed";
  try {
    const seenAt = Number(window.sessionStorage.getItem(SOURCE_KEY));
    if (Number.isFinite(seenAt) && seenAt > 0 && Date.now() - seenAt < MAX_SOURCE_AGE_MS && Date.now() >= seenAt) {
      return "changes";
    }
  } catch {
    // Storage can be blocked.
  }
  return "unattributed";
}

/** Best-effort anonymous event count; never delays navigation or Firestore writes. */
export function reportCoffeeFunnel(event: CoffeeFunnelEvent): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, origin: currentOrigin() });
  try {
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(
      "/api/coffee-funnel",
      new Blob([body], { type: "application/json" })
    )) {
      return;
    }
    void fetch("/api/coffee-funnel", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking never affects the product action.
  }
}
