import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { brands, cartItems, carts, discounts, inventoryLevels, mediaAssets, productMedia, productVariants, products } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { computePricing, effectiveUnitPrice, type DiscountRule, type PricingResult } from "@/domains/pricing";
import { publiclyVisible } from "@/domains/catalog/public";

export type CartOwner = { userId: string } | { guestTokenHash: string };

export async function getOrCreateCart(db: Db, owner: CartOwner) {
  const where = "userId" in owner ? and(eq(carts.userId, owner.userId), eq(carts.status, "active")) : and(eq(carts.guestTokenHash, owner.guestTokenHash), eq(carts.status, "active"));
  const [existing] = await db.select().from(carts).where(where);
  if (existing) return existing;
  const [created] = await db.insert(carts).values("userId" in owner ? { userId: owner.userId } : { guestTokenHash: owner.guestTokenHash }).returning();
  return created!;
}

/** Merge a guest cart into the customer's cart on login (quantities add, capped later by availability at view time). */
export async function mergeGuestCart(db: Db, guestTokenHash: string, userId: string) {
  const [guest] = await db.select().from(carts).where(and(eq(carts.guestTokenHash, guestTokenHash), eq(carts.status, "active")));
  if (!guest) return;
  const mine = await getOrCreateCart(db, { userId });
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
  for (const i of items) await upsertQty(db, mine.id, i.variantId, i.quantity, "add", i.customMeasurements);
  await db.update(carts).set({ status: "converted" }).where(eq(carts.id, guest.id));
}

async function upsertQty(db: Db, cartId: string, variantId: string, qty: number, mode: "add" | "set", customMeasurements?: Record<string, number> | null) {
  const [row] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
  const next = Math.min(99, mode === "add" ? (row?.quantity ?? 0) + qty : qty);
  if (next < 1) { if (row) await db.delete(cartItems).where(eq(cartItems.id, row.id)); return; }
  if (row) await db.update(cartItems).set({ quantity: next, ...(customMeasurements !== undefined ? { customMeasurements } : {}) }).where(eq(cartItems.id, row.id));
  else await db.insert(cartItems).values({ cartId, variantId, quantity: next, customMeasurements: customMeasurements ?? null });
}

/** Only publicly purchasable, active variants may enter a cart. The client never supplies price. */
export async function addToCart(db: Db, cartId: string, variantId: string, quantity: number, customMeasurements?: Record<string, number>) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new AppError("VALIDATION", "Invalid quantity");
  const [row] = await db.select({ v: productVariants, p: products, l: inventoryLevels }).from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId)).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.isActive, true), publiclyVisible()));
  if (!row) throw new AppError("NOT_FOUND", "This item is not available");
  const available = row.l ? row.l.onHand - row.l.reserved : 0;
  const preorder = row.p.preOrderEnabled && available <= 0 && !row.l?.allowBackorder;
  if (row.p.customSizingEnabled && !customMeasurements) throw new AppError("VALIDATION", "Enter your custom measurements before adding this piece");
  if (!row.p.customSizingEnabled && customMeasurements) throw new AppError("VALIDATION", "Custom measurements are not enabled for this piece");
  const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
  const wanted = (existing?.quantity ?? 0) + quantity;
  if (!row.l?.allowBackorder && !preorder && wanted > available) throw new AppError("OUT_OF_STOCK", available > 0 ? `Only ${available} left in this size` : "This item is sold out");
  await upsertQty(db, cartId, variantId, quantity, "add", customMeasurements);
}

export async function setCartQuantity(db: Db, cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new AppError("VALIDATION", "Invalid quantity");
  if (quantity > 0) {
    const [row] = await db.select({ l: inventoryLevels, p: products }).from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId)).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(eq(productVariants.id, variantId));
    const available = row?.l ? row.l.onHand - row.l.reserved : 0;
    const preorder = !!row?.p.preOrderEnabled && available <= 0 && !row?.l?.allowBackorder;
    if (!row || (!row.l?.allowBackorder && !preorder && quantity > available)) throw new AppError("OUT_OF_STOCK", "Not enough stock for that quantity");
  }
  await upsertQty(db, cartId, variantId, quantity, "set");
}

export async function applyDiscountCode(db: Db, cartId: string, code: string | null) {
  if (code) {
    const [d] = await db.select().from(discounts).where(eq(discounts.code, code.trim().toUpperCase()));
    if (!d) throw new AppError("VALIDATION", "That code isn't valid");
  }
  await db.update(carts).set({ discountCode: code ? code.trim().toUpperCase() : null }).where(eq(carts.id, cartId));
}

export type CartLineView = {
  variantId: string; productId: string; brandId: string; brandName: string; name: string; sku: string; imageKey: string | null; size: string | null; colorName: string | null;
  unitPrice: number; quantity: number; lineTotal: number; available: number; purchasable: boolean; issue: string | null; isPreOrder: boolean; fulfillmentTime: string | null; customMeasurements: Record<string, number> | null;
};
export type CartView = { cartId: string; currency: string; lines: CartLineView[]; pricing: PricingResult; discountError: string | null; canCheckout: boolean };

/** Rebuilds the cart from authoritative data on every call: price, availability, visibility, discount validity. */
export async function getCartView(db: Db, cartId: string, opts: { shippingTotal?: number; taxBps?: number; taxInclusive?: boolean } = {}): Promise<CartView> {
  const [cart] = await db.select().from(carts).where(eq(carts.id, cartId));
  if (!cart) throw new AppError("NOT_FOUND", "Cart not found");
  const items = await db.select().from(cartItems).where(eq(cartItems.cartId, cartId));
  const ids = items.map((i) => i.variantId);
  const rows = ids.length ? await db.select({ v: productVariants, p: products, b: brands, l: inventoryLevels }).from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id)).where(inArray(productVariants.id, ids)) : [];
  const now = new Date();
  const lines: CartLineView[] = items.flatMap((i) => {
    const r = rows.find((x) => x.v.id === i.variantId);
    if (!r) return [];
    const visible = r.p.status === "published" || (r.p.status === "scheduled" && !!r.p.publishAt && r.p.publishAt <= now);
    const available = r.l ? r.l.onHand - r.l.reserved : 0;
    const unitPrice = effectiveUnitPrice(r.p.basePrice, r.v.priceOverride);
    const isPreOrder = r.p.preOrderEnabled && available <= 0 && !r.l?.allowBackorder;
    const issue = !visible || !r.v.isActive ? "No longer available" : r.p.customSizingEnabled && !i.customMeasurements ? "Custom measurements are required; remove and re-add this item" : !r.l?.allowBackorder && !isPreOrder && available < i.quantity ? (available > 0 ? `Only ${available} left` : "Sold out") : null;
    return [{ variantId: i.variantId, productId: r.p.id, brandId: r.p.brandId, brandName: r.b.name, name: r.p.name, sku: r.v.sku, imageKey: null, size: r.v.size, colorName: r.v.colorName, unitPrice, quantity: i.quantity, lineTotal: unitPrice * i.quantity, available, purchasable: issue === null, issue, isPreOrder, fulfillmentTime: r.p.fulfillmentTime, customMeasurements: i.customMeasurements }];
  });
  const mediaRows = lines.length ? await db.select({ productId: productMedia.productId, key: mediaAssets.storageKey })
    .from(productMedia).innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, [...new Set(lines.map((l) => l.productId))]))
    .orderBy(asc(productMedia.sortOrder)) : [];
  const imageByProduct = new Map<string, string>();
  for (const m of mediaRows) if (!imageByProduct.has(m.productId)) imageByProduct.set(m.productId, m.key);
  const displayLines = lines.map((line) => ({ ...line, imageKey: imageByProduct.get(line.productId) ?? null }));
  let rule: DiscountRule | null = null; let discountError: string | null = null;
  if (cart.discountCode) {
    const [d] = await db.select().from(discounts).where(eq(discounts.code, cart.discountCode));
    if (d) rule = { code: d.code, kind: d.kind, value: d.value, brandId: d.brandId, minSubtotal: d.minSubtotal, maxRedemptions: d.maxRedemptions, redemptionCount: d.redemptionCount, startsAt: d.startsAt, endsAt: d.endsAt, isActive: d.isActive };
  }
  const priced = displayLines.filter((l) => l.purchasable);
  const input = { lines: priced.map((l) => ({ variantId: l.variantId, brandId: l.brandId, unitPrice: l.unitPrice, quantity: l.quantity })), shippingTotal: opts.shippingTotal ?? 0, taxBps: opts.taxBps ?? 0, taxInclusive: opts.taxInclusive ?? true, now };
  let pricing: PricingResult;
  try { pricing = computePricing({ ...input, discount: rule }); }
  catch (e) { discountError = e instanceof AppError ? e.message : "Code could not be applied"; pricing = computePricing(input); }
  return { cartId, currency: cart.currency, lines: displayLines, pricing, discountError, canCheckout: displayLines.length > 0 && displayLines.every((l) => l.purchasable) };
}
