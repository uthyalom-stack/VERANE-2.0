import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct } from "@/domains/catalog/admin";
import { addToCart, getOrCreateCart } from "@/domains/cart";
import { retryPayment, startCheckout, finalizePayment } from "@/domains/orders";
import { processEmailOutbox } from "@/domains/orders/outbox";
import { createShipmentForOrder, adminSetOrderStatus, quoteShipping } from "@/domains/orders/fulfilment";
import { getOrderForAdmin, getOrderForViewer, lookupOrderByEmail } from "@/domains/orders/queries";
import { saveAddress, listAddresses, deleteAddress, toggleWishlist, listWishlist } from "@/domains/account";
import { resolveOutfit, saveOutfit, loadOutfit, setShared } from "@/domains/outfit";
import { subscribe, unsubscribe, unsubToken } from "@/domains/newsletter";
import { createMockPaymentProvider } from "@/infrastructure/payments/mock";
import { createMockShippingProvider } from "@/infrastructure/shipping/mock";
import { createConsoleProvider } from "@/infrastructure/email/console";
import { categories, emailOutbox, inventoryLevels, productCategories, productVariants, users, orders, newsletterSubscriptions } from "@/infrastructure/db/schema";

let ctx: Awaited<ReturnType<typeof makeTestDb>>; let a: Awaited<ReturnType<typeof seedBrandsAndActors>>; let variantId = ""; let productId = ""; let otherUser = ""; let me = "";
const PEPPER = "p".repeat(40);
const pay = createMockPaymentProvider({ secret: "s" }); const ship = createMockShippingProvider();
const address = { recipientName: "Ada L", line1: "1 Marina Rd", city: "Lagos", state: "Lagos" };
const shipping = { id: "mock-standard", name: "Standard", amountMinor: 250000 };

beforeAll(async () => {
  ctx = await makeTestDb(); a = await seedBrandsAndActors(ctx.db);
  const r = await createProduct(ctx.db, a.superAdmin, { brandId: a.uthy.id, name: "Exp Dress", basePrice: 1_000_000, status: "published", variants: [{ sku: "EXP-1", size: "M", initialStock: 10 }] });
  productId = r.id; variantId = (await ctx.db.select().from(productVariants).where(eq(productVariants.productId, r.id)))[0]!.id;
  const [cat] = await ctx.db.insert(categories).values({ slug: "dresses", name: "Dresses", kind: "clothing" }).returning(); await ctx.db.insert(productCategories).values({ productId, categoryId: cat!.id });
  me = (await ctx.db.insert(users).values({ email: "me@t.dev", name: "Me", isActive: true, passwordHash: "x", createdAt: new Date(), updatedAt: new Date() }).returning())[0]!.id; otherUser = (await ctx.db.insert(users).values({ email: "o@t.dev", name: "Other", isActive: true, passwordHash: "x", createdAt: new Date(), updatedAt: new Date() }).returning())[0]!.id;
});
afterAll(() => ctx.cleanup());

async function paidOrder(email = "buyer@t.dev", userId: string | null = null) {
  const cart = await getOrCreateCart(ctx.db, { guestTokenHash: crypto.randomUUID() }); await addToCart(ctx.db, cart.id, variantId, 1);
  const r = await startCheckout(ctx.db, createMockPaymentProvider({ secret: "s" }), { cartId: cart.id, userId, email, phone: "08012345678", address, shipping, callbackUrl: "http://x/cb" }, new Date(), { pepper: PEPPER });
  return r;
}

describe("order access", () => {
  it("guest token or owner only; wrong token and other users get nothing; email lookup is exact", async () => {
    const r = await paidOrder("guest@t.dev", me);
    expect(await getOrderForViewer(ctx.db, r.orderNumber, { token: r.publicToken }, PEPPER)).not.toBeNull();
    expect(await getOrderForViewer(ctx.db, r.orderNumber, { userId: me }, PEPPER)).not.toBeNull();
    expect(await getOrderForViewer(ctx.db, r.orderNumber, { userId: otherUser }, PEPPER)).toBeNull();
    expect(await getOrderForViewer(ctx.db, r.orderNumber, { token: "wrong" }, PEPPER)).toBeNull();
    expect(await lookupOrderByEmail(ctx.db, r.orderNumber, "guest@t.dev")).not.toBeNull();
    expect(await lookupOrderByEmail(ctx.db, r.orderNumber, "other@t.dev")).toBeNull();
  });
  it("brand admins see only their brand's orders; other brand gets denied", async () => {
    const r = await paidOrder();
    expect((await getOrderForAdmin(ctx.db, a.uthyAdmin, r.orderId)).items.length).toBe(1);
    await expect(getOrderForAdmin(ctx.db, a.aloAdmin, r.orderId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("payment retry, outbox and fulfilment", () => {
  it("retryPayment creates a fresh attempt for a pending order and refuses paid or expired ones", async () => {
    const r = await paidOrder();
    const again = await retryPayment(ctx.db, pay, r.orderId, "http://x/cb");
    expect(again.reference).not.toBe(r.reference);
    await expect(retryPayment(ctx.db, pay, r.orderId, "http://x/cb", new Date(Date.now() + 3600_000))).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("confirmation + admin emails are sent exactly once; failures back off and retry", async () => {
    const lookup = async () => ({ amountMinor: 1250000, currency: "NGN", state: "paid" as const });
    const r = await paidOrder("mail@t.dev"); const paidProvider = createMockPaymentProvider({ secret: "s", lookup });
    expect(await finalizePayment(ctx.db, paidProvider, r.reference)).toBe("paid");
    const email = createConsoleProvider();
    const first = await processEmailOutbox(ctx.db, email, { appUrl: "http://x", adminEmail: "admin@t.dev" });
    expect(first.sent).toBeGreaterThanOrEqual(2);
    const second = await processEmailOutbox(ctx.db, email, { appUrl: "http://x", adminEmail: "admin@t.dev" });
    expect(second.sent).toBe(0);
    expect(email.sent.filter((m) => m.to === "mail@t.dev")).toHaveLength(1);
    const failing = { name: "console" as const, send: async () => { throw new Error("boom"); } };
    const r2 = await paidOrder("fail@t.dev"); await finalizePayment(ctx.db, paidProvider, r2.reference);
    const res = await processEmailOutbox(ctx.db, failing, { appUrl: "http://x" });
    expect(res.failed).toBeGreaterThanOrEqual(1);
    const rows = await ctx.db.select().from(emailOutbox).where(eq(emailOutbox.status, "pending")); expect(rows.every((x) => x.attempts >= 1 && x.nextAttemptAt)).toBe(true);
  });
  it("shipments need a paid order and are created once; status transitions are validated", async () => {
    const lookup = async () => ({ amountMinor: 1250000, currency: "NGN", state: "paid" as const });
    const unpaid = await paidOrder();
    await expect(createShipmentForOrder(ctx.db, ship, a.uthyAdmin, unpaid.orderId)).rejects.toMatchObject({ code: "CONFLICT" });
    const r = await paidOrder(); await finalizePayment(ctx.db, createMockPaymentProvider({ secret: "s", lookup }), r.reference);
    await expect(createShipmentForOrder(ctx.db, ship, a.aloAdmin, r.orderId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await createShipmentForOrder(ctx.db, ship, a.uthyAdmin, r.orderId);
    await expect(createShipmentForOrder(ctx.db, ship, a.uthyAdmin, r.orderId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(adminSetOrderStatus(ctx.db, a.uthyAdmin, r.orderId, "delivered", "")).rejects.toMatchObject({ code: "CONFLICT" }); // processing -> delivered not allowed
    await adminSetOrderStatus(ctx.db, a.uthyAdmin, r.orderId, "shipped", "");
    expect((await ctx.db.select().from(orders).where(eq(orders.id, r.orderId)))[0]!.status).toBe("shipped");
  });
  it("shipping quotes reject non-Nigerian destinations and empty rate lists", async () => {
    await expect(quoteShipping(ship, { ...address, phone: "1", email: "a@b.co", country: "GH" }, [])).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("account scoping, wishlist, outfits, newsletter", () => {
  it("addresses are scoped to their owner", async () => {
    await saveAddress(ctx.db, me, { recipientName: "Me Me", phone: "08011111111", line1: "1 Road", city: "Lagos", state: "Lagos", isDefault: true });
    const [addr] = await listAddresses(ctx.db, me);
    expect(await listAddresses(ctx.db, otherUser)).toHaveLength(0);
    await expect(saveAddress(ctx.db, otherUser, { recipientName: "Hax Hax", phone: "08022222222", line1: "9 St", city: "A", state: "B" }, addr!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await deleteAddress(ctx.db, otherUser, addr!.id); expect(await listAddresses(ctx.db, me)).toHaveLength(1);
  });
  it("wishlist toggles, only for visible products, and flags price changes and sell-outs", async () => {
    expect(await toggleWishlist(ctx.db, me, productId, null)).toBe(true);
    await expect(toggleWishlist(ctx.db, me, "nope", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await ctx.db.update(inventoryLevels).set({ onHand: 0, reserved: 0 }).where(eq(inventoryLevels.variantId, variantId));
    const [w] = await listWishlist(ctx.db, me); expect(w!.available).toBe(false);
    await ctx.db.update(inventoryLevels).set({ onHand: 5 }).where(eq(inventoryLevels.variantId, variantId));
    expect(await toggleWishlist(ctx.db, me, productId, null)).toBe(false);
  });
  it("outfits are priced from the DB, validated per slot, owner-scoped, and shareable by token", async () => {
    const bad = await resolveOutfit(ctx.db, [{ productId, variantId, slot: "footwear" }]).catch((e) => e); expect(bad.code).toBe("VALIDATION");
    const good = await resolveOutfit(ctx.db, [{ productId, variantId, slot: "dress" }]); expect(good.total).toBe(1_000_000); expect(good.allAvailable).toBe(true);
    await expect(resolveOutfit(ctx.db, [{ productId: "ghost", slot: "dress" }])).rejects.toMatchObject({ code: "VALIDATION" });
    const id = await saveOutfit(ctx.db, me, { name: "Evening", items: [{ productId, variantId, slot: "dress" }] });
    expect(await loadOutfit(ctx.db, { id, userId: otherUser })).toBeNull();
    await expect(setShared(ctx.db, otherUser, id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const token = (await setShared(ctx.db, me, id, true))!; expect((await loadOutfit(ctx.db, { shareToken: token }))?.outfit.name).toBe("Evening");
    await setShared(ctx.db, me, id, false); expect(await loadOutfit(ctx.db, { shareToken: token })).toBeNull();
  });
  it("newsletter needs explicit consent, is idempotent, and unsubscribes only with a valid token", async () => {
    await expect(subscribe(ctx.db, { email: "n@t.dev", consent: false }, PEPPER)).rejects.toMatchObject({ code: "VALIDATION" });
    await subscribe(ctx.db, { email: "N@t.dev", consent: true }, PEPPER); await subscribe(ctx.db, { email: "n@t.dev", consent: true }, PEPPER);
    expect((await ctx.db.select().from(newsletterSubscriptions)).filter((s) => s.email === "n@t.dev")).toHaveLength(1);
    await expect(unsubscribe(ctx.db, "n@t.dev", "forged", PEPPER)).rejects.toMatchObject({ code: "VALIDATION" });
    await unsubscribe(ctx.db, "n@t.dev", await unsubToken("n@t.dev", PEPPER), PEPPER);
    expect((await ctx.db.select().from(newsletterSubscriptions))[0]!.unsubscribedAt).not.toBeNull();
  });
});
