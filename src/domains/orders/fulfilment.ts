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

/** Create one shipment per brand so each brand can manage its own parcel and tracking state. */
export async function createShipmentForOrder(db: Db, provider: ShippingProvider, actor: Actor, orderId: string) {
  const b = await loadOrderBundle(db, orderId);
  if (!b) throw new AppError("NOT_FOUND", "Order not found");
  const brandIds = [...new Set(b.items.map((item) => item.brandId))];
  for (const brandId of brandIds) assertCan(actor, "orders.manage", brandId);
  if (b.order.paymentStatus !== "paid") throw new AppError("CONFLICT", "Only paid orders can be shipped");
  const stored = b.order.shippingOptionJson as unknown as ShippingOption & { meta?: { method?: string } };
  if (stored.meta?.method === "pickup" || b.fulfillments.some((fulfilment) => fulfilment.method === "pickup")) throw new AppError("CONFLICT", "This order is for customer pickup and cannot create a delivery shipment");
  const deliveryFulfilments = b.fulfillments.filter((fulfilment) => fulfilment.method === "delivery");
  if (!deliveryFulfilments.length) throw new AppError("CONFLICT", "No delivery fulfilments are available for this order");
  const unscoped = b.shipments.filter((shipment) => !shipment.brandId && shipment.status !== "failed");
  if (unscoped.length) {
    if (deliveryFulfilments.length !== 1) throw new AppError("CONFLICT", "A legacy order-level shipment already exists; do not create duplicate brand parcels");
    const fulfilment = deliveryFulfilments[0]!;
    const shipment = unscoped[0]!;
    await db.update(shippingRecords).set({ brandId: fulfilment.brandId, updatedAt: new Date() }).where(eq(shippingRecords.id, shipment.id));
    await db.update(orderBrandFulfilments).set({ status: shipment.status === "delivered" ? "delivered" : shipment.status === "in_transit" || shipment.status === "out_for_delivery" ? "shipped" : "processing", carrier: shipment.carrier, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl, updatedAt: new Date() }).where(eq(orderBrandFulfilments.id, fulfilment.id));
    return;
  }

  let created = 0;
  const addr = b.order.shippingAddressJson as unknown as ShipAddress;
  const dest: ShipAddress = { ...addr, email: b.order.email, phone: b.order.phone ?? addr.phone };
  for (const fulfilment of deliveryFulfilments) {
    const existing = b.shipments.find((shipment) => shipment.brandId === fulfilment.brandId && shipment.status !== "failed");
    if (existing) continue;
    const brandItems = b.items.filter((item) => item.brandId === fulfilment.brandId);
    if (!brandItems.length) continue;
    const parcel = brandItems.map((item) => ({ name: item.productName, quantity: item.quantity, unitPriceMinor: item.unitPrice }));
    const rates = await provider.getRates(dest, parcel);
    const fresh = rates.find((option) => option.id === stored.id);
    if (!fresh) throw new AppError("CONFLICT", `The paid delivery service is no longer available for brand ${fulfilment.brandId}. Review the shipment manually before creating a label.`);
    const made = await provider.createShipment({ orderNumber: `${b.order.orderNumber}-${fulfilment.brandId.slice(0, 6)}`, dest, items: parcel, option: fresh });
    await db.insert(shippingRecords).values({ orderId, brandId: fulfilment.brandId, provider: provider.name, providerShipmentId: made.providerShipmentId, trackingNumber: made.trackingNumber, trackingUrl: made.trackingUrl, carrier: made.carrier, status: "label_created" });
    await db.update(orderBrandFulfilments).set({ status: "processing", carrier: made.carrier, trackingNumber: made.trackingNumber, trackingUrl: made.trackingUrl, updatedAt: new Date() }).where(eq(orderBrandFulfilments.id, fulfilment.id));
    await writeAudit(db, { actorUserId: actor.userId, action: "order.shipment.create", entityType: "order", entityId: orderId, brandId: fulfilment.brandId, after: made });
    created++;
  }
  if (!created) throw new AppError("CONFLICT", "Every brand already has an active shipment");
  await setOrderStatus(db, orderId, "processing", "Brand shipments created", actor.userId);
}
const ORDER_FLOW: Record<string, string[]> = { paid: ["processing", "cancelled"], processing: ["shipped", "delivered", "cancelled"], shipped: ["delivered"], delivered: ["refunded"] };
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
      const targetFulfilment = s.brandId
        ? and(eq(orderBrandFulfilments.orderId, s.orderId), eq(orderBrandFulfilments.brandId, s.brandId), eq(orderBrandFulfilments.method, "delivery"))
        : and(eq(orderBrandFulfilments.orderId, s.orderId), eq(orderBrandFulfilments.method, "delivery"));
      if (t.status === "in_transit") {
        await db.update(orderBrandFulfilments).set({ status: "shipped", updatedAt: new Date() }).where(targetFulfilment);
        const all = await db.select().from(orderBrandFulfilments).where(eq(orderBrandFulfilments.orderId, s.orderId));
        if (all.length && all.every((row) => row.status === "shipped" || row.status === "delivered")) await setOrderStatus(db, s.orderId, "shipped", "All brand shipments in transit", null).catch(() => undefined);
      }
      if (t.status === "delivered") {
        await db.update(orderBrandFulfilments).set({ status: "delivered", fulfilledAt: new Date(), updatedAt: new Date() }).where(targetFulfilment);
        const all = await db.select().from(orderBrandFulfilments).where(eq(orderBrandFulfilments.orderId, s.orderId));
        if (all.length && all.every((row) => row.status === "delivered")) await setOrderStatus(db, s.orderId, "delivered", "All brand fulfilments delivered", null).catch(() => undefined);
      }
      changed++;
    } catch { /* provider hiccup: retry on next tick */ }
  }
  return changed;
}
