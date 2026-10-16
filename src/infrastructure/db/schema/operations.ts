import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, id, ts } from "./_helpers";
import { brands } from "./catalog";
import { users } from "./identity";

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: text(),
    brandId: text(),
    action: text().notNull(), // e.g. product.update, inventory.adjust, role.grant
    entityType: text().notNull(),
    entityId: text(),
    beforeJson: text({ mode: "json" }).$type<unknown>(),
    afterJson: text({ mode: "json" }).$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_actor_idx").on(t.actorUserId, t.createdAt)],
);

export const newsletterSubscriptions = sqliteTable(
  "newsletter_subscriptions",
  {
    id: id(),
    email: text().notNull(),
    brandId: text().references(() => brands.id, { onDelete: "set null" }),
    consentedAt: integer({ mode: "timestamp_ms" }).notNull(),
    unsubscribedAt: ts(),
    unsubscribeTokenHash: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_email_brand_uq").on(t.email, t.brandId)],
); // marketing consent is deliberately separate from transactional email

export const customerPreferences = sqliteTable("customer_preferences", {
  userId: text().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  marketingEmailOptIn: integer({ mode: "boolean" }).notNull().default(false),
  orderUpdatesEmail: integer({ mode: "boolean" }).notNull().default(true), // transactional, informational
  favoriteStyles: text({ mode: "json" }).$type<string[]>(),
  sizeNotes: text(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull().default(sql`0`),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text().notNull(), // order_update | wishlist_price | wishlist_restock
    title: text().notNull(),
    body: text(),
    href: text(),
    readAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.readAt)],
);

export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: id(),
    dedupeKey: text().notNull(), // e.g. order-confirmation:<orderId>
    template: text().notNull(),
    toEmail: text().notNull(),
    payloadJson: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text({ enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    nextAttemptAt: ts(),
    sentAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("outbox_dedupe_uq").on(t.dedupeKey)],
);

/** Local mirror of derived events when Turso is absent. Contains no PII (hashed session id only). */
export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: id(),
    name: text().notNull(),
    sessionHash: text(),
    brandId: text(),
    entityType: text(),
    entityId: text(),
    campaign: text(),
    propsJson: text({ mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_name_idx").on(t.name, t.createdAt)],
);
