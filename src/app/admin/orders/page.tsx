import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { orderItems, orders, shippingRecords } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { createShipmentAction, updateOrderStatusAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

const nextStatuses: Record<string,string[]> = { paid:["processing","cancelled"], processing:["shipped","cancelled"], shipped:["delivered"], delivered:["refunded"] };
const money = (n:number) => "₦"+(n/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AdminOrdersPage() {
  const { actor } = await requireAdmin(); const db = getDb(); const scope = scopedBrandIds(actor,"orders.manage");
  let rows;
  if(scope==="all") rows=await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  else if(scope.length===0) rows=[];
  else {
    const candidates=await db.selectDistinct({orderId:orderItems.orderId}).from(orderItems).where(inArray(orderItems.brandId,scope));
    const candidateIds=candidates.map(v=>v.orderId);
    const allItems=candidateIds.length?await db.select({orderId:orderItems.orderId,brandId:orderItems.brandId}).from(orderItems).where(inArray(orderItems.orderId,candidateIds)):[];
    const brandsByOrder=new Map<string,Set<string>>();
    for(const item of allItems){const set=brandsByOrder.get(item.orderId)??new Set<string>();set.add(item.brandId);brandsByOrder.set(item.orderId,set);}
    const visibleIds=[...brandsByOrder.entries()].filter(([,brandIds])=>[...brandIds].every(id=>scope.includes(id))).map(([id])=>id);
    rows=visibleIds.length?await db.select().from(orders).where(inArray(orders.id,visibleIds)).orderBy(desc(orders.createdAt)).limit(100):[];
  }
  const shipments=rows.length?await db.select().from(shippingRecords).where(inArray(shippingRecords.orderId,rows.map(o=>o.id))):[];
  const shipmentByOrder=new Map<string,typeof shipments[number]>();
  for(const s of shipments){if(!shipmentByOrder.has(s.orderId)||s.createdAt>shipmentByOrder.get(s.orderId)!.createdAt)shipmentByOrder.set(s.orderId,s);}
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Orders</h1><p className="mt-2 text-sm text-neutral-600">Status changes are checked server-side against the order lifecycle and every brand in the order.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Recent orders ({rows.length})</div><div className="divide-y">{rows.map(o=><div key={o.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr_2fr] lg:items-center"><div><p className="font-semibold">{o.orderNumber}</p><p className="mt-1 text-sm text-neutral-500">{o.email} · {new Date(o.createdAt).toLocaleString()}</p></div><div><p className="font-medium">{money(o.total)}</p><p className="mt-1 text-xs text-neutral-500">Order: {o.status} · Payment: {o.paymentStatus}</p></div>
      <div className="space-y-3">{nextStatuses[o.status]?.length?<AdminActionForm action={updateOrderStatusAction} submitLabel="Update order"><input type="hidden" name="orderId" value={o.id}/><div className="grid gap-2 sm:grid-cols-2"><AdminSelect label="Next status" name="status" options={nextStatuses[o.status].map(s=>({label:s.replaceAll("_"," "),value:s}))}/><AdminField label="Note (optional)" name="note"/></div></AdminActionForm>:<p className="text-sm text-neutral-500">No direct status transition available from <strong>{o.status}</strong>.</p>}{o.paymentStatus==="paid"&&["paid","processing"].includes(o.status)&&(!shipmentByOrder.has(o.id)||shipmentByOrder.get(o.id)?.status==="failed")?<form action={createShipmentAction.bind(null,o.id)}><button className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">Create shipment</button></form>:null}{shipmentByOrder.has(o.id)?<p className="text-xs text-neutral-500">Shipment: {shipmentByOrder.get(o.id)!.status}{shipmentByOrder.get(o.id)!.trackingNumber?" · Tracking "+shipmentByOrder.get(o.id)!.trackingNumber:""}</p>:null}</div>
    </div>)}</div></section>
  </main>;
}
