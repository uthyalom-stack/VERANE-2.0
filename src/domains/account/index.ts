import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { addresses, customerPreferences, customerProfiles, inventoryLevels, looks, notifications, productVariants, products, savedLooks, wishlistItems } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { publiclyVisible } from "@/domains/catalog/public";

/* Every query below is scoped by userId taken from the verified session, never from the request body. */

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional(), recipientName: z.string().trim().min(2).max(120), phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(3).max(200), line2: z.string().trim().max(200).optional(), city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80), postalCode: z.string().trim().max(20).optional(), isDefault: z.coerce.boolean().optional(),
});

export const listAddresses = (db: Db, userId: string) => db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.createdAt));

export async function saveAddress(db: Db, userId: string, raw: unknown, id?: string) {
  if (id) {
    const [existing] = await db.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
    if (!existing) throw new AppError("NOT_FOUND", "Address not found");
  }
  const a = addressSchema.parse(raw);
  const row = { userId, label: a.label ?? null, recipientName: a.recipientName, phone: a.phone, line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postalCode ?? null, country: "NG", isDefault: !!a.isDefault };
  await db.transaction(async (tx) => {
    if (row.isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
    if (id) {
      const r = await tx.update(addresses).set(row).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
      if (((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) throw new AppError("NOT_FOUND", "Address not found");
    } else await tx.insert(addresses).values(row);
  });
}
export async function deleteAddress(db: Db, userId: string, id: string) { await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))); }

export async function toggleWishlist(db: Db, userId: string, productId: string, variantId: string | null): Promise<boolean> {
  const [ex] = await db.select().from(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
  if (ex) { await db.delete(wishlistItems).where(eq(wishlistItems.id, ex.id)); return false; }
  const [p] = await db.select().from(products).where(and(eq(products.id, productId), publiclyVisible()));
  if (!p) throw new AppError("NOT_FOUND", "This item is not available");
  await db.insert(wishlistItems).values({ userId, productId, variantId, priceAtSaveMinor: p.basePrice }).onConflictDoNothing();
  return true;
}
export async function isWished(db: Db, userId: string | null, productId: string): Promise<boolean> {
  if (!userId) return false;
  return (await db.select().from(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))).length > 0;
}

/** Price/availability are re-read from the catalog every time; stored values only drive the "price changed" hint. */
export async function listWishlist(db: Db, userId: string) {
  const items = await db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId)).orderBy(desc(wishlistItems.createdAt));
  if (!items.length) return [];
  const ps = await db.select().from(products).where(inArray(products.id, items.map((i) => i.productId)));
  const vs = await db.select({ v: productVariants, l: inventoryLevels }).from(productVariants).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id)).where(and(inArray(productVariants.productId, ps.map((p) => p.id)), eq(productVariants.isActive, true)));
  const now = new Date();
  return items.flatMap((i) => {
    const p = ps.find((x) => x.id === i.productId); if (!p) return [];
    const visible = p.status === "published" || (p.status === "scheduled" && !!p.publishAt && p.publishAt <= now);
    const pv = vs.filter((x) => x.v.productId === p.id);
    const inStock = pv.filter((x) => x.l && (x.l.onHand - x.l.reserved > 0 || x.l.allowBackorder));
    return [{ id: i.id, product: p, visible, available: visible && inStock.length > 0, singleVariantId: inStock.length === 1 && pv.length === 1 ? inStock[0]!.v.id : null,
      priceChange: i.priceAtSaveMinor != null && i.priceAtSaveMinor !== p.basePrice ? { was: i.priceAtSaveMinor, now: p.basePrice } : null }];
  });
}

export async function toggleSavedLook(db: Db, userId: string, lookId: string): Promise<boolean> {
  const [ex] = await db.select().from(savedLooks).where(and(eq(savedLooks.userId, userId), eq(savedLooks.lookId, lookId)));
  if (ex) { await db.delete(savedLooks).where(eq(savedLooks.id, ex.id)); return false; }
  const [l] = await db.select().from(looks).where(and(eq(looks.id, lookId), eq(looks.status, "published")));
  if (!l) throw new AppError("NOT_FOUND", "Look not found");
  await db.insert(savedLooks).values({ userId, lookId }).onConflictDoNothing();
  return true;
}
export async function listSavedLooks(db: Db, userId: string) {
  return db.select({ look: looks }).from(savedLooks).innerJoin(looks, eq(looks.id, savedLooks.lookId)).where(and(eq(savedLooks.userId, userId), eq(looks.status, "published"))).orderBy(desc(savedLooks.createdAt));
}

export const profileSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: z.string().trim().max(20).optional() });
export async function updateProfile(db: Db, userId: string, raw: unknown) {
  const p = profileSchema.parse(raw);
  await db.update(customerProfiles).set({ firstName: p.firstName, lastName: p.lastName, phone: p.phone || null }).where(eq(customerProfiles.userId, userId));
}
export async function getPreferences(db: Db, userId: string) {
  const [p] = await db.select().from(customerPreferences).where(eq(customerPreferences.userId, userId));
  return p ?? { userId, marketingEmailOptIn: false, orderUpdatesEmail: true, favoriteStyles: null, sizeNotes: null, updatedAt: new Date(0) };
}
export async function updatePreferences(db: Db, userId: string, raw: { marketingEmailOptIn?: boolean; favoriteStyles?: string; sizeNotes?: string }) {
  const styles = (raw.favoriteStyles ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const v = { userId, marketingEmailOptIn: !!raw.marketingEmailOptIn, favoriteStyles: styles, sizeNotes: (raw.sizeNotes ?? "").slice(0, 300) || null, updatedAt: new Date() };
  await db.insert(customerPreferences).values(v).onConflictDoUpdate({ target: customerPreferences.userId, set: v });
}
export const listNotifications = (db: Db, userId: string) => db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
export async function markNotificationsRead(db: Db, userId: string) { await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId)); }

export async function isLookSaved(db: Db, userId: string, lookId: string) {
  return (await db.select().from(savedLooks).where(and(eq(savedLooks.userId, userId), eq(savedLooks.lookId, lookId)))).length > 0;
}
