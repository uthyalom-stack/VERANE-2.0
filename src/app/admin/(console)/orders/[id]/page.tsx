import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { getOrderForAdmin } from "@/domains/orders/queries";
import { can } from "@/domains/authorization";
import { isAppError } from "@/lib/errors";
import { PageHead, Panel, Table, Badge, statusTone, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { createShipmentAction, updateOrderStatusAction } from "@/app/actions/admin";
import { formatMoney } from "@/lib/money";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const b = await getOrderForAdmin(db, actor, id).catch((e) => { if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null; throw e; });
  if (!b) notFound();
  const { order: o, items, shipments, history, partial } = b; const a = o.shippingAddressJson as Record<string, string>;
  const manage = items.length > 0 && items.every((i) => can(actor, "orders.manage", i.brandId)) && !partial;
  return (<div><PageHead title={o.orderNumber} action={<Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge>} sub={`${o.email} · ${when(o.createdAt)}`} />
    {partial && <p role="status" className="mb-6 rounded-[var(--r-md)] border border-amber-500/40 p-4 text-sm">This order contains items from another brand. You can see only your brand&apos;s lines and cannot change the order&apos;s status or create its shipment.</p>}
    <Panel title="Items"><Table head={["Item", "SKU", "Qty", "Unit", "Line"]} rows={items.map((i) => [`${i.productName} ${[i.colorName, i.size].filter(Boolean).join(" / ")}`, i.sku, i.quantity, formatMoney(i.unitPrice, o.currency), formatMoney(i.lineTotal, o.currency)])} />
      <dl className="mt-4 grid max-w-xs gap-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(o.subtotal, o.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>{formatMoney(o.discountTotal, o.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatMoney(o.shippingTotal, o.currency)}</dd></div><div className="flex justify-between border-t border-line pt-1"><dt>Total</dt><dd>{formatMoney(o.total, o.currency)}</dd></div></dl></Panel>
    <Panel title="Delivery address"><p className="text-sm">{a.recipientName}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state}<br />{o.phone}</p></Panel>
    {manage && <Panel title="Fulfilment">
      {shipments.length === 0 ? (o.paymentStatus === "paid" ? <form action={createShipmentAction.bind(null, o.id)}><Button>Create shipment</Button></form> : <p className="text-sm text-muted">Shipment can be created once the order is paid.</p>)
        : <Table head={["Carrier", "Status", "Tracking"]} rows={shipments.map((s) => [s.carrier, s.status.replace(/_/g, " "), s.trackingNumber ?? "—"])} />}
      <div className="mt-6 max-w-md"><ActionForm action={updateOrderStatusAction} submitLabel="Update status" hidden={{ orderId: o.id }} fields={[{ name: "status", label: "Move to", type: "select", options: [["processing", "Processing"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"], ["refunded", "Refunded"]] }, { name: "note", label: "Note", required: false }]} /></div></Panel>}
    <Panel title="Timeline"><Table head={["When", "Change", "Note"]} rows={history.map((h) => [when(h.createdAt), `${h.fromStatus ?? "—"} → ${h.toStatus}`, h.note ?? ""])} /></Panel></div>);
}
