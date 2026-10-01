import { sqliteTable, text, integer, primaryKey, index, AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { brands } from "./brands";
import { users } from "./users";

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    shortDescription: text("short_description"),
    fullDescription: text("full_description"),
    status: text("status", { enum: ["DRAFT", "ACTIVE", "ARCHIVED"] })
      .notNull()
      .default("DRAFT"),
    basePriceCents: integer("base_price_cents").notNull().default(0), // Authoritative base price in minor units (kobo/cents)
    currency: text("currency").notNull().default("NGN"),
    materials: text("materials"),
    careInfo: text("care_info"),
    fitInfo: text("fit_info"),
    sizingInfo: text("sizing_info"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (table) => [
    index("idx_products_brand_id").on(table.brandId),
    index("idx_products_slug").on(table.slug),
    index("idx_products_status").on(table.status),
  ]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    size: text("size"),
    color: text("color"),
    colorCode: text("color_code"),
    priceOverrideCents: integer("price_override_cents"), // Integer minor unit (kobo/cents)
    currency: text("currency").notNull().default("NGN"),
    barcode: text("barcode"),
    weightGrams: integer("weight_grams"),
    dimensions: text("dimensions"),
    status: text("status", { enum: ["ACTIVE", "INACTIVE", "ARCHIVED"] })
      .notNull()
      .default("ACTIVE"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (table) => [
    index("idx_product_variants_product_id").on(table.productId),
    index("idx_product_variants_sku").on(table.sku),
    index("idx_product_variants_status").on(table.status),
  ]
);

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, {
      onDelete: "set null",
    }),
    brandId: text("brand_id").references(() => brands.id, { onDelete: "cascade" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_categories_slug").on(table.slug),
    index("idx_categories_parent_id").on(table.parentId),
    index("idx_categories_brand_id").on(table.brandId),
  ]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const productCategories = sqliteTable(
  "product_categories",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("idx_product_categories_product_id").on(table.productId),
    index("idx_product_categories_category_id").on(table.categoryId),
  ]
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;

export const collections = sqliteTable(
  "collections",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    status: text("status", { enum: ["DRAFT", "ACTIVE", "ARCHIVED"] })
      .notNull()
      .default("DRAFT"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
  },
  (table) => [
    index("idx_collections_brand_id").on(table.brandId),
    index("idx_collections_slug").on(table.slug),
    index("idx_collections_status").on(table.status),
  ]
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;

export const collectionProducts = sqliteTable(
  "collection_products",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("idx_collection_products_collection_id").on(table.collectionId),
    index("idx_collection_products_product_id").on(table.productId),
    index("idx_collection_products_position").on(table.position),
  ]
);

export type CollectionProduct = typeof collectionProducts.$inferSelect;
export type NewCollectionProduct = typeof collectionProducts.$inferInsert;

export const inventory = sqliteTable(
  "inventory",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .unique()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("idx_inventory_variant_id").on(table.variantId)]
);

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;

export const inventoryTransactions = sqliteTable(
  "inventory_transactions",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: [
        "STOCK_RECEIVED",
        "MANUAL_ADJUSTMENT",
        "RESERVATION",
        "RELEASE",
        "SALE",
        "RETURN",
        "CORRECTION",
      ],
    }).notNull(),
    quantityChange: integer("quantity_change").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_inventory_tx_variant_id").on(table.variantId),
    index("idx_inventory_tx_actor_id").on(table.actorUserId),
  ]
);

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type NewInventoryTransaction = typeof inventoryTransactions.$inferInsert;

export const productMedia = sqliteTable(
  "product_media",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    mediaType: text("media_type", {
      enum: [
        "IMAGE",
        "VIDEO",
        "MODEL_IMAGE",
        "DETAIL_IMAGE",
        "EDITORIAL",
        "PRODUCT_VIDEO",
        "VIDEO_POSTER",
        "ASSET_3D",
      ],
    }).notNull(),
    url: text("url").notNull(),
    altText: text("alt_text"),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    posterUrl: text("poster_url"),
    position: integer("position").notNull().default(0),
    metadata: text("metadata"), // Stringified JSON for extra extensible properties
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_product_media_product_id").on(table.productId),
    index("idx_product_media_variant_id").on(table.variantId),
    index("idx_product_media_position").on(table.position),
  ]
);

export type ProductMedia = typeof productMedia.$inferSelect;
export type NewProductMedia = typeof productMedia.$inferInsert;
