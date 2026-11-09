# Kinelo Coffee — UI integration (2026-11-10)

## Brand contract

- Brand: **Kinelo Coffee**. The existing `/changes` product remains **원두레이더** (Bean Radar).
- Keep the existing production hostname `coffee-omega-lovat.vercel.app`, route paths, Firebase project, product IDs and event names. This change does not connect or purchase `coffee.kinelo.co.kr`.
- Do not describe retailer-link clicks as purchases, or saved favorites as paid conversions. Existing pricing/notification permissions and SNS hold remain unchanged.

## Reused Kinelo sources

Read from `Youngkwon-Lee/physio_app/main` on 2026-11-10:

- `DESIGN.md`, blob `d0dd7cc2421f7ebd60ef5fdeb58fb31399f34c04`.
- `docs/design/MEMBER_APP_DESIGN_SYSTEM.md`, blob `ea4f6302e691fbff0a0fc610815cf9a9dae59c71`.
- `src/components/ui/kinelo-logo.tsx`, blob `4e6fd39cdcd463088eb23d5755127887ba196b17`. Its original two path definitions are retained in `public/kinelo-coffee-symbol.svg`; the navy/sky mark is not redrawn as a coffee logo.

Coffee adopts the light member grammar: background `#F5F7F6`, white cards, sage `#EAF3EF`, ink `#14231F`, forest actions `#205C53`, and one cream hero `#F7F1E5` per primary screen. Control/card/hero radii are 14/20/24px. Typography is Pretendard-first with installed Korean system fallbacks, without Google Fonts network requests. No font binaries are included.

`src/styles/kinelo-coffee.css` is the Coffee theme. Existing Tailwind `coffee.*` aliases are retained with the new palette so older functional screens stay legible. Coffee keeps its installed Lucide icons rather than installing the health portal's Phosphor dependency. This is a Coffee adaptation, not a change to the health application or its member scope.

## Surface changes

- Responsive branded header, desktop navigation, five-item mobile navigation, keyboard skip link, safe-area spacing and reduced-motion styles.
- Public home: a cream discovery hero; Bean Radar / catalog / saved-beans shortcuts; existing photo/manual records, history and cafe routes remain reachable. No fabricated counters or auth-loading gate.
- Bean Radar: real displayed row count (unknown = dash on error), responsive change cards, existing loading/error/empty semantics, timestamps and stock caveats.
- Catalog: larger product imagery, readable filter labels, native keyboard/mobile selections, accessible wishlist labels. Data filters and saved-favorite logic unchanged.
- Product detail: product image, price, taste/roast details and the existing tracked retailer link. The modal no longer displays an unsupported five-star rating.
- Login, favorites, onboarding, notifications, cafes and map panels: brand and palette alignment without authentication, database or notification-server changes.
- Favicon, app icons and social share artwork use the existing Kinelo mark.

## Verification and boundaries

Run `node --test scripts/__tests__/kinelo-coffee-ui.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit --incremental false`.

The UI regression suite checks palette contrast pairs, CSS syntax, SSR destinations, native filter labels, event-name continuity, unchanged data functions and wishlist handlers, and the unchanged API/crawler/auth/dependency paths against baseline `19dcc989a71e50c02aaac573bbb8f14375708c75`.

Actual Aside browser rendering, touch interaction, login and save/reload are separate from these checks. Aside is not exposed in this conversation; do not switch browsers or label HTTP/server-render tests as browser E2E. Social preview image was inspected separately. No marketing messages, payments, new accounts, customer records or notification sends are created during validation.

Release evidence (exact commit, deployment and HTTP smoke results) belongs in the PR description; no new monitoring process or CI workflow is introduced.
