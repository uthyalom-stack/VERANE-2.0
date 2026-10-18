# Deployment, migrations, recovery

## Local
```
cp .env.example .env.local    # set SESSION_SECRET, TOKEN_PEPPER (openssl rand -base64 48); leave drivers on mock/console/local
npm install
npm run db:generate && npm run db:migrate && npm run db:seed   # seed = SAMPLE data, dev only; refuses APP_ENV=production
npm run dev
```
Dev admins (seed): super@/uthy@/alomzie@verane.local, password `SEED_ADMIN_PASSWORD` (default `ChangeMe-Dev-Only-123`). Visit /admin/login. Change or delete these before any shared environment.
Dev payments: checkout redirects to `/checkout/mock-pay` (simulate success/failure). Emails print to the server console. Media goes to `./local-media`.

## Migration workflow
1. Edit schema in `src/infrastructure/db/schema/*`.
2. `npm run db:generate` → review the SQL in `drizzle/`; commit it. Never edit applied migrations; never drop data silently (write an explicit data-preserving migration).
3. `npm run db:migrate` (applies Drizzle migrations, then idempotent FTS5 DDL, then reconciles roles/permissions). Run it from CI or your machine against Layerbase — **never at request time on Workers**.
4. Backfill search after bulk catalogue imports: call `reindexProduct` per product (product writes already do).
5. Optional analytics store: `npm run db:migrate:analytics` with `ANALYTICS_DATABASE_URL`.

## First production deploy (Cloudflare Workers + OpenNext)
1. Create the Layerbase libSQL database; note URL + token. Create R2 bucket `verane-media`.
2. Edit `wrangler.jsonc`: `APP_URL`, `MEDIA_PUBLIC_BASE_URL`, bucket name, route/custom domain.
3. Set secrets (`wrangler secret put NAME`): DATABASE_URL, DATABASE_AUTH_TOKEN, SESSION_SECRET, TOKEN_PEPPER, CRON_SECRET, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, SHIPBUBBLE_API_KEY, SHIP_ORIGIN_*, RESEND_API_KEY, EMAIL_FROM, ADMIN_NOTIFY_EMAIL (+ analytics vars if used).
4. `DATABASE_URL=<prod> DATABASE_AUTH_TOKEN=<tok> npm run db:migrate`.
5. Create the first super admin **without** the seed script (production seed is blocked): insert a user with `kind='admin'` using a one-off script that calls `hashPassword`, then `grantRole`; or run the seed against a staging DB and copy only the admin rows.
6. In Paystack dashboard set the webhook URL to `https://<domain>/api/webhooks/paystack`.
7. `npm run cf:deploy`. The app refuses to boot in `APP_ENV=production` unless Paystack, Shipbubble, Resend, a remote DB, https APP_URL and CRON_SECRET are configured.
8. Smoke test: browse, add to bag, test-mode payment, webhook delivery (check `webhook_events`), confirmation email (check `email_outbox`), admin order view, cron tick (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/tick`).

## Recovery procedures
- **Webhook missed / payment stuck pending:** the return page and cron are not enough alone — in admin, find the order; call `finalizePayment` by re-opening the order's payment return URL `/checkout/return?reference=<ref>` (idempotent, verifies with Paystack). `payment_attempts.status = 'mismatch'` needs manual review: compare amounts in Paystack, then refund or adjust.
- **Stock drift:** compare `inventory_levels` with `inventory_transactions` (sum of onHandDelta / reservedDelta per variant); fix via admin Inventory adjustment (audited). Stuck reservations are released by cron (`expireStaleOrders`) once `reservation_expires_at` passes.
- **Emails not sending:** inspect `email_outbox` (status/attempts/last_error). Fix the provider config; pending rows retry automatically with backoff; `failed` rows can be reset with `UPDATE email_outbox SET status='pending', attempts=0, next_attempt_at=NULL WHERE id=…`.
- **Bad deploy:** `wrangler rollback` to the previous version; migrations are forward-only, so ship backwards-compatible schema changes (add columns/tables first, remove later).
- **Database restore:** use Layerbase's point-in-time/backups; after restoring, run `npm run db:migrate` (idempotent) and the cron tick. Sessions may be invalid after a restore — users simply sign in again.
- **Secret leak:** rotate SESSION_SECRET/TOKEN_PEPPER (invalidates sessions and outstanding tokens), CRON_SECRET, provider keys; revoke sessions: `UPDATE sessions SET revoked_at = unixepoch()*1000 WHERE revoked_at IS NULL`.
- **Locked-out super admin:** run a one-off script calling `resetPassword`-style update with `hashPassword`, then `revokeAllSessions`.
