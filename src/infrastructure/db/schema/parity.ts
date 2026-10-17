import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { brands, products, productVariants } from "./catalog";
import { orders } from "./commerce";
import { createdAt, id, money, ts, updatedAt } from "./_helpers";
import { users } from "./identity";

/**
 * V1 parity tables. These are operational records, distinct from editorial
 * collaborations/campaigns in editorial.ts.
 */

export const backInStockSubscriptions = sqliteTable(
  "back_in_stock_subscriptions",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: text().references(() => productVariants.id, { onDelete: "cascade" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    status: text({ enum: ["active", "notified", "cancelled"] }).notNull().default("active"),
    notifiedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("back_in_stock_product_status_idx").on(t.productId, t.status),
    index("back_in_stock_variant_status_idx").on(t.variantId, t.status),
    uniqueIndex("back_in_stock_email_product_variant_uq").on(t.email, t.productId, t.variantId),
  ],
);

export const collaborationRequests = sqliteTable(
  "brand_collaboration_requests",
  {
    id: id(),
    fromBrandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
    toBrandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
    title: text().notNull(),
    message: text(),
    status: text({ enum: ["pending", "accepted", "rejected", "cancelled"] }).notNull().default("pending"),
    reviewedBy: text().references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts(),
    collaborationId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("brand_collab_request_from_idx").on(t.fromBrandId, t.status),
    index("brand_collab_request_to_idx").on(t.toBrandId, t.status),
    index("brand_collab_request_status_idx").on(t.status),
  ],
);

export const collaborationProducts = sqliteTable(
  "brand_collaboration_products",
  {
    id: id(),
    collaborationId: text().notNull(), // references editorial collaborations; service validates the relation
    brandAProductId: text().notNull().references(() => products.id, { onDelete: "restrict" }),
    brandBProductId: text().notNull().references(() => products.id, { onDelete: "restrict" }),
    name: text().notNull(),
    description: text(),
    price: money().notNull(),
    status: text({ enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("brand_collab_product_collab_idx").on(t.collaborationId),
    index("brand_collab_product_a_idx").on(t.brandAProductId),
    index("brand_collab_product_b_idx").on(t.brandBProductId),
    index("brand_collab_product_status_idx").on(t.status),
  ],
);

export const collaborationProductVariants = sqliteTable(
  "brand_collaboration_variants",
  {
    id: id(),
    collaborationProductId: text().notNull().references(() => collaborationProducts.id, { onDelete: "cascade" }),
    brandAVariantId: text().references(() => productVariants.id, { onDelete: "set null" }),
    brandBVariantId: text().references(() => productVariants.id, { onDelete: "set null" }),
    brandASize: text(),
    brandAColor: text(),
    brandBSize: text(),
    brandBColor: text(),
    onHand: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("brand_collab_variant_product_idx").on(t.collaborationProductId),
    index("brand_collab_variant_a_idx").on(t.brandAVariantId),
    index("brand_collab_variant_b_idx").on(t.brandBVariantId),
  ],
);

export const trackingCampaigns = sqliteTable(
  "tracking_campaigns",
  {
    id: id(),
    brandId: text().references(() => brands.id, { onDelete: "restrict" }),
    name: text().notNull(),
    slug: text().notNull().unique(),
    platform: text().notNull().default("Other"),
    source: text(),
    medium: text(),
    destination: text().notNull().default("/"),
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tracking_campaign_brand_idx").on(t.brandId), index("tracking_campaign_active_idx").on(t.isActive)],
);

export const trackingCampaignVisits = sqliteTable(
  "tracking_campaign_visits",
  {
    id: id(),
    campaignId: text().notNull().references(() => trackingCampaigns.id, { onDelete: "cascade" }),
    brandId: text().references(() => brands.id, { onDelete: "set null" }),
    visitorHash: text().notNull(),
    destination: text().notNull(),
    referrerHost: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("tracking_visit_campaign_idx").on(t.campaignId, t.createdAt),
    index("tracking_visit_visitor_idx").on(t.visitorHash, t.createdAt),
  ],
);

export const orderAttributions = sqliteTable(
  "order_attributions",
  {
    id: id(),
    orderId: text().notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
    campaignId: text().notNull().references(() => trackingCampaigns.id, { onDelete: "restrict" }),
    brandId: text().references(() => brands.id, { onDelete: "set null" }),
    visitorHash: text(),
    model: text().notNull().default("last_touch"),
    createdAt: createdAt(),
  },
  (t) => [index("order_attribution_campaign_idx").on(t.campaignId), index("order_attribution_brand_idx").on(t.brandId)],
);

export const pickupLocations = sqliteTable(
  "pickup_locations",
  {
    id: id(),
    brandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
    name: text().notNull(),
    addressLine1: text().notNull(),
    addressLine2: text(),
    city: text().notNull(),
    state: text().notNull(),
    postalCode: text(),
    country: text().notNull().default("NG"),
    instructions: text(),
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pickup_locations_brand_active_idx").on(t.brandId, t.isActive)],
);

export const orderBrandFulfilments = sqliteTable(
  "order_brand_fulfilments",
  {
    id: id(),
    orderId: text().notNull().references(() => orders.id, { onDelete: "cascade" }),
    brandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
    method: text({ enum: ["delivery", "pickup"] }).notNull().default("delivery"),
    status: text({ enum: ["unfulfilled", "processing", "ready_for_pickup", "shipped", "delivered", "cancelled"] }).notNull().default("unfulfilled"),
    pickupLocationId: text().references(() => pickupLocations.id, { onDelete: "set null" }),
    pickupLocationSnapshot: text(),
    carrier: text(),
    trackingNumber: text(),
    trackingUrl: text(),
    fulfilledAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("order_brand_fulfilment_order_brand_uq").on(t.orderId, t.brandId),
    index("order_brand_fulfilment_brand_status_idx").on(t.brandId, t.status),
  ],
);
