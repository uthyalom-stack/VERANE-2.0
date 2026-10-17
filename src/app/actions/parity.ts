"use server";

import { and, eq, lte, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/infrastructure/db/client";
import { backInStockSubscriptions, inventoryLevels, products, productVariants } from "@/infrastructure/db/schema";
import { getCurrentUser } from "@/lib/http/session";
import { run, type ActionState } from "@/lib/http/action";

const subscriptionInput = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

/** Join the waitlist only for a real, published variant that is currently unavailable. */
export async function subscribeBackInStockAction(input: {
  productId: string;
  variantId: string;
  email: string;
}): Promise<ActionState> {
  return run(async () => {
    const parsed = subscriptionInput.parse(input);
    const db = getDb();
    const [row] = await db.select({
      productId: products.id,
      status: products.status,
      publishAt: products.publishAt,
      variantId: productVariants.id,
      isActive: productVariants.isActive,
      onHand: inventoryLevels.onHand,
      reserved: inventoryLevels.reserved,
      allowBackorder: inventoryLevels.allowBackorder,
    })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(
        eq(products.id, parsed.productId),
        eq(productVariants.id, parsed.variantId),
        eq(productVariants.isActive, true),
        or(eq(products.status, "published"), and(eq(products.status, "scheduled"), lte(products.publishAt, new Date()))),
      ));

    if (!row) return { ok: false, message: "That product option is no longer available." };
    const available = (row.onHand ?? 0) - (row.reserved ?? 0);
    if (available > 0 || row.allowBackorder) {
      return { ok: false, message: "This option is available to order now." };
    }

    const user = await getCurrentUser();
    const [existing] = await db.select().from(backInStockSubscriptions).where(and(
      eq(backInStockSubscriptions.productId, parsed.productId),
      eq(backInStockSubscriptions.variantId, parsed.variantId),
      eq(backInStockSubscriptions.email, parsed.email),
    ));
    if (existing) {
      await db.update(backInStockSubscriptions).set({ userId: user?.kind === "customer" ? user.id : existing.userId, status: "active", notifiedAt: null, updatedAt: new Date() }).where(eq(backInStockSubscriptions.id, existing.id));
    } else {
      await db.insert(backInStockSubscriptions).values({
        productId: parsed.productId,
        variantId: parsed.variantId,
        userId: user?.kind === "customer" ? user.id : null,
        email: parsed.email,
        status: "active",
      }).onConflictDoNothing();
    }

    return { ok: true, message: "You're on the list. We'll email you when this option is back in stock." };
  });
}
