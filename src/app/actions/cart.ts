"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@/infrastructure/db/client";
import { and, eq, inArray } from "drizzle-orm";
import { orderAttributions, pickupLocations, trackingCampaigns } from "@/infrastructure/db/schema";
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

const measurementsSchema = z.object({ chest: z.number().min(20).max(250), waist: z.number().min(20).max(250), hips: z.number().min(20).max(250), length: z.number().min(20).max(250), shoulder: z.number().min(10).max(150).optional(), sleeve: z.number().min(10).max(150).optional(), inseam: z.number().min(10).max(150).optional() }).strict();

export async function addToBagAction(variantId: string, quantity: number, rawMeasurements?: unknown): Promise<ActionState<{ count: number }>> {
  return run(async () => {
    const id = z.string().min(1).max(64).parse(variantId); const q = qty.parse(quantity);
    const cartId = await ensureCartId();
    const measurements = rawMeasurements == null ? undefined : measurementsSchema.parse(rawMeasurements);
    await addToCart(getDb(), cartId, id, Math.max(1, q), measurements);
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
export type QuoteOption = { id: string; brandId: string; brandName: string; name: string; carrier: string; eta: string | null; amountMinor: number; method: "delivery" | "pickup" };

type ResolvedBrandSelection = {
  brandId: string;
  method: "delivery" | "pickup";
  id: string;
  name: string;
  amountMinor: number;
  pickupLocationId?: string;
  pickupSnapshot?: Record<string, unknown>;
};

function parseBrandSelections(value: string | undefined): Record<string, string> {
  let parsed: unknown;
  try { parsed = JSON.parse(value ?? ""); } catch { throw new AppError("VALIDATION", "Choose a delivery or pickup option for every brand"); }
  const selections = z.record(z.string().min(1), z.string().min(1)).parse(parsed);
  return selections;
}

async function resolveBrandSelections(form: Record<string, string>, cartId: string, view: CartView, db: ReturnType<typeof getDb>) {
  const a = addressSchema.parse(form);
  const selections = parseBrandSelections(form.selections ?? form.shippingSelections);
  const brandIds = [...new Set(view.lines.map((line) => line.brandId))];
  if (Object.keys(selections).length !== brandIds.length || brandIds.some((brandId) => !selections[brandId])) {
    throw new AppError("VALIDATION", "Choose one delivery or pickup option for every brand in your bag");
  }

  const resolved: ResolvedBrandSelection[] = [];
  let total = 0;
  let deliveryError: unknown = null;
  for (const brandId of brandIds) {
    const lines = view.lines.filter((line) => line.brandId === brandId);
    const selectedId = selections[brandId]!;
    if (selectedId.startsWith("pickup:")) {
      const locationId = selectedId.slice("pickup:".length);
      const [location] = await db.select().from(pickupLocations).where(and(
        eq(pickupLocations.id, locationId),
        eq(pickupLocations.brandId, brandId),
        eq(pickupLocations.isActive, true),
      ));
      if (!location) throw new AppError("VALIDATION", "A selected pickup location is no longer available. Choose again.");
      resolved.push({
        brandId,
        method: "pickup",
        id: selectedId,
        name: `Pickup — ${location.name}`,
        amountMinor: 0,
        pickupLocationId: location.id,
        pickupSnapshot: {
          name: location.name, addressLine1: location.addressLine1, addressLine2: location.addressLine2,
          city: location.city, state: location.state, postalCode: location.postalCode,
          country: location.country, instructions: location.instructions,
        },
      });
      continue;
    }

    try {
      const options = await quoteShipping(getShippingProvider(), { ...a, country: "NG" }, lines.map((line) => ({
        name: line.name, quantity: line.quantity, unitPriceMinor: line.unitPrice,
      })));
      const option = options.find((candidate) => candidate.id === selectedId);
      if (!option) throw new AppError("VALIDATION", `The selected delivery service for ${lines[0]?.brandName ?? "a brand"} is no longer available. Choose again.`);
      resolved.push({ brandId, method: "delivery", id: option.id, name: `${option.carrier} — ${option.name}`, amountMinor: option.amountMinor });
      total += option.amountMinor;
    } catch (error) {
      deliveryError = error;
      throw error;
    }
  }
  if (resolved.length !== brandIds.length) throw deliveryError ?? new AppError("VALIDATION", "Could not resolve every brand's fulfilment option");
  const shipping = {
    id: "per-brand",
    name: "Brand-specific fulfilment",
    amountMinor: total,
    meta: { method: "per_brand", brandSelections: resolved },
  };
  const priced = await getCartView(db, cartId, { ...tax(), shippingTotal: total });
  return { shipping, resolved, pricing: priced.pricing };
}

export async function quoteShippingAction(form: Record<string, string>): Promise<ActionState<{ options: QuoteOption[]; brandIds: string[] }>> {
  return run(async () => {
    const a = addressSchema.parse(form);
    const cartId = await peekCartId();
    if (!cartId) throw new AppError("VALIDATION", "Your bag is empty");
    const db = getDb();
    const view = await getCartView(db, cartId, tax());
    if (!view.lines.length) throw new AppError("VALIDATION", "Your bag is empty");
    if (!view.canCheckout) throw new AppError("OUT_OF_STOCK", "Some items in your bag are unavailable");

    const groups = [...new Map(view.lines.map((line) => [line.brandId, { brandId: line.brandId, brandName: line.brandName }])).values()];
    const out: QuoteOption[] = [];
    let firstDeliveryError: unknown = null;
    const provider = getShippingProvider();

    for (const group of groups) {
      const lines = view.lines.filter((line) => line.brandId === group.brandId);
      try {
        const deliveryOptions = await quoteShipping(provider, { ...a, country: "NG" }, lines.map((line) => ({
          name: line.name, quantity: line.quantity, unitPriceMinor: line.unitPrice,
        })));
        for (const option of deliveryOptions) {
          out.push({
            id: option.id, brandId: group.brandId, brandName: group.brandName,
            name: option.name, carrier: option.carrier, eta: option.etaText,
            amountMinor: option.amountMinor, method: "delivery",
          });
        }
      } catch (error) {
        firstDeliveryError ??= error;
      }

      const locations = await db.select().from(pickupLocations).where(and(
        eq(pickupLocations.brandId, group.brandId),
        eq(pickupLocations.isActive, true),
      ));
      for (const location of locations) {
        out.push({
          id: `pickup:${location.id}`, brandId: group.brandId, brandName: group.brandName,
          name: location.name, carrier: "Pickup",
          eta: [location.addressLine1, location.addressLine2, location.city, location.state, location.instructions].filter(Boolean).join(", "),
          amountMinor: 0, method: "pickup",
        });
      }
    }

    const missing = groups.find((group) => !out.some((option) => option.brandId === group.brandId));
    if (missing) throw firstDeliveryError ?? new AppError("VALIDATION", `No delivery or pickup options are available for ${missing.brandName}`);
    return { ok: true, data: { options: out, brandIds: groups.map((group) => group.brandId) } };
  });
}

export async function priceShippingSelectionsAction(form: Record<string, string>): Promise<ActionState<{ pricing: CartView["pricing"]; shippingTotal: number }>> {
  return run(async () => {
    const cartId = await peekCartId();
    if (!cartId) throw new AppError("VALIDATION", "Your bag is empty");
    const db = getDb();
    const view = await getCartView(db, cartId, tax());
    if (!view.lines.length || !view.canCheckout) throw new AppError("OUT_OF_STOCK", "Some items in your bag are unavailable");
    const resolved = await resolveBrandSelections(form, cartId, view, db);
    return { ok: true, data: { pricing: resolved.pricing, shippingTotal: resolved.shipping.amountMinor } };
  });
}

/** CUSTOMER → ADDRESS → DELIVERY → REVIEW → PAYMENT. Re-quotes shipping and recomputes every amount on the server. */
export async function placeOrderAction(form: Record<string, string>): Promise<ActionState> {
  let url: string | null = null;
  const res = await run(async () => {
    const a = addressSchema.parse(form);
    const cartId = await peekCartId();
    if (!cartId) throw new AppError("VALIDATION", "Your bag is empty");
    const db = getDb();
    const view = await getCartView(db, cartId, tax());
    if (!view.lines.length) throw new AppError("VALIDATION", "Your bag is empty");
    if (!view.canCheckout) throw new AppError("OUT_OF_STOCK", "Some items in your bag are unavailable");
    const { shipping } = await resolveBrandSelections(form, cartId, view, db);
    const user = await getCurrentUser();
    const env = getEnv();
    const input = checkoutInput.parse({
      cartId, userId: user?.kind === "customer" ? user.id : null, email: a.email, phone: a.phone,
      address: { recipientName: a.recipientName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: "NG" },
      shipping,
      callbackUrl: `${env.APP_URL}/checkout/return`,
    });
    const r = await startCheckout(db, getPaymentProvider(), input, new Date(), { pepper: env.TOKEN_PEPPER, ...tax() });
    const cookieStore = await cookies();
    try {
      const campaignId = cookieStore.get("vr_campaign")?.value;
      const visitorHash = cookieStore.get("vr_visitor")?.value;
      if (campaignId) {
        const [campaign] = await db.select().from(trackingCampaigns).where(eq(trackingCampaigns.id, campaignId));
        if (campaign?.isActive) {
          await db.insert(orderAttributions).values({
            orderId: r.orderId, campaignId: campaign.id, brandId: campaign.brandId,
            visitorHash: visitorHash ?? null, model: "last_touch",
          }).onConflictDoNothing();
        }
      }
    } catch { /* attribution must never interrupt payment initialization */ }
    void trackServer({ name: "checkout_start", entityType: "order", entityId: r.orderId, props: { total: r.total } });
    cookieStore.set("vr_order_access", `${r.orderNumber}.${r.publicToken}`, { httpOnly: true, secure: env.APP_URL.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
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
