import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { carts, discounts, emailOutbox, orderItems, orderStatusHistory, orders, paymentAttempts, webhookEvents } from "@/infrastructure/db/schema";
import type { PaymentProvider } from "@/infrastructure/payments/types";
import { AppError } from "@/lib/errors";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { getCartView } from "@/domains/cart";
import { commitSale, releaseReservation, reserveStock } from "@/domains/inventory";

const RESERVATION_MS = 30 * 60_000;
const affected = (r: unknown) => (r as { rowsAffected?: number }).rowsAffected ?? 0;

export const checkoutInput = z.object({
  cartId: z.string().min(1),
  userId: z.string().nullable().default(null),
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  phone: z.string().trim().min(7).max(20),
  address: z.object({ recipientName: z.string().trim().min(2).max(120), line1: z.string().trim().min(3).max(200), line2: z.string().max(200).optional(), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), postalCode: z.string().max(20).optional(), country: z.literal("NG").default("NG") }),
  /** Shipping option chosen from a provider quote the SERVER re-fetched; amount here is re-checked by the caller against that quote. */
  shipping: z.object({ id: z.string(), name: z.string(), amountMinor: z.number().int().min(0) }),
  callbackUrl: z.string().url(),
});

export const orderNumber = () => `VR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomToken(3).toUpperCase()}`;

/**
 * CART → pending order + stock reservation + payment initialisation.
 * All money is recomputed here from the database; nothing monetary from the browser is trusted.
 */
export async function startCheckout(db: Db, provider: PaymentProvider, raw: unknown, now = new Date(), cfg: { pepper?: string; taxBps?: number; taxInclusive?: boolean } = {}) {
  const pepper = cfg.pepper ?? "";
  const input = checkoutInput.parse(raw);
  const view = await getCartView(db, input.cartId, { shippingTotal: input.shipping.amountMinor, taxBps: cfg.taxBps ?? 0, taxInclusive: cfg.taxInclusive ?? true });
  if (!view.lines.length) throw new AppError("VALIDATION", "Your bag is empty");
  if (!view.canCheckout) throw new AppError("OUT_OF_STOCK", "Some items in your bag are unavailable. Review your bag to continue.");
  if (view.discountError) throw new AppError("VALIDATION", view.discountError);
  const orderId = crypto.randomUUID();
  const publicToken = randomToken(24);
  const number = orderNumber();
  const lines = view.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  await reserveStock(db, lines, orderId); // atomic; throws OUT_OF_STOCK, nothing left reserved on failure
  const reference = `vr_${orderId.replace(/-/g, "").slice(0, 16)}_${randomToken(4)}`;
  const p = view.pricing;
  try {
    const [cart] = await db.select().from(carts).where(eq(carts.id, input.cartId));
    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId, orderNumber: number, userId: input.userId, email: input.email, phone: input.phone, currency: view.currency,
        status: "pending_payment", paymentStatus: "pending", subtotal: p.subtotal, discountTotal: p.discountTotal, shippingTotal: p.shippingTotal, taxTotal: p.taxTotal, total: p.total,
        discountCode: cart?.discountCode ?? null, shippingAddressJson: input.address, shippingOptionJson: input.shipping, reservationExpiresAt: new Date(now.getTime() + RESERVATION_MS), cartId: input.cartId, publicTokenHash: await sha256Hex(publicToken, pepper),
      });
      for (const l of view.lines) await tx.insert(orderItems).values({ orderId, productId: l.productId, variantId: l.variantId, brandId: l.brandId, productName: l.name, sku: l.sku, size: l.size, colorName: l.colorName, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal });
      await tx.insert(paymentAttempts).values({ orderId, provider: provider.name, reference, amount: p.total, currency: view.currency });
      await tx.insert(orderStatusHistory).values({ orderId, fromStatus: null, toStatus: "pending_payment", note: "Order created" });
    });
    const init = await provider.initialize({ reference, amountMinor: p.total, currency: view.currency, email: input.email, callbackUrl: input.callbackUrl });
    return { orderId, reference, authorizationUrl: init.authorizationUrl, total: p.total, orderNumber: number, publicToken };
  } catch (e) {
    await releaseReservation(db, lines, orderId);
    await db.update(orders).set({ status: "payment_failed", paymentStatus: "failed" }).where(eq(orders.id, orderId)).catch(() => undefined);
    throw e instanceof AppError ? e : new AppError("PROVIDER", "We couldn't start the payment. Please try again.");
  }
}

export type FinalizeOutcome = "paid" | "already_paid" | "failed" | "pending" | "mismatch" | "unknown_reference";

/**
 * Idempotent payment finalisation, safe to call any number of times, concurrently, from the redirect handler,
 * a webhook, or a retry. Every step is individually idempotent (conditional UPDATE / unique key), so a crash
 * between steps is repaired by the next call. Always verifies with the provider server-to-server.
 */
export type FinalizeHooks = { onPaid?: (o: { orderId: string; total: number; brandIds: string[] }) => Promise<void> };
export async function finalizePayment(db: Db, provider: PaymentProvider, reference: string, hooks: FinalizeHooks = {}): Promise<FinalizeOutcome> {
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.reference, reference));
  if (!attempt) return "unknown_reference";
  const [order] = await db.select().from(orders).where(eq(orders.id, attempt.orderId));
  if (!order) return "unknown_reference";
  if (order.status !== "pending_payment" && order.paymentStatus === "paid") return "already_paid";

  const v = await provider.verify(reference);
  if (v.status === "pending") return "pending";
  if (v.status !== "success") {
    await markFailed(db, order.id, attempt.id, v.status === "abandoned" ? "abandoned" : "failed", v);
    return "failed";
  }
  // Amount/currency must equal what WE computed at checkout (never what the browser or redirect claims).
  if (v.amountMinor !== order.total || v.currency !== order.currency || v.reference !== reference) {
    await db.update(paymentAttempts).set({ status: "mismatch", rawResponseJson: v.raw }).where(eq(paymentAttempts.id, attempt.id));
    return "mismatch"; // order stays pending; needs manual review; stock stays reserved until expiry/admin action
  }
  await db.update(paymentAttempts).set({ status: "success", verifiedAt: new Date(), providerTransactionId: v.providerTransactionId, rawResponseJson: v.raw }).where(and(eq(paymentAttempts.id, attempt.id), sql`${paymentAttempts.status} IN ('initialized','success')`));

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  await commitSale(db, items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), order.id); // exactly-once via idempotency keys

  // single-statement claim: only the first caller flips pending_payment -> paid, and only they do the side effects
  const flipped = await db.update(orders).set({ status: "paid", paymentStatus: "paid" }).where(and(eq(orders.id, order.id), eq(orders.status, "pending_payment")));
  if (affected(flipped) > 0) {
    await db.insert(orderStatusHistory).values({ orderId: order.id, fromStatus: "pending_payment", toStatus: "paid", note: `Payment verified (${provider.name})` });
    if (order.discountCode) await db.update(discounts).set({ redemptionCount: sql`${discounts.redemptionCount} + 1` }).where(eq(discounts.code, order.discountCode));
    if (order.cartId) await db.update(carts).set({ status: "converted" }).where(eq(carts.id, order.cartId));
    await db.insert(emailOutbox).values({ dedupeKey: `order-confirmation:${order.id}`, template: "order_confirmation", toEmail: order.email, payloadJson: { orderId: order.id, orderNumber: order.orderNumber } }).onConflictDoNothing();
    await db.insert(emailOutbox).values({ dedupeKey: `admin-new-order:${order.id}`, template: "admin_new_order", toEmail: "@admin", payloadJson: { orderId: order.id } }).onConflictDoNothing();
    // runs exactly once (only the caller that won the pending->paid flip); a failing hook can never undo or block finalisation
    await hooks.onPaid?.({ orderId: order.id, total: order.total, brandIds: [...new Set(items.map((i) => i.brandId))] }).catch(() => undefined);
    return "paid";
  }
  return "already_paid";
}

async function markFailed(db: Db, orderId: string, attemptId: string, status: "failed" | "abandoned", v: { raw: Record<string, unknown> }) {
  await db.update(paymentAttempts).set({ status, rawResponseJson: v.raw }).where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.status, "initialized")));
  // The order stays pending_payment so the customer can retry until the reservation expires.
}

/** Webhook entry point: verify signature on the RAW body, record the event once, then finalise idempotently. */
export async function handlePaymentWebhook(db: Db, provider: PaymentProvider, rawBody: string, signature: string | null, hooks: FinalizeHooks = {}): Promise<{ status: 200 | 401 | 400; note: string }> {
  const valid = await provider.verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    await db.insert(webhookEvents).values({ provider: provider.name, eventKey: `invalid:${crypto.randomUUID()}`, eventType: "invalid_signature", signatureValid: false }).catch(() => undefined);
    return { status: 401, note: "invalid signature" };
  }
  const evt = provider.parseWebhook(rawBody);
  if (!evt) return { status: 400, note: "unparseable" };
  const ins = await db.insert(webhookEvents).values({ provider: provider.name, eventKey: evt.eventKey, eventType: evt.type, signatureValid: true, payloadJson: evt.raw }).onConflictDoNothing();
  const firstDelivery = affected(ins) > 0;
  if (evt.type === "charge.success" && evt.reference) {
    // Even for a duplicate delivery we re-run finalisation: it is idempotent and repairs half-finished earlier attempts.
    try { await finalizePayment(db, provider, evt.reference, hooks); if (firstDelivery) await db.update(webhookEvents).set({ processedAt: new Date() }).where(and(eq(webhookEvents.provider, provider.name), eq(webhookEvents.eventKey, evt.eventKey))); }
    catch (e) { await db.update(webhookEvents).set({ processingError: String(e).slice(0, 500) }).where(and(eq(webhookEvents.provider, provider.name), eq(webhookEvents.eventKey, evt.eventKey))); return { status: 400, note: "processing error, will be retried" }; }
  }
  return { status: 200, note: firstDelivery ? "processed" : "duplicate" };
}

/** Cron: release stock held by unpaid orders whose reservation window passed. Safe to run repeatedly. */
export async function expireStaleOrders(db: Db, now = new Date()): Promise<number> {
  const stale = await db.select().from(orders).where(and(eq(orders.status, "pending_payment"), lt(orders.reservationExpiresAt, now)));
  let n = 0;
  for (const o of stale) {
    const claimed = await db.update(orders).set({ status: "expired", paymentStatus: "cancelled" }).where(and(eq(orders.id, o.id), eq(orders.status, "pending_payment")));
    if (affected(claimed) === 0) continue;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    await releaseReservation(db, items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), o.id);
    await db.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: "pending_payment", toStatus: "expired", note: "Reservation expired" });
    n++;
  }
  return n;
}

/** Fresh payment attempt for a still-reserved, unpaid order (customer retried after failure/abandonment). */
export async function retryPayment(db: Db, provider: PaymentProvider, orderId: string, callbackUrl: string, now = new Date()) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw new AppError("NOT_FOUND", "Order not found");
  if (o.status !== "pending_payment") throw new AppError("CONFLICT", o.paymentStatus === "paid" ? "This order is already paid" : "This order can no longer be paid. Please start a new checkout.");
  if (o.reservationExpiresAt && o.reservationExpiresAt < now) throw new AppError("CONFLICT", "The reservation on these items has expired. Please start a new checkout.");
  const reference = `vr_${o.id.replace(/-/g, "").slice(0, 16)}_${randomToken(4)}`;
  await db.insert(paymentAttempts).values({ orderId: o.id, provider: provider.name, reference, amount: o.total, currency: o.currency });
  const init = await provider.initialize({ reference, amountMinor: o.total, currency: o.currency, email: o.email, callbackUrl });
  return { reference, authorizationUrl: init.authorizationUrl };
}
