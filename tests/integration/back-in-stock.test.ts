import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct } from "@/domains/catalog/admin";
import { adjustStock } from "@/domains/inventory";
import { queueBackInStockNotifications } from "@/domains/inventory/back-in-stock";
import { backInStockSubscriptions, emailOutbox, productVariants } from "@/infrastructure/db/schema";

let ctx: Awaited<ReturnType<typeof makeTestDb>>;
let actors: Awaited<ReturnType<typeof seedBrandsAndActors>>;
let productId = "";
let variantId = "";

beforeAll(async () => {
  ctx = await makeTestDb();
  actors = await seedBrandsAndActors(ctx.db);
  const product = await createProduct(ctx.db, actors.superAdmin, {
    brandId: actors.uthy.id,
    name: "Restock Test Shirt",
    basePrice: 500_000,
    status: "published",
    variants: [{ sku: "RESTOCK-TEST-M", size: "M", initialStock: 0 }],
  });
  productId = product.id;
  const [variant] = await ctx.db.select().from(productVariants).where(eq(productVariants.productId, productId));
  variantId = variant!.id;
  await ctx.db.insert(backInStockSubscriptions).values({
    id: crypto.randomUUID(),
    productId,
    variantId,
    email: "restock@example.test",
    status: "active",
  });
});

afterAll(() => ctx.cleanup());

describe("back-in-stock notification workflow", () => {
  it("does not notify while unavailable, queues one email after restock, and is idempotent", async () => {
    expect(await queueBackInStockNotifications(ctx.db, variantId)).toBe(0);

    await adjustStock(ctx.db, actors.superAdmin, {
      variantId,
      delta: 4,
      type: "receive",
      reason: "Restock test inventory",
    });

    expect(await queueBackInStockNotifications(ctx.db, variantId)).toBe(1);
    const [subscription] = await ctx.db.select().from(backInStockSubscriptions).where(eq(backInStockSubscriptions.variantId, variantId));
    expect(subscription).toMatchObject({ status: "notified", email: "restock@example.test" });
    expect(subscription!.notifiedAt).toBeInstanceOf(Date);

    const messages = await ctx.db.select().from(emailOutbox);
    const restockMessages = messages.filter((message) => message.template === "back_in_stock" && message.toEmail === "restock@example.test");
    expect(restockMessages).toHaveLength(1);
    expect(restockMessages[0]!.payloadJson).toMatchObject({ productName: "Restock Test Shirt", productSlug: "restock-test-shirt", brandSlug: "uthy-luxury" });

    expect(await queueBackInStockNotifications(ctx.db, variantId)).toBe(0);
    expect((await ctx.db.select().from(emailOutbox)).filter((message) => message.template === "back_in_stock")).toHaveLength(1);
  });
});
