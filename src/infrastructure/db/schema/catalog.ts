import { index, integer, sqliteTable, text, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { createdAt, id, money, ts, updatedAt } from "./_helpers";

export const brands = sqliteTable("brands", {
  id: id(),
  code: text().notNull().unique(), // UTHY_LUXURY | ALOMZIEE_FOOTIES
  slug: text().notNull().unique(), // uthy-luxury | alomzience-footies
  name: text().notNull(),
  tagline: text(),
  description: text(),
  themeKey: text().notNull().default("default"), // maps to design-system theme
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: integer({ mode: "timestamp_ms" }).notNull(),
  updatedAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    parentId: text().references((): any => categories.id, { onDelete: "set null" }),
    slug: text().notNull().unique(),
    name: text().notNull(),
    kind: text({ enum: ["clothing", "footwear", "accessory", "other"] }).notNull().default("clothing"),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    brandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
    slug: text().notNull(),
    name: text().notNull(),
    subtitle: text(),
    description: text(),
    materials: text(),
    fit: text(),
    sizingInfo: text(),
    sizeGuideMediaId: text().references((): any => mediaAssets.id, { onDelete: "set null" }),
    customSizingEnabled: integer({ mode: "boolean" }).notNull().default(false),
    preOrderEnabled: integer({ mode: "boolean" }).notNull().default(false),
    fulfillmentTime: text(),
    careInstructions: text(),
    deliveryInfo: text(),
    productType: text(),
    style: text(),
    occasion: text(),
    currency: text().notNull().default("NGN"),
    basePrice: money().notNull(), // minor units
    compareAtPrice: money(), // original price when on sale
    status: text({ enum: ["draft", "scheduled", "published", "archived"] }).notNull().default("draft"),
    publishAt: ts(),
    isFeatured: integer({ mode: "boolean" }).notNull().default(false),
    seoTitle: text(),
    seoDescription: text(),
    archivedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_brand_slug_uq").on(t.brandId, t.slug),
    index("products_status_idx").on(t.status, t.brandId),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text().notNull().unique(),
    size: text(),
    colorName: text(),
    colorHex: text(),
    priceOverride: money(), // minor units; NULL = use product base price
    isActive: integer({ mode: "boolean" }).notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    uniqueIndex("variants_product_opts_uq").on(t.productId, t.size, t.colorName),
  ],
);

export const productCategories = sqliteTable(
  "product_categories",
  {
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    categoryId: text().notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const collections = sqliteTable(
  "collections",
  {
    id: id(),
    brandId: text().references(() => brands.id, { onDelete: "restrict" }), // NULL = house-wide (SUPER_ADMIN only)
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text(),
    heroMediaId: text(),
    isFeatured: integer({ mode: "boolean" }).notNull().default(false),
    status: text({ enum: ["draft", "scheduled", "published", "archived"] }).notNull().default("draft"),
    publishAt: ts(),
    seoTitle: text(),
    seoDescription: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

export const collectionProducts = sqliteTable(
  "collection_products",
  {
    collectionId: text().notNull().references(() => collections.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: id(),
    brandId: text().references(() => brands.id, { onDelete: "set null" }),
    storageKey: text().notNull().unique(),
    kind: text({ enum: ["image", "video", "model3d"] }).notNull(),
    mimeType: text().notNull(),
    byteSize: integer().notNull(),
    width: integer(),
    height: integer(),
    durationMs: integer(),
    altText: text(),
    posterMediaId: text(),
    isPlaceholder: integer({ mode: "boolean" }).notNull().default(false),
    uploadedBy: text(),
    createdAt: createdAt(),
  },
);

export const productMedia = sqliteTable(
  "product_media",
  {
    id: id(),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: text().references(() => productVariants.id, { onDelete: "set null" }),
    mediaId: text().notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
    role: text({ enum: ["primary", "secondary", "model", "lifestyle", "detail", "video", "model3d"] }).notNull().default("secondary"),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index("product_media_product_idx").on(t.productId, t.sortOrder)],
);

/** One row per variant: the single authoritative stock source. available = onHand - reserved. */
export const inventoryLevels = sqliteTable(
  "inventory_levels",
  {
    variantId: text().primaryKey().references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    lowStockThreshold: integer().notNull().default(3),
    allowBackorder: integer({ mode: "boolean" }).notNull().default(false),
    updatedAt: updatedAt(),
  },
);

export const inventoryTransactions = sqliteTable(
  "inventory_transactions",
  {
    id: id(),
    variantId: text().notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    type: text({
      enum: ["initial", "receive", "adjust", "reserve", "release", "sale", "return", "correction"],
    }).notNull(),
    onHandDelta: integer().notNull().default(0),
    reservedDelta: integer().notNull().default(0),
    reason: text(),
    referenceType: text(), // order | cart | manual
    referenceId: text(),
    idempotencyKey: text(), // makes repeated webhooks/callbacks a no-op
    actorUserId: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("inv_tx_idem_uq").on(t.idempotencyKey),
    index("inv_tx_variant_idx").on(t.variantId, t.createdAt),
  ],
);
