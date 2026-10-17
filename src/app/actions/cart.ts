"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@/infrastructure/db/client";
import { eq } from "drizzle-orm";
import { orderAttributions, trackingCampaigns } from "@/infrastructure/db/schema";
import { getEnv } from "@/lib/env";
import { addToCart, applyDiscountCode, getCartView, setCartQuantity, type CartView } from "@/domains/cart";
import { startCheckout, checkoutInput } from "@/domains/orders";
import { quoteShipping } from "@/domains/orders/fulfilment";
import { getPaymentProvider } from "@/infrastructure/payments";
import { getShippingProvider } from "@/infrastructure/shipping";
import { ensureCartId, peekCartId } from "@/lib/http/cart-cookie";
import { getCurrentUser } from "@/lib/http/session";
import { run, fd, type ActionState } from "@/lib/http/action";
import { AppError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/origin";
import { trackServer } from "@/lib/http/track";

const tax = () => { const e = getEnv(); return { taxBps: e.TAX_BPS, taxInclusive: e.TAX_INCLUSIVE === "true" }; };
const qty = z.coerce.number().int().min(0).max(99);

export async function addToBagAction(variantId: string, quantity: number): Promise<ActionState<{ count: number }>> {
  return run(async () => {
    const id = z.string().min(1).max(64).parse(variantId); const q = qty.parse(quantity);
    const cartId = await ensureCartId();
    await addToCart(getDb(), cartId, id, Math.max(1, q));
    const v = await getCartView(getDb(), cartId);
    void trackServer({ name: "add_to_cart", entityType: "variant", entityId: id, props: { qty: Math.max(1, q) } });
    return { ok: true, message: "Added to your bag", data: { count: v.lines.reduce((n, l) => n + l.quantity, 0) } };
  });
}
export async function updateBagAction(variantId: string, quantity: number): Promise<ActionState> {
  return run(async () => { await setCartQuantity(getDb(), await ensureCartId(), z.string().max(64).parse(variantId), qty.parse(quantity)); });
}
export async function applyDiscountAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const code = fd(form).code?.trim() ?? "";
    await applyDiscountCode(getDb(), await ensureCartId(), code || null);
    return { ok: true, message: code ? "Code applied" : "Code removed" };
  });
}
/** Read for the drawer. Not a mutation, but reached via POST: same-origin enforced anyway. */
export async function getBagAction(): Promise<CartView | null> {
  await assertSameOrigin();
  const id = await peekCartId();
  return id ? getCartView(getDb(), id, tax()) : null;
}

const addressSchema = z.object({
  email: z.string().email(), phone: z.string().trim().min(7).max(20), recipientName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(200), line2: z.string().max(200).optional(), city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80), postalCode: z.string().max(20).optional(),
});
export type QuoteOption = { id: string; name: string; carrier: string; eta: string | null; amountMinor: number; total: number };

async function quote(form: Record<string, string>) {
  const a = addressSchema.parse(form);
  const cartId = await peekCartId();
  if (!cartId) throw new AppError("VALIDATION", "Your bag is empty");
  const view = await getCartView(getDb(), cartId, tax());
  if (!view.lines.length) throw new AppError("VALIDATION", "Your bag is empty");
  if (!view.canCheckout) throw new AppError("OUT_OF_STOCK", "Some items in your bag are unavailable");
  const options = await quoteShipping(getShippingProvider(), { ...a, country: "NG" }, view.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPriceMinor: l.unitPrice })));
  return { a, cartId, options };
}

export async function quoteShippingAction(form: Record<string, string>): Promise<ActionState<{ options: QuoteOption[] }>> {
  return run(async () => {
    const { cartId, options } = await quote(form);
    const out: QuoteOption[] = [];
    for (const o of options) {
      const v = await getCartView(getDb(), cartId, { ...tax(), shippingTotal: o.amountMinor });
      out.push({ id: o.id, name: o.name, carrier: o.carrier, eta: o.etaText, amountMinor: o.amountMinor, total: v.pricing.total });
    }
    return { ok: true, data: { options: out } };
  });
}

/** CUSTOMER → ADDRESS → DELIVERY → REVIEW → PAYMENT. Re-quotes shipping and recomputes every amount on the server. */
export async function placeOrderAction(form: Record<string, string>): Promise<ActionState> {
  let url: string | null = null;
  const res = await run(async () => {
    const optionId = z.string().min(1).parse(form.shippingOptionId);
    const { a, cartId, options } = await quote(form);
    const chosen = options.find((o) => o.id === optionId);
    if (!chosen) throw new AppError("VALIDATION", "That delivery option is no longer available. Please choose again.");
    const user = await getCurrentUser();
    const env = getEnv();
    const input = checkoutInput.parse({
      cartId, userId: user?.kind === "customer" ? user.id : null, email: a.email, phone: a.phone,
      address: { recipientName: a.recipientName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: "NG" },
      shipping: { id: chosen.id, name: `${chosen.carrier} — ${chosen.name}`, amountMinor: chosen.amountMinor, meta: chosen.meta },
      callbackUrl: `${env.APP_URL}/checkout/return`,
    });
    const r = await startCheckout(getDb(), getPaymentProvider(), input, new Date(), { pepper: env.TOKEN_PEPPER, ...tax() });
    const cookieStore = await cookies();
    try {
      const campaignId = cookieStore.get("vr_campaign")?.value;
      const visitorHash = cookieStore.get("vr_visitor")?.value;
      if (campaignId) {
        const [campaign] = await getDb().select().from(trackingCampaigns).where(eq(trackingCampaigns.id, campaignId));
        if (campaign?.isActive) {
          await getDb().insert(orderAttributions).values({
            orderId: r.orderId, campaignId: campaign.id, brandId: campaign.brandId,
            visitorHash: visitorHash ?? null, model: "last_touch",
          }).onConflictDoNothing();
        }
      }
    } catch { /* attribution must never interrupt payment initialization */ }
    void trackServer({ name: "checkout_start", entityType: "order", entityId: r.orderId, props: { total: r.total } });
    (await cookies()).set("vr_order_access", `${r.orderNumber}.${r.publicToken}`, { httpOnly: true, secure: env.APP_URL.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
    url = r.authorizationUrl;
  });
  if (url) redirect(url);
  return res;
}

import { retryPayment } from "@/domains/orders";
import { getOrderForViewer } from "@/domains/orders/queries";
import { viewerFromCookies } from "@/lib/http/order-access";

/** Customer retries a failed/abandoned payment while the stock reservation is still held. */
export async function retryPaymentAction(orderNumber: string): Promise<ActionState> {
  let url: string | null = null;
  const res = await run(async () => {
    const env = getEnv(); const db = getDb();
    const b = await getOrderForViewer(db, orderNumber, await viewerFromCookies(orderNumber), env.TOKEN_PEPPER);
    if (!b) throw new AppError("NOT_FOUND", "Order not found");
    const r = await retryPayment(db, getPaymentProvider(), b.order.id, `${env.APP_URL}/checkout/return`);
    url = r.authorizationUrl;
  });
  if (url) redirect(url);
  return res;
}

/** <form action> must return void: wrapper that sends the customer back with a message when a retry is impossible. */
export async function retryPaymentFormAction(orderNumber: string): Promise<void> {
  const r = await retryPaymentAction(orderNumber);
  if (!r.ok) redirect(`/orders/${encodeURIComponent(orderNumber)}?payment=retry_failed`);
}
