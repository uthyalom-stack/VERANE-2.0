import { eq, inArray, desc } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { inventoryLevels, productCategories, productVariants, products, slugRedirects, brands } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { assertCan, scopedBrandIds, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { setInitialStock } from "@/domains/inventory";
import { reindexProduct } from "@/domains/search";
import { productInput, resolveSlug, type ProductInput } from "./schemas";

/** Brand is read from the DB row for existing products; client-supplied brandId is only trusted after an authorization check on it. */
export async function createProduct(db: Db, actor: Actor, raw: unknown) {
  const candidateBrandId = raw && typeof raw === "object" && "brandId" in raw && typeof (raw as { brandId?: unknown }).brandId === "string"
    ? (raw as { brandId: string }).brandId
    : undefined;
  assertCan(actor, "catalog.product.write", candidateBrandId);
  const input = productInput.parse(raw);
  const [brand] = await db.select().from(brands).where(eq(brands.id, input.brandId));
  if (!brand?.isActive) throw new AppError("VALIDATION", "Unknown brand");
  const slug = resolveSlug(input);
  const id = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(products).values(rowFrom(id, input, slug));
      if (input.categoryIds.length) await tx.insert(productCategories).values(input.categoryIds.map((categoryId) => ({ productId: id, categoryId })));
      for (const v of input.variants) {
        const vid = crypto.randomUUID();
        await tx.insert(productVariants).values({
          id: vid, productId: id, sku: v.sku.toUpperCase(), size: v.size ?? null, colorName: v.colorName ?? null, colorHex: v.colorHex ?? null,
          priceOverride: v.priceOverride ?? null, isActive: v.isActive, sortOrder: v.sortOrder,
        });
        await tx.insert(inventoryLevels).values({ variantId: vid, onHand: 0, reserved: 0 });
      }
      await writeAudit(tx, { actorUserId: actor.userId, action: "product.create", entityType: "product", entityId: id, brandId: input.brandId, after: { ...input, variants: input.variants.length } });
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "A product with this slug or SKU already exists");
    throw e;
  }
  await reindexProduct(db, id);
  // opening stock goes through the ledger so history is complete
  for (const v of input.variants) {
    if (v.initialStock) {
      const [row] = await db.select().from(productVariants).where(eq(productVariants.sku, v.sku.toUpperCase()));
      if (row) await setInitialStock(db, row.id, v.initialStock, actor.userId);
    }
  }
  return { id, slug };
}

export async function updateProduct(db: Db, actor: Actor, productId: string, raw: unknown) {
  const [existing] = await db.select().from(products).where(eq(products.id, productId));
  if (!existing) throw new AppError("NOT_FOUND", "Product not found");
  assertCan(actor, "catalog.product.write", existing.brandId); // authorize before parsing client-controlled data
  const input = productInput.parse(raw);
  if (input.brandId !== existing.brandId) assertCan(actor, "catalog.product.write", input.brandId); // and target brand for moves
  const slug = resolveSlug(input);
  await db.transaction(async (tx) => {
    const { id: _id, ...patch } = rowFrom(productId, input as ProductInput, slug);
    await tx.update(products).set(patch).where(eq(products.id, productId));
    await tx.delete(productCategories).where(eq(productCategories.productId, productId));
    if (input.categoryIds.length) await tx.insert(productCategories).values(input.categoryIds.map((categoryId) => ({ productId, categoryId })));
    if (slug !== existing.slug) {
      await tx.insert(slugRedirects).values({ entityType: "product", fromPath: `/product/${existing.slug}`, toPath: `/product/${slug}` }).onConflictDoNothing();
    }
    await writeAudit(tx, { actorUserId: actor.userId, action: existing.basePrice !== input.basePrice ? "product.update+price" : "product.update", entityType: "product", entityId: productId, brandId: existing.brandId, before: existing, after: input });
  });
  await reindexProduct(db, productId);
}

export async function archiveProduct(db: Db, actor: Actor, productId: string) {
  const [existing] = await db.select().from(products).where(eq(products.id, productId));
  if (!existing) throw new AppError("NOT_FOUND", "Product not found");
  assertCan(actor, "catalog.product.write", existing.brandId);
  await db.update(products).set({ status: "archived", archivedAt: new Date() }).where(eq(products.id, productId));
  await writeAudit(db, { actorUserId: actor.userId, action: "product.archive", entityType: "product", entityId: productId, brandId: existing.brandId, before: { status: existing.status } });
}

export async function getProductForAdmin(db: Db, actor: Actor, productId: string) {
  const [p] = await db.select().from(products).where(eq(products.id, productId));
  if (!p) throw new AppError("NOT_FOUND", "Product not found");
  assertCan(actor, "catalog.product.read", p.brandId); // reads are authorized too
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  return { product: p, variants };
}

export async function listProductsForAdmin(db: Db, actor: Actor, opts: { limit?: number } = {}) {
  const scope = scopedBrandIds(actor, "catalog.product.read");
  if (scope !== "all" && scope.length === 0) return [];
  const q = db.select().from(products).orderBy(desc(products.updatedAt)).limit(Math.min(opts.limit ?? 50, 200));
  return scope === "all" ? q : q.where(inArray(products.brandId, scope));
}

function rowFrom(id: string, i: ProductInput, slug: string): typeof products.$inferInsert {
  return {
    id, brandId: i.brandId, slug, name: i.name, subtitle: i.subtitle ?? null, description: i.description ?? null,
    materials: i.materials ?? null, fit: i.fit ?? null, sizingInfo: i.sizingInfo ?? null, careInstructions: i.careInstructions ?? null,
    deliveryInfo: i.deliveryInfo ?? null, productType: i.productType ?? null, style: i.style ?? null, occasion: i.occasion ?? null,
    currency: i.currency, basePrice: i.basePrice, compareAtPrice: i.compareAtPrice ?? null, status: i.status,
    publishAt: i.publishAt ?? null, isFeatured: i.isFeatured, seoTitle: i.seoTitle ?? null, seoDescription: i.seoDescription ?? null,
  };
}
