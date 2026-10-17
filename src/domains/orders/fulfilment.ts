import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { emailOutbox, orderBrandFulfilments, orderStatusHistory, orders, shippingRecords } from "@/infrastructure/db/schema";
import type { ShippingProvider, ShippingOption, ShipAddress } from "@/infrastructure/shipping/types";
import { AppError } from "@/lib/errors";
import { assertCan, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { loadOrderBundle } from "./queries";

/** Server-side delivery quote. Used both to display options and (again) to price the order — the client never supplies the amount. */
export async function quoteShipping(provider: ShippingProvider, dest: ShipAddress, items: Array<{ name: string; quantity: number; unitPriceMinor: number }>): Promise<ShippingOption[]> {
  if (dest.country !== "NG") throw new AppError("VALIDATION", "We currently deliver within Nigeria only");
  const options = await provider.getRates(dest, items);
  if (options.length === 0) throw new AppError("VALIDATION", "No delivery options are available for that address");
  return options;
}

/** Only an admin with orders.manage for EVERY brand in the order may create the shipment (single parcel per order). */
export async function createShipmentForOrder(db: Db, provider: ShippingProvider, actor: Actor, orderId: string) {
  const b = await loadOrderBundle(db, orderId);
  if (!b) throw new AppError("NOT_FOUND", "Order not found");
  for (const brandId of new Set(b.items.map((i) => i.brandId))) assertCan(actor, "orders.manage", brandId);
  if (b.order.paymentStatus !== "paid") throw new AppError("CONFLICT", "Only paid orders can be shipped");
  if (b.shipments.some((s) => s.status !== "failed")) throw new AppError("CONFLICT", "A shipment already exists for this order");
  const addr = b.order.shippingAddressJson as unknown as ShipAddress;
  const stored = b.order.shippingOptionJson as unknown as ShippingOption & { meta?: { method?: string } };
  if (stored.meta?.method === "pickup" || b.fulfillments.some((f) => f.method === "pickup")) throw new AppError("CONFLICT", "This order is for customer pickup and cannot create a delivery shipment");
  const dest: ShipAddress = { ...addr, email: b.order.email, phone: b.order.phone ?? addr.phone };
  const parcel = b.items.map((i) => ({ name: i.productName, quantity: i.quantity, unitPriceMinor: i.unitPrice }));
  // Provider quotes expire: re-quote and re-select the same service the customer paid for.
  const fresh = (await provider.getRates(dest, parcel)).find((o) => o.id === stored.id) ?? stored;
  const made = await provider.createShipment({ orderNumber: b.order.orderNumber, dest, items: parcel, option: fresh });
  await db.insert(shippingRecords).values({ orderId, provider: provider.name, providerShipmentId: made.providerShipmentId, trackingNumber: made.trackingNumber, trackingUrl: made.trackingUrl, carrier: made.carrier, status: "label_created" });
  await db.update(orderBrandFulfilments).set({ status: "processing", carrier: made.carrier, trackingNumber: made.trackingNumber, trackingUrl: made.trackingUrl, updatedAt: new Date() }).where(and(eq(orderBrandFulfilments.orderId, orderId), eq(orderBrandFulfilments.method, "delivery")));
  await setOrderStatus(db, orderId, "processing", "Shipment created", actor.userId);
  await writeAudit(db, { actorUserId: actor.userId, action: "order.shipment.create", entityType: "order", entityId: orderId, after: made });
}

const ORDER_FLOW: Record<string, string[]> = { paid: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["delivered"], delivered: ["refunded"] };
export async function setOrderStatus(db: Db, orderId: string, to: string, note: string, actorUserId: string | null) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw new AppError("NOT_FOUND", "Order not found");
  if (o.status === to) return;
  if (!(ORDER_FLOW[o.status] ?? []).includes(to) && !(o.status === "paid" && to === "processing")) throw new AppError("CONFLICT", `Cannot move an order from ${o.status} to ${to}`);
  const r = await db.update(orders).set({ status: to as never }).where(and(eq(orders.id, orderId), eq(orders.status, o.status)));
  if (((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 0) return; // lost a race; other writer already moved it
  await db.insert(orderStatusHistory).values({ orderId, fromStatus: o.status, toStatus: to, note, actorUserId });
}

export async function adminSetOrderStatus(db: Db, actor: Actor, orderId: string, to: string, note: string) {
  const b = await loadOrderBundle(db, orderId);
  if (!b) throw new AppError("NOT_FOUND", "Order not found");
  for (const brandId of new Set(b.items.map((i) => i.brandId))) assertCan(actor, "orders.manage", brandId);
  await setOrderStatus(db, orderId, to, note || `Set to ${to}`, actor.userId);
  await writeAudit(db, { actorUserId: actor.userId, action: "order.status", entityType: "order", entityId: orderId, before: { status: b.order.status }, after: { status: to } });
}

/** Cron: poll in-flight shipments, persist changes, notify customer once per status. */
export async function pollShipments(db: Db, provider: ShippingProvider): Promise<number> {
  const open = await db.select().from(shippingRecords).where(inArray(shippingRecords.status, ["label_created", "in_transit", "out_for_delivery"]));
  let changed = 0;
  for (const s of open) {
    if (!s.providerShipmentId) continue;
    try {
      const t = await provider.track(s.providerShipmentId);
      if (t.status === s.status) continue;
      await db.update(shippingRecords).set({ status: t.status, trackingUrl: t.trackingUrl ?? s.trackingUrl }).where(eq(shippingRecords.id, s.id));
      await db.insert(emailOutbox).values({ dedupeKey: `ship:${s.id}:${t.status}`, template: "shipping_update", toEmail: (await db.select().from(orders).where(eq(orders.id, s.orderId)))[0]?.email ?? "", payloadJson: { orderId: s.orderId, shipmentStatus: t.status.replace(/_/g, " "), trackingUrl: t.trackingUrl ?? s.trackingUrl } }).onConflictDoNothing();
      if (t.status === "in_transit") { await db.update(orderBrandFulfilments).set({ status: "shipped", updatedAt: new Date() }).where(and(eq(orderBrandFulfilments.orderId, s.orderId), eq(orderBrandFulfilments.method, "delivery"))); await setOrderStatus(db, s.orderId, "shipped", "In transit", null).catch(() => undefined); }
      if (t.status === "delivered") { await db.update(orderBrandFulfilments).set({ status: "delivered", fulfilledAt: new Date(), updatedAt: new Date() }).where(and(eq(orderBrandFulfilments.orderId, s.orderId), eq(orderBrandFulfilments.method, "delivery"))); await setOrderStatus(db, s.orderId, "shipped", "In transit", null).catch(() => undefined); await setOrderStatus(db, s.orderId, "delivered", "Delivered", null).catch(() => undefined); }
      changed++;
    } catch { /* provider hiccup: retry on next tick */ }
  }
  return changed;
}
