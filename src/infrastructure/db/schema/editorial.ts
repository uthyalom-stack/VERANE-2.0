import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, id, ts, updatedAt } from "./_helpers";
import { brands, collections, mediaAssets, productVariants, products } from "./catalog";

const status = () => text({ enum: ["draft", "scheduled", "published", "archived"] }).notNull().default("draft");

/** Pages: homepage, brand landings, static pages. Layout is data, composed of ordered blocks. */
export const pages = sqliteTable(
  "pages",
  {
    id: id(),
    brandId: text().references(() => brands.id, { onDelete: "restrict" }), // NULL = house-wide
    kind: text({ enum: ["home", "brand_landing", "static"] }).notNull(),
    slug: text().notNull(), // "" for home
    title: text().notNull(),
    status: status(),
    publishAt: ts(),
    seoTitle: text(),
    seoDescription: text(),
    ogMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_kind_brand_slug_uq").on(t.kind, t.brandId, t.slug)],
);

/** `type` selects a block renderer; `data` is validated against that block's zod schema on write. */
export const pageBlocks = sqliteTable(
  "page_blocks",
  {
    id: id(),
    pageId: text().notNull().references(() => pages.id, { onDelete: "cascade" }),
    type: text().notNull(), // hero | product_rail | collection_feature | look_feature | brand_intro | editorial_rail | newsletter | promo | outfit_builder_intro
    sortOrder: integer().notNull().default(0),
    data: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    isVisible: integer({ mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("page_blocks_page_idx").on(t.pageId, t.sortOrder)],
);

export const campaigns = sqliteTable("campaigns", {
  id: id(),
  brandId: text().references(() => brands.id, { onDelete: "restrict" }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  subtitle: text(),
  heroMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  heroMobileMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }), // dedicated mobile crop
  posterMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  ctaLabel: text(),
  ctaHref: text(),
  status: status(),
  startsAt: ts(),
  endsAt: ts(),
  seoTitle: text(),
  seoDescription: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const looks = sqliteTable("looks", {
  id: id(),
  brandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  description: text(),
  stylingNotes: text(),
  imageMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  status: status(),
  publishAt: ts(),
  sortOrder: integer().notNull().default(0),
  seoTitle: text(),
  seoDescription: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lookItems = sqliteTable(
  "look_items",
  {
    id: id(),
    lookId: text().notNull().references(() => looks.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: text().references(() => productVariants.id, { onDelete: "set null" }), // optional pre-selected variant
    sortOrder: integer().notNull().default(0),
    stylingNote: text(),
    // optional hotspot on look image, 0..1 fractions
    hotspotX: integer(), // stored as per-mille (0..1000) to stay integer
    hotspotY: integer(),
  },
  (t) => [index("look_items_look_idx").on(t.lookId, t.sortOrder)],
);

export const journalArticles = sqliteTable("journal_articles", {
  id: id(),
  brandId: text().references(() => brands.id, { onDelete: "restrict" }),
  slug: text().notNull().unique(),
  kind: text({ enum: ["story", "interview", "lookbook", "styling_guide", "film", "brand_story", "collaboration"] }).notNull(),
  title: text().notNull(),
  excerpt: text(),
  coverMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  videoMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  /** Structured body blocks: paragraph | heading | image | quote | product_embed | look_embed | collection_embed */
  body: text({ mode: "json" }).$type<Array<Record<string, unknown>>>().notNull().default([] as never),
  authorName: text(),
  status: status(),
  publishAt: ts(),
  seoTitle: text(),
  seoDescription: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collaborations = sqliteTable("collaborations", {
  id: id(),
  brandId: text().references(() => brands.id, { onDelete: "restrict" }),
  slug: text().notNull().unique(),
  partnerName: text().notNull(),
  title: text().notNull(),
  description: text(),
  coverMediaId: text().references(() => mediaAssets.id, { onDelete: "set null" }),
  collectionId: text().references(() => collections.id, { onDelete: "set null" }),
  status: status(),
  publishAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const slugRedirects = sqliteTable(
  "slug_redirects",
  {
    id: id(),
    entityType: text({ enum: ["product", "collection", "look", "article"] }).notNull(),
    fromPath: text().notNull().unique(),
    toPath: text().notNull(),
    createdAt: createdAt(),
  },
);
