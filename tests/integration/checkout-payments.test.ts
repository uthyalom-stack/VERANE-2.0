import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct } from "@/domains/catalog/admin";
import { addToCart, getCartView, getOrCreateCart, setCartQuantity } from "@/domains/cart";
import { expireStaleOrders, finalizePayment, handlePaymentWebhook, startCheckout } from "@/domains/orders";
import { createMockPaymentProvider } from "@/infrastructure/payments/mock";
import { getAvailability } from "@/domains/inventory";
import { hmacHex } from "@/lib/crypto";
import { emailOutbox, inventoryLevels, orders, paymentAttempts, productVariants, webhookEvents } from "@/infrastructure/db/schema";

let ctx: Awaited<ReturnType<typeof makeTestDb>>; let a: Awaited<ReturnType<typeof seedBrandsAndActors>>; let variantId = "";
const provider = createMockPaymentProvider({ secret: "whsec" });
const shipping = { id: "std", name: "Standard", amountMinor: 250000 };
const address = { recipientName: "Ada L", line1: "1 Marina Rd", city: "Lagos", state: "Lagos" };

beforeAll(async () => {
  ctx = await makeTestDb(); a = await seedBrandsAndActors(ctx.db);
  const { id } = await createProduct(ctx.db, a.superAdmin, { brandId: a.uthy.id, name: "Checkout Coat", basePrice: 1_000_000, status: "published", variants: [{ sku: "CK-1", size: "M", initialStock: 3 }] });
  variantId = (await ctx.db.select().from(productVariants).where(eq(productVariants.productId, id)))[0]!.id;
});
afterAll(() => ctx.cleanup());

async function cartWith(qty: number, guest = crypto.randomUUID()) {
  const cart = await getOrCreateCart(ctx.db, { guestTokenHash: guest });
  await addToCart(ctx.db, cart.id, variantId, qty);
  return cart.id;
}
const checkout = (cartId: string) => startCheckout(ctx.db, provider, { cartId, email: "Ada@Example.com", phone: "08012345678", address, shipping, callbackUrl: "http://localhost:3000/checkout/return" });
const sign = (body: string) => hmacHex("SHA-512", "whsec", body);

describe("cart", () => {
  it("rejects over-stock adds and unknown variants; never stores client prices", async () => {
    const id = await cartWith(1);
    await expect(addToCart(ctx.db, id, variantId, 50)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    await expect(addToCart(ctx.db, id, "nope", 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setCartQuantity(ctx.db, id, variantId, 2)).resolves.toBeUndefined();
    const v = await getCartView(ctx.db, id);
    expect(v.pricing.subtotal).toBe(2_000_000);
  });
});

describe("checkout + payment finalisation", () => {
  let reference = ""; let orderId = ""; let total = 0;
  it("creates a pending order, reserves stock and totals server-side", async () => {
    const r = await checkout(await cartWith(1));
    reference = r.reference; orderId = r.orderId; total = r.total;
    expect(total).toBe(1_000_000 + 250000);
    expect((await getAvailability(ctx.db, [variantId])).get(variantId)!.available).toBe(2);
  });
  it("invalid webhook signature is rejected and changes nothing", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 1, reference } });
    expect((await handlePaymentWebhook(ctx.db, provider, body, "deadbeef")).status).toBe(401);
    expect((await ctx.db.select().from(orders).where(eq(orders.id, orderId)))[0]!.status).toBe("pending_payment");
  });
  it("valid webhook finalises once; duplicates are idempotent (stock, status, email)", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 99, reference } });
    const sig = await sign(body);
    const [r1, r2, r3] = await Promise.all([handlePaymentWebhook(ctx.db, provider, body, sig), handlePaymentWebhook(ctx.db, provider, body, sig), finalizePayment(ctx.db, provider, reference)]);
    expect(r1.status).toBe(200); expect(r2.status).toBe(200); expect(r3 === "paid" || r3 === "already_paid").toBe(true);
    const [o] = await ctx.db.select().from(orders).where(eq(orders.id, orderId));
    expect(o).toMatchObject({ status: "paid", paymentStatus: "paid" });
    const [lvl] = await ctx.db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, variantId));
    expect(lvl).toMatchObject({ onHand: 2, reserved: 0 }); // 3 on hand, sold exactly once despite 3 concurrent finalisations
    expect((await ctx.db.select().from(emailOutbox)).filter((e) => e.dedupeKey === `order-confirmation:${orderId}`).length).toBe(1);
    expect((await ctx.db.select().from(webhookEvents)).filter((w) => w.eventKey === "charge.success:99").length).toBe(1);
  });
  it("amount or currency mismatch never marks the order paid", async () => {
    const stock = (await getAvailability(ctx.db, [variantId])).get(variantId)!.available;
    expect(stock).toBeGreaterThanOrEqual(1);
    const r = await checkout(await cartWith(1));
    const bad = createMockPaymentProvider({ outcomes: new Map([[r.reference, { amountMinor: 1 }]]) });
    expect(await finalizePayment(ctx.db, bad, r.reference)).toBe("mismatch");
    expect((await ctx.db.select().from(orders).where(eq(orders.id, r.orderId)))[0]!.status).toBe("pending_payment");
    expect((await ctx.db.select().from(paymentAttempts).where(eq(paymentAttempts.reference, r.reference)))[0]!.status).toBe("mismatch");
  });
  it("failed payments leave the order retryable; expiry releases the reservation", async () => {
    expect((await getAvailability(ctx.db, [variantId])).get(variantId)!.available).toBe(1); // 2 on hand, 1 held by the mismatched order
    const n = await expireStaleOrders(ctx.db, new Date(Date.now() + 60 * 60_000));
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await getAvailability(ctx.db, [variantId])).get(variantId)!.available).toBe(2);
    expect(await expireStaleOrders(ctx.db, new Date(Date.now() + 60 * 60_000))).toBe(0); // idempotent
  });
  it("checkout fails cleanly when stock vanished, leaving nothing reserved", async () => {
    const id = await cartWith(1);
    await ctx.db.update(inventoryLevels).set({ onHand: 0, reserved: 0 }).where(eq(inventoryLevels.variantId, variantId)); // simulate sell-out elsewhere
    await expect(checkout(id)).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
  });
});
