import { index, integer, sqliteTable, text, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { createdAt, id, ts, updatedAt } from "./_helpers";
import { brands } from "./catalog";

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text().notNull(),
    emailVerifiedAt: ts(),
    passwordHash: text().notNull(),
    kind: text({ enum: ["customer", "admin"] }).notNull().default("customer"),
    status: text({ enum: ["active", "suspended", "deleted"] }).notNull().default("active"),
    failedLoginCount: integer().notNull().default(0),
    lockedUntil: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const customerProfiles = sqliteTable("customer_profiles", {
  userId: text().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  firstName: text().notNull(),
  lastName: text().notNull(),
  phone: text(),
  preferredBrandId: text().references(() => brands.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const adminProfiles = sqliteTable("admin_profiles", {
  userId: text().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text().notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(), // SHA-256 of the opaque cookie token; raw token is never stored
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer({ mode: "timestamp_ms" }).notNull(),
    ipHash: text(),
    userAgent: text(),
    revokedAt: ts(),
    createdAt: createdAt(),
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
  code: text().notNull().unique(), // SUPER_ADMIN | UTHY_ADMIN | ALOMZIEE_ADMIN | ...
  name: text().notNull(),
  description: text(),
  isSystem: integer({ mode: "boolean" }).notNull().default(true),
});

export const permissions = sqliteTable("permissions", {
  id: id(),
  code: text().notNull().unique(), // e.g. catalog.product.write
  description: text(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text().notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text().notNull().references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

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
