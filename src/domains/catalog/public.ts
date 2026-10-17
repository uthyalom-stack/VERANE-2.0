import { and, asc, desc, eq, exists, gt, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import {
  brands, categories, collectionProducts, collections, inventoryLevels, mediaAssets, productCategories, productMedia, productVariants, products,
} from "@/infrastructure/db/schema";
import { shopQuery, type ShopQuery } from "./schemas";

/** A product is publicly visible only when published (or scheduled and due) and not archived. */
export const publiclyVisible = (now = new Date()): SQL =>
  or(eq(products.status, "published"), and(eq(products.status, "scheduled"), lte(products.publishAt, now)))!;

/** Keep scheduled publication semantics consistent across every public product surface. */
export function isPubliclyVisibleProduct(product: { status: string; publishAt: Date | null }, now = new Date()): boolean {
  return product.status === "published" || (product.status === "scheduled" && product.publishAt !== null && product.publishAt <= now);
}

export async function listShopProducts(db: Db, rawQuery: unknown, now = new Date()) {
  const q: ShopQuery = shopQuery.parse(rawQuery);
  const where: SQL[] = [publiclyVisible(now)];
  if (q.brand) where.push(exists(db.select({ x: sql`1` }).from(brands).where(and(eq(brands.id, products.brandId), eq(brands.slug, q.brand)))));
  if (q.category) where.push(exists(db.select({ x: sql`1` }).from(productCategories).innerJoin(categories, eq(categories.id, productCategories.categoryId)).where(and(eq(productCategories.productId, products.id), eq(categories.slug, q.category)))));
  if (q.collection) where.push(exists(db.select({ x: sql`1` }).from(collectionProducts).innerJoin(collections, eq(collections.id, collectionProducts.collectionId)).where(and(eq(collectionProducts.productId, products.id), eq(collections.slug, q.collection), eq(collections.status, "published")))));
  if (q.minPrice !== undefined) where.push(sql`${products.basePrice} >= ${q.minPrice}`);
  if (q.maxPrice !== undefined) where.push(sql`${products.basePrice} <= ${q.maxPrice}`);
  if (q.style) where.push(eq(products.style, q.style));
  if (q.occasion) where.push(eq(products.occasion, q.occasion));
  if (q.type) where.push(eq(products.productType, q.type));
  if (q.featured) where.push(eq(products.isFeatured, true));
  if (q.sale) where.push(sql`${products.compareAtPrice} > ${products.basePrice}`);
  const variantConds: SQL[] = [eq(productVariants.productId, products.id), eq(productVariants.isActive, true)];
  if (q.size) variantConds.push(eq(productVariants.size, q.size));
  if (q.color) variantConds.push(eq(productVariants.colorName, q.color));
  if (q.size || q.color) where.push(exists(db.select({ x: sql`1` }).from(productVariants).where(and(...variantConds))));
  if (q.availability === "in_stock") {
    where.push(exists(db.select({ x: sql`1` }).from(productVariants).innerJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(...variantConds, or(gt(sql`${inventoryLevels.onHand} - ${inventoryLevels.reserved}`, 0), eq(inventoryLevels.allowBackorder, true))))));
  }
  const order = { featured: [desc(products.isFeatured), desc(products.createdAt)], newest: [desc(products.createdAt)], price_asc: [asc(products.basePrice)], price_desc: [desc(products.basePrice)] }[q.sort];
  const rows = await db.select().from(products).where(and(...where)).orderBy(...order).limit(q.pageSize + 1).offset((q.page - 1) * q.pageSize);
  const hasMore = rows.length > q.pageSize;
  return { items: rows.slice(0, q.pageSize), page: q.page, hasMore, query: q };
}

/** Facets are derived from published catalog data only, so the UI never shows an unsupported filter. */
export async function listAvailableFacets(db: Db, now = new Date()) {
  const visible = publiclyVisible(now);
  const col = async (c: typeof products.style | typeof products.occasion | typeof products.productType) =>
    (await db.selectDistinct({ v: c }).from(products).where(and(visible, sql`${c} IS NOT NULL`))).map((r) => r.v!).sort();
  const sizes = await db.selectDistinct({ v: productVariants.size }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(and(visible, eq(productVariants.isActive, true), sql`${productVariants.size} IS NOT NULL`));
  const colors = await db.selectDistinct({ v: productVariants.colorName }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(and(visible, eq(productVariants.isActive, true), sql`${productVariants.colorName} IS NOT NULL`));
  return { styles: await col(products.style), occasions: await col(products.occasion), types: await col(products.productType), sizes: sizes.map((r) => r.v!), colors: colors.map((r) => r.v!) };
}

export async function getPublishedProduct(db: Db, brandSlug: string | null, slug: string, now = new Date()) {
  const [row] = await db.select({ p: products, brand: brands }).from(products).innerJoin(brands, eq(brands.id, products.brandId))
    .where(and(eq(products.slug, slug), publiclyVisible(now), brandSlug ? eq(brands.slug, brandSlug) : sql`1=1`));
  if (!row) return null;
  const variants = await db.select({ v: productVariants, level: inventoryLevels }).from(productVariants)
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(and(eq(productVariants.productId, row.p.id), eq(productVariants.isActive, true))).orderBy(asc(productVariants.sortOrder));
  const media = await db.select({ pm: productMedia, m: mediaAssets }).from(productMedia).innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaId))
    .where(eq(productMedia.productId, row.p.id)).orderBy(asc(productMedia.sortOrder));
  return {
    product: row.p, brand: row.brand, media,
    variants: variants.map(({ v, level }) => ({
      ...v, unitPrice: v.priceOverride ?? row.p.basePrice,
      available: level ? level.onHand - level.reserved : 0, allowBackorder: level?.allowBackorder ?? false,
    })),
  };
}


export type CardData = {
  product: typeof products.$inferSelect; brand: typeof brands.$inferSelect;
  image: { key: string; alt: string } | null; hoverImage: { key: string; alt: string } | null;
  colors: string[]; colorSwatches: Array<{ name: string; hex: string | null }>; inStock: boolean;
  variants: Array<{ id: string; size: string | null; colorName: string | null; colorHex: string | null; unitPrice: number; available: number; allowBackorder: boolean }>;
};

/** One round of queries for a page of product cards (no N+1). */
export async function toCardData(db: Db, items: Array<typeof products.$inferSelect>): Promise<CardData[]> {
  if (!items.length) return [];
  const ids = items.map((p) => p.id);
  const [brandRows, media, vars] = await Promise.all([
    db.select().from(brands).where(inArray(brands.id, [...new Set(items.map((p) => p.brandId))])),
    db.select({ pm: productMedia, m: mediaAssets }).from(productMedia).innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaId))
      .where(and(inArray(productMedia.productId, ids), sql`${productMedia.role} IN ('primary','secondary','model')`)).orderBy(asc(productMedia.sortOrder)),
    db.select({ v: productVariants, l: inventoryLevels }).from(productVariants).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true))).orderBy(asc(productVariants.sortOrder)),
  ]);
  const bMap = new Map(brandRows.map((b) => [b.id, b]));
  return items.map((p) => {
    const m = media.filter((x) => x.pm.productId === p.id);
    const first = m.find((x) => x.pm.role === "primary") ?? m[0];
    const second = m.find((x) => x !== first);
    const pv = vars.filter((x) => x.v.productId === p.id);
    return {
      product: p, brand: bMap.get(p.brandId)!,
      image: first ? { key: first.m.storageKey, alt: first.m.altText ?? p.name } : null,
      hoverImage: second ? { key: second.m.storageKey, alt: second.m.altText ?? p.name } : null,
      colors: [...new Set(pv.map((x) => x.v.colorName).filter((c): c is string => !!c))],
      colorSwatches: [...new Map(pv.filter((x) => x.v.colorName).map((x) => [x.v.colorName!, { name: x.v.colorName!, hex: x.v.colorHex }])).values()],
      inStock: pv.some((x) => x.l && (x.l.onHand - x.l.reserved > 0 || x.l.allowBackorder)),
      variants: pv.map(({ v, l }) => ({ id: v.id, size: v.size, colorName: v.colorName, colorHex: v.colorHex, unitPrice: v.priceOverride ?? p.basePrice, available: l ? l.onHand - l.reserved : 0, allowBackorder: l?.allowBackorder ?? false })),

    };
  });
}

export async function listBrands(db: Db) {
  return db.select().from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.name));
}
