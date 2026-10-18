# VÉRANE 2.0 (local workstream) — PROGRESS

Separate local build, independent of the GitHub repo; intended to be compared/merged later. Resume by reading this file, `docs/DECISIONS.md`, `docs/VERIFICATION.md`.

## Status vocabulary (used strictly)
- **Implemented** = code exists and is wired end to end.
- **Offline-tested** = executed in the no-network sandbox via `npm run test:offline` (25 tests passed).
- **Tests written, not run** = DB-backed vitest suites exist but could not run (no `npm install`).
- **Production-verified** = tested against the real service. **NOTHING is production-verified.**

## Next concrete task
1. On a networked machine: `npm install`, `npm run db:generate`, then `npm run check`. Fix the compile/type/lint errors that the sandbox could not surface (expect some — the code has never been compiled with real dependency types).
2. Run `npm test` (DB-backed suites) and fix any failing assertion.
3. Add Playwright E2E for the golden path (browse → bag → checkout with mock pay → order page) and an accessibility pass.

## Spec checklist
### 1. HTTP + security layer — Implemented
- Sessions: opaque random token, HTTP-only, SameSite=Lax, `__Host-` prefix over https, SHA-256(pepper+token) stored, idle+absolute expiry, revoke on logout/reset/role-revoke.
- Same-origin (CSRF) check on every server action (`lib/http/action.ts` → `origin.ts`) + upload route; open-redirect guard (`safeNext`, offline-tested).
- Auth flows: register (no account enumeration), login (rate limit, lockout, timing equalisation, customer vs admin kind), logout, email verification (POST click, so scanners can't consume it), forgot/reset password (single use, revokes sessions). Separate `/admin/login`; admin boundary `requireAdmin()` loads RBAC fresh per request.
- Routes: `/api/webhooks/paystack` (raw-body HMAC-SHA512), `/checkout/return` (never trusts redirect), `/checkout/mock-pay` (dev only, 404 in production), `/api/cron/tick` (Bearer secret), `/api/admin/media` (upload), `/media/[...key]` (serve).
### 2. Cart + checkout — Implemented
- Guest + user carts (HTTP-only cookie), merge on login, bag drawer (focus trap, Esc), full bag page, discount codes, PDP variant picker.
- Checkout (contact → address → delivery → review → pay): server re-quotes shipping and recomputes every amount; atomic stock reservation; pending order; Paystack init; verified return; signed webhook; idempotent finalisation; amount/currency mismatch hold; retry payment; reservation expiry cron; confirmation page; guest access token + order lookup (rate-limited).
- Mock payments are impossible in production (`getPaymentProvider` throws; `assertProductionIntegrations` fails boot).
### 3. Customer experience — Implemented
Accounts (profile, preferences, notifications), addresses, orders + detail, wishlist (price-change / sell-out flags, move to bag), collections, Looks + Shop the Look, saved Looks, Outfit Builder (server-priced, drag/keyboard/scale/reorder, save/reopen/share/add to bag), saved outfits, Journal (+ product/Look/collection embeds, film), search (FTS5), newsletter (explicit consent, unsubscribe token), related products, Complete the Look, slug redirects, JSON-LD (Product, Breadcrumb, Organization), sitemap/robots.
### 4. Administration — Implemented
Overview (real aggregates), products + variants + categories + media attach/order, collections, inventory (ledger, confirmation for large adjustments), media library + uploader (retry-safe), orders (status machine, shipment creation), customers, discounts, brands, looks, campaigns, journal (block editor), homepage block editor with preview and draft/publish, newsletter, analytics summary, users & roles, audit log, integration status. Brand isolation enforced in services for reads and writes.
### 5. Integrations — Implemented as adapters; none live-verified
- Paystack (REST + HMAC): adapter offline-tested with mocked fetch. Mock for dev.
- Shipbubble: validate → rates → label → track, retry/backoff. **Field names/endpoints are from my understanding of the public API; verify against current docs before go-live.** Mock for dev.
- Resend: REST adapter offline-tested with mocked fetch; outbox with dedupe key, claim-before-send, exponential backoff, max 6 attempts. Console driver for dev.
- R2: binding-based storage + serve route with Range support; local-disk driver for dev. Not run against a real bucket.
- Scheduled processing: Worker `scheduled()` → authenticated `/api/cron/tick` (expire reservations, send emails, poll shipments, purge). Wrapper `worker/index.ts` depends on OpenNext's generated worker shape — unverified.
- Turso analytics: optional sink + `db:migrate:analytics`; falls back to primary DB; failures never affect checkout.
### 6. Design — Implemented (not visually reviewed in a browser)
Tokens, brand themes, glass (nav, drawers, hero controls only), split hero, campaign hero (desktop/mobile crops, reduced-motion-aware video), rails, product gallery with full-screen zoom, sticky mobile purchase bar, full-screen mobile menu. All nav items link to existing routes.
### 7. Deployment + docs — Implemented (see `docs/DEPLOY.md`)

## Known gaps / limitations (honest list)
- **Never compiled/linted/built here.** Dependency-free modules ran; everything importing next/react/drizzle/zod did not.
- No component/E2E/a11y/performance tests; no real-browser visual review.
- No product-card quick-add, search overlay, recent searches, recently-viewed, collection recommendations, natural-language search or AI styling (only the `SearchService` seam). No 3D viewer (role stored only).
- Cancelling/refunding an order in admin changes status only: it does NOT restock inventory or call Paystack refunds (use a manual "return" stock adjustment; refund in Paystack dashboard). No customer-facing cancel/return flow.
- Mixed-brand orders ship as one parcel; brand admins can see but not manage them.
- Admin lists are capped (200 products etc.), no search/pagination; collection/look product pickers are checkbox lists in catalog order (no drag ordering).
- Email verification is not required to check out. Tax is a single global rate (env).
- Pages are `force-dynamic` (no caching) — performance work remains.
- Argon2id would be stronger than PBKDF2@100k (Workers' ceiling).
