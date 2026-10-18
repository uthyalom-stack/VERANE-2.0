import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { categories, inventoryLevels, outfitItems, productCategories, productVariants, products, savedOutfits } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import { publiclyVisible } from "@/domains/catalog/public";

export const SLOTS = ["top", "bottom", "outerwear", "dress", "footwear", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];
const KIND_SLOTS: Record<string, Slot[]> = { footwear: ["footwear"], accessory: ["accessory"], clothing: ["top", "bottom", "outerwear", "dress"], other: ["accessory"] };

const itemSchema = z.object({
  productId: z.string().min(1), variantId: z.string().nullable().optional(), slot: z.enum(SLOTS),
  sortOrder: z.number().int().min(0).max(50).default(0),
  x: z.number().int().min(0).max(1000).default(500), y: z.number().int().min(0).max(1000).default(500), scale: z.number().int().min(300).max(2000).default(1000),
});
export const outfitInput = z.object({ name: z.string().trim().min(1).max(80), brandId: z.string().nullable().optional(), items: z.array(itemSchema).min(1).max(12) });
export type OutfitItemInput = z.infer<typeof itemSchema>;

/** Authoritative resolution: price, availability, variant ownership and slot eligibility all come from the DB. */
export async function resolveOutfit(db: Db, rawItems: unknown) {
  const items = z.array(itemSchema).max(12).parse(rawItems);
  if (!items.length) return { lines: [], total: 0, currency: "NGN", allAvailable: true };
  const ps = await db.select().from(products).where(and(inArray(products.id, items.map((i) => i.productId)), publiclyVisible()));
  const kinds = await db.select({ pid: productCategories.productId, kind: categories.kind }).from(productCategories).innerJoin(categories, eq(categories.id, productCategories.categoryId)).where(inArray(productCategories.productId, ps.map((p) => p.id)));
  const vs = ps.length ? await db.select({ v: productVariants, l: inventoryLevels }).from(productVariants).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id)).where(and(inArray(productVariants.productId, ps.map((p) => p.id)), eq(productVariants.isActive, true))) : [];
  const lines = items.map((i) => {
    const p = ps.find((x) => x.id === i.productId);
    if (!p) throw new AppError("VALIDATION", "One of the items is no longer available");
    const allowed = new Set(kinds.filter((k) => k.pid === p.id).flatMap((k) => KIND_SLOTS[k.kind] ?? []));
    if (allowed.size && !allowed.has(i.slot)) throw new AppError("VALIDATION", `${p.name} can't be placed in the ${i.slot} slot`);
    let v = i.variantId ? vs.find((x) => x.v.id === i.variantId) : undefined;
    if (i.variantId && (!v || v.v.productId !== p.id)) throw new AppError("VALIDATION", "Invalid size or colour for that item");
    const options = vs.filter((x) => x.v.productId === p.id);
    const unitPrice = (v ?? options[0])?.v.priceOverride ?? p.basePrice;
    const available = v ? !!v.l && (v.l.onHand - v.l.reserved > 0 || v.l.allowBackorder) : options.some((x) => x.l && (x.l.onHand - x.l.reserved > 0 || x.l.allowBackorder));
    return { ...i, name: p.name, brandId: p.brandId, unitPrice, currency: p.currency, available, needsVariant: !v && options.length > 1 };
  });
  return { lines, total: lines.reduce((s, l) => s + l.unitPrice, 0), currency: lines[0]?.currency ?? "NGN", allAvailable: lines.every((l) => l.available) };
}

export async function saveOutfit(db: Db, userId: string, raw: unknown, id?: string) {
  const input = outfitInput.parse(raw);
  await resolveOutfit(db, input.items); // reject anything that isn't a real, visible, eligible product
  const outfitId = id ?? crypto.randomUUID();
  await db.transaction(async (tx) => {
    if (id) {
      const r = await tx.update(savedOutfits).set({ name: input.name, brandId: input.brandId ?? null }).where(and(eq(savedOutfits.id, id), eq(savedOutfits.userId, userId)));
      if (((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) throw new AppError("NOT_FOUND", "Outfit not found");
      await tx.delete(outfitItems).where(eq(outfitItems.outfitId, id));
    } else await tx.insert(savedOutfits).values({ id: outfitId, userId, name: input.name, brandId: input.brandId ?? null });
    await tx.insert(outfitItems).values(input.items.map((i, n) => ({ outfitId, productId: i.productId, variantId: i.variantId ?? null, slot: i.slot, sortOrder: i.sortOrder || n, x: i.x, y: i.y, scale: i.scale })));
  });
  return outfitId;
}

export async function listOutfits(db: Db, userId: string) { return db.select().from(savedOutfits).where(eq(savedOutfits.userId, userId)).orderBy(desc(savedOutfits.updatedAt)); }
export async function deleteOutfit(db: Db, userId: string, id: string) { await db.delete(savedOutfits).where(and(eq(savedOutfits.id, id), eq(savedOutfits.userId, userId))); }

export async function loadOutfit(db: Db, where: { id: string; userId: string } | { shareToken: string }) {
  const [o] = "shareToken" in where
    ? await db.select().from(savedOutfits).where(eq(savedOutfits.shareToken, where.shareToken))
    : await db.select().from(savedOutfits).where(and(eq(savedOutfits.id, where.id), eq(savedOutfits.userId, where.userId)));
  if (!o) return null;
  const items = await db.select().from(outfitItems).where(eq(outfitItems.outfitId, o.id)).orderBy(outfitItems.sortOrder);
  return { outfit: o, items };
}
export async function setShared(db: Db, userId: string, id: string, shared: boolean): Promise<string | null> {
  const token = shared ? randomToken(16) : null;
  const r = await db.update(savedOutfits).set({ shareToken: token }).where(and(eq(savedOutfits.id, id), eq(savedOutfits.userId, userId)));
  if (((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) throw new AppError("NOT_FOUND", "Outfit not found");
  return token;
}

/** Eligible catalogue for the builder (bounded). Slot comes from category kind. */
export async function builderCatalog(db: Db, opts: { brandSlug?: string } = {}) {
  const rows = await db.select().from(products).where(publiclyVisible()).limit(120);
  const ids = rows.map((r) => r.id);
  const kinds = ids.length ? await db.select({ pid: productCategories.productId, kind: categories.kind, slug: categories.slug }).from(productCategories).innerJoin(categories, eq(categories.id, productCategories.categoryId)).where(inArray(productCategories.productId, ids)) : [];
  const { toCardData } = await import("@/domains/catalog/public");
  const cards = await toCardData(db, rows);
  const vs = ids.length ? await db.select({ v: productVariants, l: inventoryLevels }).from(productVariants).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id)).where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true))) : [];
  return cards.filter((c) => !opts.brandSlug || c.brand.slug === opts.brandSlug).map((c) => {
    const k = kinds.filter((x) => x.pid === c.product.id);
    const slots = [...new Set(k.flatMap((x) => KIND_SLOTS[x.kind] ?? []))];
    const slugs = k.map((x) => x.slug);
    const defaultSlot: Slot = slugs.includes("dresses") ? "dress" : slugs.includes("outerwear") ? "outerwear" : slugs.includes("trousers") ? "bottom" : (slots[0] ?? "accessory");
    return { id: c.product.id, name: c.product.name, brand: c.brand.name, brandSlug: c.brand.slug, price: c.product.basePrice, currency: c.product.currency, image: c.image?.key ?? null, slots: slots.length ? slots : ["accessory" as Slot], defaultSlot,
      variants: vs.filter((x) => x.v.productId === c.product.id).map(({ v, l }) => ({ id: v.id, size: v.size, colorName: v.colorName, available: !!l && (l.onHand - l.reserved > 0 || l.allowBackorder) })) };
  });
}
