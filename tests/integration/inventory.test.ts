import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct } from "@/domains/catalog/admin";
import { adjustStock, commitSale, getAvailability, releaseReservation, reserveStock } from "@/domains/inventory";
import { inventoryLevels, inventoryTransactions, productVariants } from "@/infrastructure/db/schema";

let ctx: Awaited<ReturnType<typeof makeTestDb>>; let a: Awaited<ReturnType<typeof seedBrandsAndActors>>; let variantId = "";
beforeAll(async () => {
  ctx = await makeTestDb(); a = await seedBrandsAndActors(ctx.db);
  const { id } = await createProduct(ctx.db, a.superAdmin, { brandId: a.uthy.id, name: "Stock Test", basePrice: 1000, status: "published", variants: [{ sku: "STK-1", size: "M", initialStock: 5 }] });
  variantId = (await ctx.db.select().from(productVariants).where(eq(productVariants.productId, id)))[0]!.id;
});
afterAll(() => ctx.cleanup());
const avail = async () => (await getAvailability(ctx.db, [variantId])).get(variantId)!.available;

describe("inventory", () => {
  it("starts with ledgered initial stock", async () => {
    expect(await avail()).toBe(5);
    expect((await ctx.db.select().from(inventoryTransactions)).some((t) => t.type === "initial")).toBe(true);
  });
  it("never oversells under concurrent reservations (5 in stock, 8 buyers of 1)", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => reserveStock(ctx.db, [{ variantId, quantity: 1 }], `order-c${i}`)));
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(5);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "OUT_OF_STOCK")).toBe(true);
    expect(await avail()).toBe(0);
  });
  it("repeated reserve for the same reference is a no-op", async () => {
    await reserveStock(ctx.db, [{ variantId, quantity: 1 }], "order-c0");
    expect(await avail()).toBe(0);
  });
  it("commitSale decrements exactly once even when called twice (duplicate webhook)", async () => {
    await commitSale(ctx.db, [{ variantId, quantity: 1 }], "order-c0");
    await commitSale(ctx.db, [{ variantId, quantity: 1 }], "order-c0");
    const [lvl] = await ctx.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId));
    expect(lvl).toMatchObject({ onHand: 4, reserved: 4 });
  });
  it("release frees a reservation once and not after a sale", async () => {
    await releaseReservation(ctx.db, [{ variantId, quantity: 1 }], "order-c1");
    await releaseReservation(ctx.db, [{ variantId, quantity: 1 }], "order-c1");
    await releaseReservation(ctx.db, [{ variantId, quantity: 1 }], "order-c0"); // sold: ignored
    expect(await avail()).toBe(1);
  });
  it("admin adjustment requires reason, is audited, cannot go below reserved, and respects brand scope", async () => {
    await expect(adjustStock(ctx.db, a.superAdmin, { variantId, delta: 3, type: "receive", reason: "" })).rejects.toThrow();
    await expect(adjustStock(ctx.db, a.aloAdmin, { variantId, delta: 3, type: "receive", reason: "restock" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adjustStock(ctx.db, a.uthyAdmin, { variantId, delta: -100, type: "adjust", reason: "shrink" })).rejects.toMatchObject({ code: "CONFLICT" });
    await adjustStock(ctx.db, a.uthyAdmin, { variantId, delta: 3, type: "receive", reason: "delivery" });
    expect(await avail()).toBe(4);
  });
});
