/**
 * The only values accepted by the anonymous, first-party product funnel logger.
 * Do not add visitor IDs, emails, product names, source URLs or search queries.
 */
export const COFFEE_FUNNEL_EVENTS = [
  "changes_view",
  "change_detail_open",
  "changes_store_open",
  "bean_store_open",
  "favorite_saved",
  "alerts_interest",
  "alerts_settings_view",
  "telegram_link_started",
  "telegram_link_confirmed",
  "premium_request_submitted",
] as const;

export type CoffeeFunnelEvent = (typeof COFFEE_FUNNEL_EVENTS)[number];
export type CoffeeFunnelOrigin = "changes" | "unattributed";
