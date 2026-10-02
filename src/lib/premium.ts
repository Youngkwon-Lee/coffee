/** Shared product contract. No payment or revenue is inferred from an entitlement. */
export const PREMIUM_PRICE_KRW = 2900;
export const PREMIUM_PERIOD_DAYS = 30;
export const FREE_FAVORITE_LIMIT = 3;
export const DAY_MS = 86_400_000;
export type PremiumState = 'free' | 'active' | 'expired' | 'manual' | 'invalid';
export type RequestStatus = 'pending' | 'awaiting_payment' | 'activated' | 'declined' | 'cancelled';
export type PremiumRequest = {
  requestId: string;
  status: RequestStatus;
};

export function timestampMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'string') {
    // Do not let Date.parse silently normalize an impossible date (e.g. Feb 30).
    // Match Python's strict ISO parser; a legacy missing timezone means UTC.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
    if (!match) return NaN;
    const [, year, month, day, hour, minute, second] = match;
    const calendar = new Date(0);
    calendar.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (Number(year) < 1 || calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day)
      || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return NaN;
    return Date.parse(match[8] ? value : `${value}Z`);
  }
  return NaN;
}

export function premiumUntilMillis(profile: Record<string, unknown>): number | null {
  return timestampMillis(profile.premium_until ?? profile.premiumUntil);
}

export function premiumState(profile: Record<string, unknown>, now = Date.now()): PremiumState {
  if (String(profile.plan ?? '').toLowerCase() !== 'premium') return 'free';
  const until = premiumUntilMillis(profile);
  // Preserve existing explicitly granted, undated access; new paid grants always expire.
  if (until === null) return 'manual';
  if (!Number.isFinite(until)) return 'invalid';
  return until > now ? 'active' : 'expired';
}

export function isPremium(profile: Record<string, unknown>, now = Date.now()): boolean {
  return ['active', 'manual'].includes(premiumState(profile, now));
}

export function parsePremiumRequest(value: Record<string, unknown> | undefined): PremiumRequest | null {
  if (!value || typeof value.requestId !== 'string') return null;
  const statuses: string[] = ['pending', 'awaiting_payment', 'activated', 'declined', 'cancelled'];
  if (!statuses.includes(String(value.status))) return null;
  return { requestId: value.requestId, status: value.status as RequestStatus };
}
