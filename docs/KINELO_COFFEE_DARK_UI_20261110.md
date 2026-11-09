# Kinelo Coffee — Premium Dark UI (2026-11-10)

## Selected visual reference

The user selected the two-screen dark Kinelo Coffee concept created from the supplied café-app screenshots. Transfer its **visual grammar**, not its fictional business or coupon data:

- Deep charcoal canvas (`#151618`), slate raised cards (`#222327`/`#2d2e33`), warm gold accent (`#DDBB84`), white typography, generous card radii, restrained dividers.
- Serif Kinelo Coffee wordmark, actual camera-to-record shortcut, accessible hamburger menu, three primary mobile actions.
- Real photographed **products from Firestore beans**, not generated fake Kinelo branches. Never claim live shop hours or distances.
- The right-side coupon visual becomes real **찜한 원두 / 알림 설정** tabs and saved-bean cards. Coupon creation, rewards balances, payment/order flows are **not** implemented or claimed.
- Existing free-beta onboarding, account access, real catalog, change feed and product-source caveats remain.

## Data and UX boundaries

- Home uses a **30-minute cached read-only query** to the real applied `beans` collection ordered by `lastUpdated`. It chooses at most 3 valid HTTPS product photos from distinct roasters, excluding invalid/dead/sample/obvious non-bean entries. If unavailable it presents a non-photo fallback with a live catalog link; it never invents a product.
- Original validation logic for changes, product IDs, Firestore favorite writes/removals, alert policy and first-party Analytics remains in place.
- The three mobile tabs are **홈 / 원두 찾기 / 찜·알림**. All other routes are reachable through the actual menu, including **원두레이더**, history, café discovery and recording.
- Theme CSS is layered after the previous Kinelo light CSS. System fonts only; no font files and no build-time Google Fonts dependency.
- The source screenshots and ImageGen concept are **directional visual references**, not product data, reusable café photos, coupons, operating-hours evidence or geolocation evidence.

## Verification and rollout

- `node --test scripts/__tests__/kinelo-coffee-ui.test.mjs scripts/__tests__/kinelo-coffee-dark-ui.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `git diff --check`
- Vercel build pinned to exact candidate SHA, check `/ /changes /beans /my-beans /settings/alerts`, verify real product cards if present.
- No Aside browser is available to this ChatGPT tool connection. Browser screenshots, mobile touch and authenticated journeys remain **unverified** unless later checked with Aside itself. Server-generated HTML is not browser E2E.
- No crawler run, production DB write, SNS integration, coupon system, domain/DNS changes, customer outreach or pricing changes belong to this redesign.
