import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { listCustomers } from "@/domains/admin/ops";
import { requireAdmin } from "@/lib/http/session";

const money = (n:number) => "₦"+(n/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function AdminCustomersPage() {
  const {actor}=await requireAdmin(); const rows=await listCustomers(getDb(),actor,200);
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Customers</h1><p className="mt-2 text-sm text-neutral-600">Only customers associated with orders in your authorised brand scope are included.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Customers ({rows.length})</div><div className="divide-y">{rows.map((c,i)=><div key={c.email+"-"+i} className="grid gap-2 px-5 py-4 sm:grid-cols-4"><div><p className="font-medium">{c.name?.trim()||"Customer"}</p><p className="text-sm text-neutral-500">{c.email}</p></div><p className="text-sm">Orders: {c.n}</p><p className="text-sm">Lifetime spend: {money(Number(c.spent??0))}</p><p className="text-sm text-neutral-500">Last order: {c.last?new Date(c.last).toLocaleDateString():"—"}</p></div>)}{rows.length===0?<p className="px-5 py-8 text-sm text-neutral-500">No customer orders are visible in your current scope.</p>:null}</div></section>
  </main>;
}
