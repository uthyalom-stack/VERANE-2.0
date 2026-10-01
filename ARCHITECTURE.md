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
   │       ├── Drizzle ORM -> Layerbase SQLite (@libsql/client)
   │       └── Media Storage -> Cloudflare R2 (@aws-sdk/client-s3)
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
│   └── storage/          # R2 storage provider & MediaService
├── lib/                  # Cross-cutting utilities (security, logging, errors)
└── config/               # Environment & app configuration
```

### Server/Client Boundaries

- **Server-Only Code:** Direct database access, R2 storage provider credentials, and sensitive loggers are guarded with the `"server-only"` package.
- **Client Code:** UI primitives and interactive React components run without secret imports or direct DB references.

---

## 3. Database Architecture (Drizzle + Layerbase SQLite)

- **ORM:** Drizzle ORM (`drizzle-orm/libsql`).
- **Driver:** `@libsql/client` (provides unified support for local SQLite files `file:local.db`, LibSQL protocol, and remote Layerbase SQLite instances).
- **Repository Pattern:** UI components and domain services interact strictly through Repository interfaces (`ISmokeTestRepository`), keeping Drizzle and SQL details isolated inside `src/infrastructure/database/repositories/`.
- **Migrations:** Managed via `drizzle-kit generate` generating declarative SQL migrations into `./drizzle`.

---

## 4. Media Storage Strategy (Cloudflare R2)

- **Provider Abstraction:** `StorageProvider` interface defining `upload`, `retrieve`, `delete`, and `getPublicUrl`.
- **R2 Implementation:** `R2StorageProvider` using `@aws-sdk/client-s3` targeting Cloudflare R2 endpoints.
- **Local Fallback:** `MockStorageProvider` for isolated local development and test execution.
- **Media Service:** `MediaService` wraps storage providers for high-level domain operations.

---

## 5. Security & Environment Configuration

- **Env Validation:** `src/config/env.ts` enforces strict validation using Zod for server secrets and public client variables.
- **Custom Error Taxonomy:** `src/lib/errors.ts` standardizes `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, and `InfrastructureError`. Stack traces and internal secrets are hidden in production responses.
- **Safe Logger:** `src/lib/logger.ts` automatically redacts sensitive parameters (`token`, `password`, `secret`, `database_auth_token`, `r2_secret_access_key`).
- **Secure Cookies:** `src/lib/security.ts` provides default HTTP-only, SameSite=Lax, Secure cookie configuration.

---

## 6. Testing Strategy

- **Runner:** Vitest.
- **Database Smoke Test:** Real local SQLite write -> read -> delete database verification (`tests/database.smoke.test.ts`).
- **Storage Smoke Test:** Upload -> retrieve -> delete verification (`tests/storage.smoke.test.ts`).
- **API & Security Smoke Test:** Validation and error formatting verification (`tests/api.smoke.test.ts`).

---

## 7. Known Limitations & Verification Notes

- **Cloudflare R2 Credentials:** Verified via `@aws-sdk/client-s3` local unit/integration tests and Wrangler configuration. Production deployment requires live R2 bucket binding credentials.
- **Layerbase Credentials:** Local tests execute against LibSQL/SQLite adapter (`file:test-local.db`). In production, `DATABASE_URL` points to the Layerbase HTTP/WebSocket endpoint.
