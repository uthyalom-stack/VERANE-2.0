# VÉRANE 2.0

**Two Brands. One Expression.**

Digital fashion house and ecommerce platform foundation for **UTHY LUXURY** and **ALOMZIEE FOOTIES**.

---

## Technical Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Runtime:** Cloudflare Workers (`@opennextjs/cloudflare` + `wrangler`)
- **Database:** Layerbase SQLite + Drizzle ORM (`@libsql/client`)
- **Storage:** Cloudflare R2 (`WorkerR2StorageProvider` / `@aws-sdk/client-s3`)
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest

---

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment template:

```bash
cp .env.example .env.local
```

*Note:* `SESSION_SECRET` is required in production environments (`NODE_ENV=production`).

### 3. Database & Layerbase Setup

For local development and testing, Drizzle uses a local SQLite file (`file:local.db`).

To generate database migrations:

```bash
npm run db:generate
```

To connect to production Layerbase:
Set `DATABASE_URL` (Layerbase endpoint) and `DATABASE_AUTH_TOKEN` in environment variables.

### 4. Run Development Server

Standard Next.js local development:

```bash
npm run dev
```

Run Cloudflare Workers local environment preview:

```bash
npm run cf:dev
```

### 5. Running Tests & Verification

Run Vitest unit and infrastructure smoke tests:

```bash
npm run test
```

Run ESLint and production build:

```bash
npm run lint
npm run build
```

Build for Cloudflare Workers:

```bash
npm run cf:build
```

---

## Architecture Documentation

For complete architectural details, see [ARCHITECTURE.md](./ARCHITECTURE.md).
