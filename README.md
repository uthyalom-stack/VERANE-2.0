# VÉRANE 2.0 — local build
Two Brands. One Expression. Next.js (App Router) modular monolith · Drizzle · Layerbase libSQL · Cloudflare Workers/OpenNext · R2 · Paystack · Shipbubble · Resend.

- **Status & checklist:** `PROGRESS.md` · **Decisions:** `docs/DECISIONS.md` · **What was/wasn't verified:** `docs/VERIFICATION.md` · **Deploy/recovery:** `docs/DEPLOY.md`
- **Important:** this code has never been compiled with real dependencies. Run `npm run check` first and fix what it finds.

```
cp .env.example .env.local && npm install
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev          # http://localhost:3000   admin: /admin/login
npm run check        # typecheck + lint + test + build
npm run test:offline # dependency-free tests (no install needed)
```
Layout: `src/app` routes/actions · `src/components` UI · `src/domains` business logic (authorization, identity, catalog, inventory, pricing, cart, orders, content, outfit, admin, media, newsletter, analytics) · `src/infrastructure` db, payments, shipping, email, storage · `worker/` Cloudflare entry with cron · `tests/` · `drizzle/` generated migrations.
