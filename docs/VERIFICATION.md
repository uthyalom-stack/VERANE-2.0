# Verification record (authoring sandbox: no network, no `npm install`)

## Actually executed and PASSED
| Check | Command | Result |
|---|---|---|
| Syntax of every .ts/.tsx (TypeScript 6.0.3 global `tsc`) | `tsc --noEmit -p tsconfig.json \| grep "error TS1"` | 0 syntax errors |
| Dependency-free unit tests (Node test runner + vitest shim) | `npm run test:offline` | **25/25 passed**: money, pricing/discount rules, password hashing + HMAC, Paystack adapter (mock fetch, signature), Shipbubble adapter (mock fetch, retry), Resend adapter, email HTML escaping, mock payment provider, open-redirect guard, media magic-byte sniffing/size limits |

## Executed but NOT meaningful
`tsc --noEmit` reports ~2,100 errors, almost all caused by missing packages (`TS2307`, JSX `TS7026`, implicit-any cascades). One genuine bug it surfaced (dynamic-import assertion function) was fixed. A clean type-check requires real dependency types.

## NOT run (could not): you must run these
```
npm install
npm run db:generate          # creates drizzle/*.sql (not yet generated!)
npm run typecheck && npm run lint
npm test                     # vitest: RBAC, inventory concurrency, identity, cart, checkout/webhooks/expiry/retry, admin scope, account/outfit/newsletter, outbox, fulfilment
npm run build                # Next production build
npm run cf:build             # OpenNext/Cloudflare build
npm run cf:preview           # local Workers runtime
```
DB-backed suites are written (≈60 tests) but have never executed. Treat them as unverified until green.

## Production verification still required (needs credentials / accounts)
Paystack init/verify/webhook with real keys (use a test-mode key + webhook tunnel); Shipbubble rates/label/tracking field names; Resend delivery + domain; R2 uploads/Range; Layerbase libSQL transaction behaviour under load (stock reservation relies on single-statement compare-and-set + unique keys); Worker `scheduled` wiring; OpenNext compatibility of Next 16 + `@libsql/client` + `nodejs_compat`.
