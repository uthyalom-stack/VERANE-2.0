import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { createdAt, id, ts, updatedAt } from "./_helpers";
import { brands } from "./catalog";

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text().notNull(),
    name: text().notNull(), // retained from the original migration; always supplied by registration/seed
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    emailVerifiedAt: ts(),
    passwordHash: text().notNull(),
    kind: text({ enum: ["customer", "admin"] }).notNull().default("customer"),
    status: text({ enum: ["active", "suspended", "deleted"] }).notNull().default("active"),
    failedLoginCount: integer().notNull().default(0),
    lockedUntil: ts(),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const customerProfiles = sqliteTable("customer_profiles", {
  id: id(),
  userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text().notNull().default(""),
  lastName: text().notNull().default(""),
  phone: text(),
  preferredBrandId: text().references(() => brands.id, { onDelete: "set null" }),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("customer_profiles_user_id_unique").on(t.userId)]);

export const adminProfiles = sqliteTable("admin_profiles", {
  id: id(),
  userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: text().notNull().default(""),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("admin_profiles_user_id_unique").on(t.userId)]);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text(), // SHA-256 of the opaque cookie token; nullable only for rows from the legacy schema
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer({ mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer({ mode: "timestamp_ms" }).notNull().default(sql`0`),
    ipHash: text(),
    userAgent: text(),
    revokedAt: ts(),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const oneTimeTokens = sqliteTable(
  "one_time_tokens",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    purpose: text({ enum: ["verify_email", "reset_password"] }).notNull(),
    tokenHash: text().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    consumedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ott_hash_uq").on(t.tokenHash), index("ott_user_idx").on(t.userId, t.purpose)],
);

export const rateLimitHits = sqliteTable(
  "rate_limit_hits",
  {
    id: id(),
    bucket: text().notNull(), // e.g. login:ip:<hash> or login:email:<hash>
    at: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("rl_bucket_idx").on(t.bucket, t.at)],
);

export const roles = sqliteTable("roles", {
  id: id(),
  code: text().unique(), // nullable for pre-existing legacy rows; seeded roles always receive a code
  name: text().notNull(),
  description: text(),
  isSystem: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("roles_name_unique").on(t.name)]);

export const permissions = sqliteTable("permissions", {
  id: id(),
  name: text().notNull(), // retained from the original migration
  code: text().unique(), // legacy rows may be null until reconciled; new rows always receive a code
  description: text(),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
}, (t) => [uniqueIndex("permissions_name_unique").on(t.name)]);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text().notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text().notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);



/** Legacy RBAC assignments are retained so forward migrations preserve the original table and its data. */
export const adminRoles = sqliteTable("admin_roles", {
  id: id(),
  adminProfileId: text().notNull().references(() => adminProfiles.id, { onDelete: "cascade" }),
  roleId: text().notNull().references(() => roles.id, { onDelete: "cascade" }),
  brandId: text().references(() => brands.id, { onDelete: "cascade" }),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
});

/** brandId NULL = global grant (SUPER_ADMIN). Brand admins always carry a non-null brandId. */
export const userRoles = sqliteTable(
  "user_roles",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text().notNull().references(() => roles.id, { onDelete: "cascade" }),
    brandId: text().references(() => brands.id, { onDelete: "cascade" }),
    grantedBy: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("user_roles_uq").on(t.userId, t.roleId, t.brandId),
    index("user_roles_user_idx").on(t.userId),
  ],
);
