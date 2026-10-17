import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { orderItems, orders } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { updateOrderStatusAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

const nextStatuses: Record<string,string[]> = { paid:["processing","cancelled"], processing:["shipped","cancelled"], shipped:["delivered"], delivered:["refunded"] };
const money = (n:number) => "₦"+(n/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AdminOrdersPage() {
  const { actor } = await requireAdmin(); const db = getDb(); const scope = scopedBrandIds(actor,"orders.manage");
  let rows;
  if(scope==="all") rows=await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  else {
    const visible=await db.selectDistinct({orderId:orderItems.orderId}).from(orderItems).where(inArray(orderItems.brandId,scope));
    rows=visible.length?await db.select().from(orders).where(inArray(orders.id,visible.map(v=>v.orderId))).orderBy(desc(orders.createdAt)).limit(100):[];
  }
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Orders</h1><p className="mt-2 text-sm text-neutral-600">Status changes are checked server-side against the order lifecycle and every brand in the order.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Recent orders ({rows.length})</div><div className="divide-y">{rows.map(o=><div key={o.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr_2fr] lg:items-center"><div><p className="font-semibold">{o.orderNumber}</p><p className="mt-1 text-sm text-neutral-500">{o.email} · {new Date(o.createdAt).toLocaleString()}</p></div><div><p className="font-medium">{money(o.total)}</p><p className="mt-1 text-xs text-neutral-500">Order: {o.status} · Payment: {o.paymentStatus}</p></div>
      {nextStatuses[o.status]?.length?<AdminActionForm action={updateOrderStatusAction} submitLabel="Update order"><input type="hidden" name="orderId" value={o.id}/><div className="grid gap-2 sm:grid-cols-2"><AdminSelect label="Next status" name="status" options={nextStatuses[o.status].map(s=>({label:s.replaceAll("_"," "),value:s}))}/><AdminField label="Note (optional)" name="note"/></div></AdminActionForm>:<p className="text-sm text-neutral-500">No direct status transition available from <strong>{o.status}</strong>.</p>}
    </div>)}</div></section>
  </main>;
}
