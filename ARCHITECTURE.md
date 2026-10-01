# VÉRANE 2.0 — Architectural Specification (Phase 0)

VÉRANE is a digital fashion house and ecommerce platform containing two brands:
- **UTHY LUXURY**
- **ALOMZIEE FOOTIES**

*Tagline:* **Two Brands. One Expression.**

---

## 1. High-Level Architecture Overview

VÉRANE 2.0 is built as a **modular monolith / serverless-first application** targeting **Cloudflare Workers**.

```text
Internet
   │
   ▼
Cloudflare Workers Runtime (Next.js App Router via @opennextjs/cloudflare)
   │
   ├── Server Actions & Route Handlers
   │       │
   │       ▼
   ├── Domain Services (Business Logic)
   │       │
   │       ▼
   ├── Repositories (Data Abstraction Layer)
   │       │
   │       ├── Drizzle ORM -> Layerbase SQLite / LibSQL (@libsql/client)
   │       └── Media Storage -> Cloudflare R2 (Worker R2 Binding / S3 API)
```

---

## 2. Directory & Domain Structure

The repository follows a clean modular layout under `src/`:

```text
src/
├── app/                  # Routing, pages, route handlers, server actions
├── components/           # UI primitives & design system components
│   └── ui/               # Container, Button, Link, Media
├── domains/              # Business domain logic (Catalog, Orders, etc.)
├── infrastructure/       # Database & external providers
│   ├── database/         # Drizzle connection, schema, repositories
│   └── storage/          # R2 storage providers, Worker binding & MediaService
├── lib/                  # Cross-cutting utilities (security, logging, errors)
└── config/               # Environment & app configuration
```

### Server/Client Boundaries

- **Server-Only Code:** Direct database access, R2 storage provider credentials, and sensitive loggers are guarded with the `"server-only"` package.
- **Client Code:** UI primitives and interactive React components run without secret imports or direct DB references.

---

## 3. Database Architecture (Drizzle + Layerbase SQLite)

- **ORM:** Drizzle ORM (`drizzle-orm/libsql`).
- **Driver:** `@libsql/client` (provides unified support for local SQLite files `file:local.db`, LibSQL wire protocol, and remote Layerbase SQLite instances).
- **Repository Pattern:** UI components and domain services interact strictly through Repository interfaces (`ISmokeTestRepository`), keeping Drizzle and SQL details isolated inside `src/infrastructure/database/repositories/`.

### Database Environment & Verification Levels

1. **Local Development & Integration Testing:**
   - Uses local SQLite database (`file:local.db` or `file:test-local.db`).
   - Verifies Drizzle ORM schema mapping, SQL query execution, and repository abstraction locally without requiring network credentials.
2. **Layerbase Production Connectivity:**
   - Uses Layerbase SQLite primary transactional database via `@libsql/client`.
   - Requires setting `DATABASE_URL` (pointing to the Layerbase HTTP/WebSocket endpoint) and `DATABASE_AUTH_TOKEN` in the server environment.
   - *Note:* Local integration tests verify driver syntax and repository behavior against LibSQL/SQLite, but actual Layerbase connection requires live environment secrets.
3. **Migration Workflow:**
   - Schema changes are defined in `src/infrastructure/database/schema/`.
   - `npm run db:generate` runs `drizzle-kit generate` to produce declarative SQL files in `./drizzle`.
   - Migrations are applied via the Drizzle migration runner against target database endpoints.

---

## 4. Media Storage Strategy (Cloudflare R2)

The application uses a unified `StorageProvider` abstraction with three explicit execution modes:

### Mode 1: Cloudflare Worker Runtime (Primary Production Target)
- **Implementation:** `WorkerR2StorageProvider`
- **Mechanism:** Dynamically resolves the native `MEDIA_BUCKET` binding using `@opennextjs/cloudflare` (`getCloudflareContext()`).
- **Security & Efficiency:** Direct binding execution; **no S3 access keys or secret keys are required or exposed** in this path.

### Mode 2: Non-Worker Node.js Execution (Standalone / Migration Scripts)
- **Implementation:** `R2StorageProvider`
- **Mechanism:** Uses `@aws-sdk/client-s3` targeting Cloudflare R2 endpoints.
- **Credentials:** Requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

### Mode 3: Local Development & Isolated Testing
- **Implementation:** `MockStorageProvider` or mock `R2BucketBinding`.
- **Mechanism:** In-memory or local disk storage for isolated development and unit testing without network dependencies.

### Environment Bucket Isolation in Wrangler
- **Default/Dev:** `verane-media-dev`
- **Preview:** `verane-media-preview`
- **Production:** `verane-media-prod`

---

## 5. Security & Environment Configuration

- **Env Validation:** `src/config/env.ts` enforces strict validation using Zod for server secrets and public client variables.
- **Production Secrets:** `SESSION_SECRET` is strictly required in production (`NODE_ENV === "production"` with no default production secret). Development mode uses a documented dev-only fallback.
- **Custom Error Taxonomy:** `src/lib/errors.ts` standardizes `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, and `InfrastructureError`. Stack traces and internal secrets are hidden in production responses.
- **Safe Logger:** `src/lib/logger.ts` automatically redacts sensitive parameters (`token`, `password`, `secret`, `database_auth_token`, `r2_secret_access_key`).
- **Secure Cookies:** `src/lib/security.ts` provides default HTTP-only, SameSite=Lax, Secure cookie configuration.

---

## 6. Testing Strategy & Verification Levels

- **Runner:** Vitest.
- **Environment Tests:** `tests/env.test.ts` verifies strict Zod production validation for `SESSION_SECRET`.
- **Database Smoke Test:** Local SQLite write -> read -> delete database verification (`tests/database.smoke.test.ts`).
- **Storage Contract & Factory Test:** Upload -> retrieve -> delete verification for both Mock and Worker R2 binding mock contract (`tests/storage.smoke.test.ts`).
- **API & Security Smoke Test:** Validation and error formatting verification (`tests/api.smoke.test.ts`).

---

## 7. Explicit Verification Status & Manual Requirements

- **Verified Locally:**
  - Next.js 16 build & TypeScript compilation.
  - Vitest test suite (12 tests across 4 files: environment validation, repository pattern, database smoke test, storage abstraction, worker R2 binding contract mock, factory provider resolution).
  - OpenNext Cloudflare Workers build (`npm run cf:build`).
  - ESLint verification.
  - VÉRANE foundation status page and metadata.
- **Requires Live Deployment Credentials (Manual Setup):**
  - **Layerbase Database:** Live `DATABASE_URL` and `DATABASE_AUTH_TOKEN` must be configured in Cloudflare Worker environment variables for production database access.
  - **Cloudflare R2 Buckets:** Cloudflare dashboard buckets (`verane-media-dev`, `verane-media-preview`, `verane-media-prod`) must be provisioned in the Cloudflare dashboard.
