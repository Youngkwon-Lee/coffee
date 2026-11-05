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

/**
 * A tab-local timestamp records that this user started the Telegram code flow.
 * No token, chat ID, UID or link code is stored. Count connection success only
 * when a subsequent authenticated profile read confirms telegramChatId exists.
 */
const LINK_ATTEMPT_KEY = "coffee-funnel-telegram-link-attempt-v1";
const MAX_LINK_ATTEMPT_AGE_MS = 60 * 60_000;

export function markTelegramLinkStarted(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LINK_ATTEMPT_KEY, String(Date.now()));
  } catch {
    // Not all browsers permit sessionStorage.
  }
  reportCoffeeFunnel("telegram_link_started");
}

export function recordConfirmedTelegramLink(): void {
  if (typeof window === "undefined") return;
  try {
    const startedAt = Number(window.sessionStorage.getItem(LINK_ATTEMPT_KEY));
    if (!Number.isFinite(startedAt) || startedAt <= 0) return;
    window.sessionStorage.removeItem(LINK_ATTEMPT_KEY);
    if (Date.now() >= startedAt && Date.now() - startedAt <= MAX_LINK_ATTEMPT_AGE_MS) {
      reportCoffeeFunnel("telegram_link_confirmed");
    }
  } catch {
    // Never interrupt account loading.
  }
}
