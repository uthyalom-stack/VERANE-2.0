import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { categories, collectionProducts, collections, mediaAssets, orderItems, productMedia, productVariants, products, inventoryLevels, brands } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { assertCan, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { variantInput } from "@/domains/catalog/schemas";
import { setInitialStock } from "@/domains/inventory";
import { reindexProduct } from "@/domains/search";
import { brandScopeWhere } from "./scope";

async function productOrThrow(db: Db, id: string) { const [p] = await db.select().from(products).where(eq(products.id, id)); if (!p) throw new AppError("NOT_FOUND", "Product not found"); return p; }

/** Create or update ONE variant of a product. Authorization derives from the product's stored brand. */
export async function upsertVariant(db: Db, actor: Actor, productId: string, raw: unknown) {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  const v = variantInput.parse(raw);
  try {
    if (v.id) {
      const [ex] = await db.select().from(productVariants).where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)));
      if (!ex) throw new AppError("NOT_FOUND", "Variant not found");
      await db.update(productVariants).set({ sku: v.sku.toUpperCase(), size: v.size ?? null, colorName: v.colorName ?? null, colorHex: v.colorHex ?? null, priceOverride: v.priceOverride ?? null, isActive: v.isActive, sortOrder: v.sortOrder }).where(eq(productVariants.id, v.id));
      await writeAudit(db, { actorUserId: actor.userId, action: "variant.update", entityType: "variant", entityId: v.id, brandId: p.brandId, before: ex, after: v });
    } else {
      const id = crypto.randomUUID();
      await db.insert(productVariants).values({ id, productId, sku: v.sku.toUpperCase(), size: v.size ?? null, colorName: v.colorName ?? null, colorHex: v.colorHex ?? null, priceOverride: v.priceOverride ?? null, isActive: v.isActive, sortOrder: v.sortOrder });
      await db.insert(inventoryLevels).values({ variantId: id, onHand: 0, reserved: 0 });
      if (v.initialStock) await setInitialStock(db, id, v.initialStock, actor.userId);
      await writeAudit(db, { actorUserId: actor.userId, action: "variant.create", entityType: "variant", entityId: id, brandId: p.brandId, after: v });
    }
  } catch (e) { if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "That SKU or size/colour combination already exists"); throw e; }
}

/** Variants that appear on orders can never be deleted (history); they are deactivated instead. */
export async function removeVariant(db: Db, actor: Actor, productId: string, variantId: string) {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  const used = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.variantId, variantId)).limit(1);
  if (used.length) { await db.update(productVariants).set({ isActive: false }).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))); }
  else await db.delete(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
  await writeAudit(db, { actorUserId: actor.userId, action: used.length ? "variant.deactivate" : "variant.delete", entityType: "variant", entityId: variantId, brandId: p.brandId });
}

export async function setProductStatus(db: Db, actor: Actor, productId: string, status: "draft" | "published") {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  await db.update(products).set({ status, archivedAt: null }).where(eq(products.id, productId));
  await reindexProduct(db, productId);
  await writeAudit(db, { actorUserId: actor.userId, action: "product.status", entityType: "product", entityId: productId, brandId: p.brandId, before: { status: p.status }, after: { status } });
}

export async function attachProductMedia(db: Db, actor: Actor, productId: string, input: { mediaId: string; role: typeof productMedia.$inferInsert.role; variantId?: string | null }) {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  const [m] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, input.mediaId));
  if (!m) throw new AppError("NOT_FOUND", "Media not found");
  if (m.brandId && m.brandId !== p.brandId) throw new AppError("FORBIDDEN", "That media belongs to another brand"); // cross-brand reuse blocked
  const [last] = await db.select().from(productMedia).where(eq(productMedia.productId, productId)).orderBy(asc(productMedia.sortOrder));
  await db.insert(productMedia).values({ productId, mediaId: m.id, role: input.role ?? "secondary", variantId: input.variantId ?? null, sortOrder: (last ? last.sortOrder : 0) + 10 });
  await writeAudit(db, { actorUserId: actor.userId, action: "product.media.attach", entityType: "product", entityId: productId, brandId: p.brandId, after: input });
}
export async function detachProductMedia(db: Db, actor: Actor, productId: string, productMediaId: string) {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  await db.delete(productMedia).where(and(eq(productMedia.id, productMediaId), eq(productMedia.productId, productId)));
}
/** Persist a full ordering: ids[0] first. */
export async function reorderProductMedia(db: Db, actor: Actor, productId: string, ids: string[]) {
  const p = await productOrThrow(db, productId); assertCan(actor, "catalog.product.write", p.brandId);
  for (const [i, id] of ids.entries()) await db.update(productMedia).set({ sortOrder: i * 10 }).where(and(eq(productMedia.id, id), eq(productMedia.productId, productId)));
}

/* ---- categories: house-wide taxonomy, global-only permission ---- */
const catSchema = z.object({ name: z.string().trim().min(2).max(60), kind: z.enum(["clothing", "footwear", "accessory", "other"]), sortOrder: z.coerce.number().int().min(0).default(0) });
export async function saveCategory(db: Db, actor: Actor, raw: unknown, id?: string) {
  assertCan(actor, "catalog.category.write", null);
  const c = catSchema.parse(raw); const slug = slugify(c.name);
  if (id) await db.update(categories).set({ ...c, slug }).where(eq(categories.id, id)); else await db.insert(categories).values({ ...c, slug }).onConflictDoNothing();
  await writeAudit(db, { actorUserId: actor.userId, action: id ? "category.update" : "category.create", entityType: "category", entityId: id ?? slug, after: c });
}

/* ---- collections ---- */
const colSchema = z.object({
  brandId: z.string().nullable().optional(), title: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  description: z.string().max(2000).nullable().optional(), heroMediaId: z.string().nullable().optional(), isFeatured: z.coerce.boolean().default(false),
  status: z.enum(["draft", "scheduled", "published", "archived"]).default("draft"), publishAt: z.coerce.date().nullable().optional(),
  seoTitle: z.string().max(70).nullable().optional(), seoDescription: z.string().max(170).nullable().optional(),
});
export async function saveCollection(db: Db, actor: Actor, raw: unknown, id?: string) {
  const c = colSchema.parse(raw); const brandId = c.brandId || null;
  if (c.status === "scheduled" && !c.publishAt) throw new AppError("VALIDATION", "Choose a publish date");
  if (id) { const [ex] = await db.select().from(collections).where(eq(collections.id, id)); if (!ex) throw new AppError("NOT_FOUND", "Collection not found"); assertCan(actor, "catalog.collection.write", ex.brandId); }
  assertCan(actor, "catalog.collection.write", brandId);
  const row = { brandId, title: c.title, slug: c.slug ?? slugify(c.title), description: c.description ?? null, heroMediaId: c.heroMediaId || null, isFeatured: c.isFeatured, status: c.status, publishAt: c.publishAt ?? null, seoTitle: c.seoTitle ?? null, seoDescription: c.seoDescription ?? null };
  try { if (id) await db.update(collections).set(row).where(eq(collections.id, id)); else id = (await db.insert(collections).values(row).returning())[0]!.id; }
  catch (e) { if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "A collection with that slug already exists"); throw e; }
  await writeAudit(db, { actorUserId: actor.userId, action: "collection.save", entityType: "collection", entityId: id!, brandId, after: row });
  return id!;
}
/** Only products of the collection's brand may be added (house-wide collections: any brand, SUPER_ADMIN only). */
export async function setCollectionProducts(db: Db, actor: Actor, collectionId: string, productIds: string[]) {
  const [c] = await db.select().from(collections).where(eq(collections.id, collectionId)); if (!c) throw new AppError("NOT_FOUND", "Collection not found");
  assertCan(actor, "catalog.collection.write", c.brandId);
  const ps = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
  if (ps.length !== new Set(productIds).size) throw new AppError("VALIDATION", "Unknown product in list");
  if (c.brandId && ps.some((p) => p.brandId !== c.brandId)) throw new AppError("FORBIDDEN", "A product from another brand cannot be added to this collection");
  await db.transaction(async (tx) => { await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId)); for (const [i, pid] of [...new Set(productIds)].entries()) await tx.insert(collectionProducts).values({ collectionId, productId: pid, sortOrder: i }); });
  await writeAudit(db, { actorUserId: actor.userId, action: "collection.products", entityType: "collection", entityId: collectionId, brandId: c.brandId, after: productIds });
}
export async function listCollectionsAdmin(db: Db, actor: Actor) { return db.select().from(collections).where(brandScopeWhere(actor, "catalog.collection.write", collections.brandId)); }
export async function listBrandsAdmin(db: Db) { return db.select().from(brands); }
