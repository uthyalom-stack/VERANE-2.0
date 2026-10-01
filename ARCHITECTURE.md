# VÉRANE 2.0 — Architectural Specification

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
   ├── Domain Services & Centralized Authorization (AuthorizationService)
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
├── app/                  # Routing, pages, route handlers, server actions (/login, /account, /admin)
├── components/           # UI primitives & design system components
│   └── ui/               # Container, Button, Link, Media
├── domains/              # Business domain logic
│   ├── identity/         # User identity, session management, AuthorizationService
│   ├── customers/        # CustomerProfile abstractions
│   ├── admins/           # AdminProfile abstractions
│   ├── brands/           # Brand entities (UTHY_LUXURY, ALOMZIEE_FOOTIES)
│   ├── rbac/             # Roles, Permissions, AdminRoles, RolePermissions
│   └── audit/            # Audit logging service with sensitive metadata redaction
├── infrastructure/       # Database & external providers
│   ├── database/         # Drizzle connection, schema, repositories, seed
│   └── storage/          # R2 storage providers, Worker binding & MediaService
├── lib/                  # Cross-cutting utilities
│   ├── auth/             # PBKDF2 Web Crypto password hashing, session cookies, auth helpers
│   ├── security/         # Cookie security defaults
│   ├── errors/           # Custom error taxonomy (AppError, UnauthorizedError, ForbiddenError)
│   └── logger/           # Safe logger redacting secret parameters
└── config/               # Environment & app configuration
```

### Server/Client Boundaries

- **Server-Only Code:** Direct database access, R2 storage provider credentials, password hashing, session secrets, and sensitive loggers are guarded with the `"server-only"` package.
- **Client Code:** UI primitives and interactive React components run without secret imports or direct DB references.

---

## 3. Identity, RBAC & Brand Authorization Architecture (Phase 1)

### Customer vs. Admin Separation
- **`users`**: Base transactional entity storing email, display name, PBKDF2 password hash, and active status. Passwords are password-hashed using Web Crypto `PBKDF2-HMAC-SHA256` (100,000 iterations, 32-byte key) compatible with Cloudflare Workers.
- **`customer_profiles`**: Linked 1:1 with `users` for customer-specific state.
- **`admin_profiles`**: Linked 1:1 with `users` for administrative access. Admin state is required for administrative features. Client-provided roles or tokens are strictly untrusted.

### Server-Authoritative Sessions
- **`sessions`**: Server-stored session records with unique `id`, `user_id`, `expires_at`, `last_used_at`, and `revoked_at`.
- **Session Cookies**: Transported via HTTP-only, `SameSite=Lax`, `Path=/`, and production `Secure` cookies (`verane_session`). Session tokens are never exposed in client storage (`localStorage`/`sessionStorage`).

### Role-Based Access Control (RBAC) & Brand Scoping
- **Entities**: `roles`, `permissions`, `role_permissions`, `admin_roles`.
- **Predefined Roles**:
  - `SUPER_ADMIN`: Has global administrative access across all brands. `brand_id` is `null`.
  - `UTHY_ADMIN`: Has administrative access scoped specifically to `UTHY LUXURY` (`brand_id` points to `brand_uthy_luxury`).
  - `ALOMZIEE_ADMIN`: Has administrative access scoped specifically to `ALOMZIEE FOOTIES` (`brand_id` points to `brand_alomziee_footies`).
- **Brand Authorization Enforcement**:
  - Centralized server-side helpers (`requireUser()`, `requireAdmin()`, `requirePermission()`, `requireBrandAccess()`, `requireBrandPermission()`) enforce authorization on the domain boundary before executing database or mutation operations.
  - Cross-brand requests by non-Super Admins are rejected server-side with `ForbiddenError`.

### Audit Logging
- **`audit_logs`**: Captures important administrative actions (`admin.login`, `admin.logout`, `admin.role_changed`, etc.) recording `actor_user_id`, `action`, `entity_type`, `entity_id`, `brand_id`, and `metadata`.
- **Security & Redaction**: `AuditService` recursively redacts sensitive key fields (`password`, `passwordHash`, `token`, `secret`, `authorization`, `cookie`) prior to persistence.

---

## 4. Database Architecture (Drizzle + Layerbase SQLite)

- **ORM:** Drizzle ORM (`drizzle-orm/libsql`).
- **Driver:** `@libsql/client` (provides unified support for local SQLite files `file:local.db`, LibSQL wire protocol, and remote Layerbase SQLite instances).
- **Repository Pattern:** UI components and domain services interact strictly through Repository interfaces (`IdentityRepository`, `RbacRepository`, `BrandRepository`), keeping Drizzle and SQL details isolated inside `src/infrastructure/database/`.

---

## 5. Media Storage Strategy (Cloudflare R2)

The application uses a unified `StorageProvider` abstraction with three explicit execution modes:
1. **Cloudflare Worker Runtime:** `WorkerR2StorageProvider` using native `MEDIA_BUCKET` binding.
2. **Non-Worker Node.js Execution:** `R2StorageProvider` using S3 API.
3. **Local Development & Testing:** `MockStorageProvider` or mock `R2BucketBinding`.

---

## 6. Testing Strategy & Build Verification

- **Runner:** Vitest.
- **Suite**:
  - Environment validation (`tests/env.test.ts`)
  - Storage provider contracts (`tests/storage.smoke.test.ts`)
  - API & Error formatting (`tests/api.smoke.test.ts`)
  - Database smoke tests (`tests/database.smoke.test.ts`)
  - Identity & PBKDF2 password hashing & session lifecycle (`tests/identity.test.ts`)
  - Brand authorization & RBAC scoping & cross-brand denial (`tests/brand-authorization.test.ts`)
  - Audit logging & sensitive field redaction (`tests/audit.test.ts`)
