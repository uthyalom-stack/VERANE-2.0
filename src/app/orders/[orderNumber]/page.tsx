import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { getOrderForViewer } from "@/domains/orders/queries";
import { viewerFromCookies } from "@/lib/http/order-access";
import { retryPaymentFormAction } from "@/app/actions/cart";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { pending_payment: "Awaiting payment", paid: "Paid", processing: "Being prepared", shipped: "On its way", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded", payment_failed: "Payment failed", expired: "Expired" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderNumber: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { orderNumber } = await params; const { payment } = await searchParams;
  const b = await getOrderForViewer(getDb(), orderNumber, await viewerFromCookies(orderNumber), getEnv().TOKEN_PEPPER);
  if (!b) notFound(); // 404 for both "doesn't exist" and "not yours"
  const { order: o, items, shipments, history } = b; const c = o.currency;
  const banner = o.paymentStatus === "paid" ? { t: "Thank you. Your payment is confirmed.", tone: "text-accent" }
    : payment === "retry_failed" ? { t: "This payment can no longer be retried (the reservation may have expired). Please start a new checkout from your bag.", tone: "text-red-400" }
    : payment === "failed" ? { t: "Your payment didn't go through. You can try again below.", tone: "text-red-400" }
    : payment === "review" ? { t: "We received a payment that didn't match this order's total. Our team will review it; you have not been charged twice.", tone: "text-red-400" }
    : o.status === "pending_payment" ? { t: "We're waiting for payment confirmation. This page updates when it arrives.", tone: "" } : null;
  return (
    <div className="mx-auto max-w-4xl px-5 pb-10 pt-28 md:px-10">
      <p className="text-sm text-muted">Order</p><h1 className="display text-5xl md:text-7xl">{o.orderNumber}</h1>
      <p className="mt-3 text-lg">{LABEL[o.status] ?? o.status}</p>
      {banner && <p role="status" className={`mt-6 rounded-[var(--r-md)] border border-line p-4 ${banner.tone}`}>{banner.t}</p>}
      {o.status === "pending_payment" && <form action={retryPaymentFormAction.bind(null, o.orderNumber)} className="mt-4"><Button type="submit">Pay {formatMoney(o.total, c)}</Button></form>}
      <section className="mt-12"><h2 className="display text-3xl">Items</h2>
        <ul className="mt-4 divide-y divide-line">{items.map((i) => <li key={i.id} className="flex justify-between gap-4 py-4"><span>{i.productName}<span className="block text-sm text-muted">{[i.colorName, i.size && `Size ${i.size}`].filter(Boolean).join(" · ")} × {i.quantity}{i.isPreOrder ? ` · Pre-order${i.fulfillmentTimeSnapshot ? ` · ${i.fulfillmentTimeSnapshot}` : ""}` : ""}{i.customMeasurements ? <span className="block text-xs text-muted">Measurements (cm): {Object.entries(i.customMeasurements).map(([k, v]) => `${k} ${v}`).join(" · ")}</span> : null}</span></span><span>{formatMoney(i.lineTotal, c)}</span></li>)}</ul>
        <dl className="mt-6 grid max-w-sm gap-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatMoney(o.subtotal, c)}</dd></div>
          {o.discountTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>− {formatMoney(o.discountTotal, c)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatMoney(o.shippingTotal, c)}</dd></div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-lg"><dt>Total</dt><dd>{formatMoney(o.total, c)}</dd></div></dl></section>
      {shipments.length > 0 && <section className="mt-12"><h2 className="display text-3xl">Delivery</h2>{shipments.map((s) => <p key={s.id} className="mt-3 text-sm">{s.carrier ?? "Carrier"} · {s.status.replace(/_/g, " ")}{s.trackingNumber && ` · ${s.trackingNumber}`}{s.trackingUrl && <> · <a className="underline" href={s.trackingUrl} rel="noopener noreferrer">Track</a></>}</p>)}</section>}
      <section className="mt-12"><h2 className="display text-3xl">Timeline</h2><ol className="mt-4 grid gap-2 text-sm">{history.map((h) => <li key={h.id} className="flex gap-3"><time className="w-40 text-muted" dateTime={h.createdAt.toISOString()}>{h.createdAt.toLocaleString("en-NG")}</time><span>{LABEL[h.toStatus] ?? h.toStatus}{h.note && ` — ${h.note}`}</span></li>)}</ol></section>
      <div className="mt-12 flex gap-3"><ButtonLink href="/shop" variant="outline">Continue shopping</ButtonLink><Link href="/account/orders" className="min-h-11 px-4 py-3 text-sm underline">All orders</Link></div>
    </div>
  );
}
