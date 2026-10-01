# VÉRANE 2.0

**Two Brands. One Expression.**

Digital fashion house and ecommerce platform for **UTHY LUXURY** and **ALOMZIEE FOOTIES**.

---

## Technical Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Runtime:** Cloudflare Workers (`@opennextjs/cloudflare` + `wrangler`)
- **Database:** Layerbase SQLite + Drizzle ORM (`@libsql/client`)
- **Storage:** Cloudflare R2 (`@aws-sdk/client-s3`)
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

### 3. Database Migrations

Generate SQL migrations from Drizzle schemas:

```bash
npm run db:generate
```

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
