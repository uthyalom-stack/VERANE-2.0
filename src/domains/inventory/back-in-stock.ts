import { and, eq } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { backInStockSubscriptions, brands, emailOutbox, inventoryLevels, productVariants, products } from "@/infrastructure/db/schema";

/** Queue one restock email per active subscription once real, unreserved stock is available. */
export async function queueBackInStockNotifications(db: Db, variantId: string, now = new Date()): Promise<number> {
  const [stock] = await db.select({
    onHand: inventoryLevels.onHand,
    reserved: inventoryLevels.reserved,
    productName: products.name,
    productSlug: products.slug,
    brandSlug: brands.slug,
  }).from(inventoryLevels)
    .innerJoin(productVariants, eq(productVariants.id, inventoryLevels.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(eq(inventoryLevels.variantId, variantId));

  if (!stock || stock.onHand - stock.reserved <= 0) return 0;
  const subscriptions = await db.select().from(backInStockSubscriptions).where(and(
    eq(backInStockSubscriptions.variantId, variantId),
    eq(backInStockSubscriptions.status, "active"),
  ));

  let queued = 0;
  for (const subscription of subscriptions) {
    const dedupeKey = `back-in-stock:${subscription.id}:${subscription.updatedAt.getTime()}`;
    const inserted = await db.insert(emailOutbox).values({
      id: crypto.randomUUID(),
      dedupeKey,
      template: "back_in_stock",
      toEmail: subscription.email,
      payloadJson: { productName: stock.productName, productSlug: stock.productSlug, brandSlug: stock.brandSlug },
    }).onConflictDoNothing();
    await db.update(backInStockSubscriptions).set({
      status: "notified",
      notifiedAt: now,
      updatedAt: now,
    }).where(and(
      eq(backInStockSubscriptions.id, subscription.id),
      eq(backInStockSubscriptions.status, "active"),
    ));
    if (((inserted as unknown as { rowsAffected?: number }).rowsAffected ?? 0) > 0) queued++;
  }
  return queued;
}
