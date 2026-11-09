"use client";

import { Analytics } from "@vercel/analytics/next";

// Page-view tracking is limited to public catalog and product pages.
// Private account, health/coffee records, purchase request and admin paths
// must not be included in page-view analytics.
function isPublicCoffeePage(path: string): boolean {
  return (
    path === "/" ||
    path === "/onboarding" ||
    path === "/changes" ||
    path === "/beans" ||
    path.startsWith("/beans/") ||
    path === "/cafes" ||
    path.startsWith("/cafes/") ||
    path === "/premium"
  );
}

export default function CoffeeWebAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          return isPublicCoffeePage(url.pathname) ? event : null;
        } catch {
          return null;
        }
      }}
    />
  );
}
