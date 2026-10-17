import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { getOrderForAdmin } from "@/domains/orders/queries";
import { can } from "@/domains/authorization";
import { isAppError } from "@/lib/errors";
import { PageHead, Panel, Table, Badge, statusTone, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { createBrandShipmentAction, updateBrandFulfilmentAction, updateOrderStatusAction } from "@/app/actions/admin";
import { brands } from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/money";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const b = await getOrderForAdmin(db, actor, id).catch((e) => { if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null; throw e; });
  if (!b) notFound();
  const { order: o, items, shipments, history, fulfillments, partial } = b; const a = o.shippingAddressJson as Record<string, string>;
  const brandRows = fulfillments.length ? await db.select().from(brands).where(inArray(brands.id, fulfillments.map((f) => f.brandId))) : [];
  const brandNames = new Map(brandRows.map((brand) => [brand.id, brand.name]));
  const manage = items.length > 0 && items.every((i) => can(actor, "orders.manage", i.brandId)) && !partial;
  const deliveryFulfilmentCount = fulfillments.filter((f) => f.method === "delivery").length;
  const legacyMultiBrandShipment = deliveryFulfilmentCount > 1 && shipments.some((s) => !s.brandId && s.status !== "failed");
  return (<div><PageHead title={o.orderNumber} action={<Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge>} sub={`${o.email} · ${when(o.createdAt)}`} />
    {partial && <p role="status" className="mb-6 rounded-[var(--r-md)] border border-amber-500/40 p-4 text-sm">This order contains items from another brand. You can see only your brand&apos;s lines and cannot change the order&apos;s status or create its shipment.</p>}
    <Panel title="Items"><Table head={["Item", "SKU", "Qty", "Unit", "Line"]} rows={items.map((i) => [`${i.productName} ${[i.colorName, i.size].filter(Boolean).join(" / ")}${i.isPreOrder ? ` · PRE-ORDER${i.fulfillmentTimeSnapshot ? ` (${i.fulfillmentTimeSnapshot})` : ""}` : ""}${i.customMeasurements ? " · Custom sizing" : ""}`, i.sku, i.quantity, formatMoney(i.unitPrice, o.currency), formatMoney(i.lineTotal, o.currency)])} />
      {items.filter((i) => i.customMeasurements).map((i) => <p key={i.id} className="mt-2 text-xs text-muted">{i.productName} measurements (cm): {Object.entries(i.customMeasurements ?? {}).map(([k, v]) => `${k} ${v}`).join(" · ")}</p>)}
      <dl className="mt-4 grid max-w-xs gap-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(o.subtotal, o.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>{formatMoney(o.discountTotal, o.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatMoney(o.shippingTotal, o.currency)}</dd></div><div className="flex justify-between border-t border-line pt-1"><dt>Total</dt><dd>{formatMoney(o.total, o.currency)}</dd></div></dl></Panel>
    <Panel title="Delivery address"><p className="text-sm">{a.recipientName}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state}<br />{o.phone}</p></Panel>
    {fulfillments.length > 0 && <Panel title="Brand fulfilment">
      <p className="mb-4 text-sm text-muted">Each brand has its own fulfilment status. Pickup orders move through processing, ready for pickup, and delivered; delivery orders follow processing, shipped, and delivered.</p>
      {fulfillments.map((f) => {
        let pickup: Record<string, string> | null = null;
        try { pickup = f.pickupLocationSnapshot ? JSON.parse(f.pickupLocationSnapshot) as Record<string, string> : null; } catch { pickup = null; }
        const options: Array<[string, string]> = f.method === "pickup"
          ? (f.status === "unfulfilled" ? [["processing", "Start preparing"], ["cancelled", "Cancel fulfilment"]] : f.status === "processing" ? [["ready_for_pickup", "Ready for pickup"], ["cancelled", "Cancel fulfilment"]] : f.status === "ready_for_pickup" ? [["delivered", "Customer collected"]] : [])
          : (f.status === "unfulfilled" ? [["processing", "Processing"], ["cancelled", "Cancel fulfilment"]] : f.status === "processing" ? [["shipped", "Shipped"], ["cancelled", "Cancel fulfilment"]] : f.status === "shipped" ? [["delivered", "Delivered"]] : []);
        return <div key={f.id} className="border-b border-line py-4 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{brandNames.get(f.brandId) ?? "Brand"} · {f.method === "pickup" ? "Customer pickup" : "Delivery"}</h3><Badge tone={f.status === "delivered" ? "ok" : f.status === "cancelled" ? "warn" : ""}>{f.status.replace(/_/g, " ")}</Badge></div>
          {pickup && <p className="mt-2 text-sm text-muted">{[pickup.name, pickup.addressLine1, pickup.addressLine2, pickup.city, pickup.state, pickup.postalCode].filter(Boolean).join(", ")}{pickup.instructions ? ` · ${pickup.instructions}` : ""}</p>}
          {f.method === "delivery" && (f.trackingNumber || f.trackingUrl) && <p className="mt-2 text-sm text-muted">Tracking: {f.trackingNumber ?? "—"} {f.trackingUrl ? <a className="underline" href={f.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment</a> : null}</p>}
          {f.method === "delivery" && o.paymentStatus === "paid" && can(actor, "orders.manage", f.brandId) && !legacyMultiBrandShipment && !shipments.some((shipment) => shipment.brandId === f.brandId && shipment.status !== "failed") && <div className="mt-3 max-w-sm"><ActionForm action={createBrandShipmentAction} submitLabel={`Create ${brandNames.get(f.brandId) ?? "brand"} shipment`} hidden={{ orderId: o.id, brandId: f.brandId }} fields={[]} /></div>}
          {options.length > 0 && can(actor, "orders.manage", f.brandId) && <div className="mt-3 max-w-sm"><ActionForm action={updateBrandFulfilmentAction} submitLabel="Update fulfilment" hidden={{ fulfilmentId: f.id }} fields={[{ name: "status", label: "Next status", type: "select", options }]} /></div>}
        </div>;
      })}
    </Panel>}
    {manage && <Panel title="Fulfilment">
      {fulfillments.some((f) => f.method === "pickup") ? <p className="text-sm text-muted">This is a pickup order. Use the Brand fulfilment panel to prepare the order and confirm collection.</p> : legacyMultiBrandShipment ? <p className="text-sm text-muted">A legacy combined shipment already exists for this multi-brand order. Its tracking is shown below; do not create duplicate parcels for the same items.</p> : shipments.length === 0 ? <p className="text-sm text-muted">Create a separate parcel from each brand's row in the Brand fulfilment panel after payment is confirmed.</p> : null}
      {shipments.length > 0 && <Table head={["Brand", "Carrier", "Status", "Tracking"]} rows={shipments.map((s) => [s.brandId ? brandNames.get(s.brandId) ?? "Brand" : "Order-level shipment", s.carrier, s.status.replace(/_/g, " "), s.trackingNumber ?? "—"])} />}
      <div className="mt-6 max-w-md"><ActionForm action={updateOrderStatusAction} submitLabel="Update status" hidden={{ orderId: o.id }} fields={[{ name: "status", label: "Move to", type: "select", options: [["processing", "Processing"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"], ["refunded", "Refunded"]] }, { name: "note", label: "Note", required: false }]} /></div></Panel>}
    <Panel title="Timeline"><Table head={["When", "Change", "Note"]} rows={history.map((h) => [when(h.createdAt), `${h.fromStatus ?? "—"} → ${h.toStatus}`, h.note ?? ""])} /></Panel></div>);
}
