import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, discounts } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveDiscountAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminDiscountsPage() {
  const {actor}=await requireAdmin(); const db=getDb(); const scope=scopedBrandIds(actor,"discounts.manage");
  const brandRows=await db.select().from(brands).where(scope==="all"?undefined:inArray(brands.id,scope)).orderBy(asc(brands.name));
  const rows=await db.select({discount:discounts,brandName:brands.name}).from(discounts).leftJoin(brands,eq(brands.id,discounts.brandId)).where(scope==="all"?undefined:inArray(discounts.brandId,scope)).orderBy(desc(discounts.createdAt)).limit(100);
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Discounts</h1><p className="mt-2 text-sm text-neutral-600">Fixed discounts use naira in the form and are stored in kobo. Percentage discounts use a whole-number percentage.</p>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Create discount</h2><AdminActionForm action={saveDiscountAction} submitLabel="Save discount"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AdminSelect label="Brand scope" name="brandId" options={[...(scope==="all"?[{label:"House-wide",value:""}]:[]),...brandRows.map(b=>({label:b.name,value:b.id}))]}/>
      <AdminField label="Code" name="code" required/><AdminSelect label="Discount type" name="kind" defaultValue="percent" options={[{label:"Percentage",value:"percent"},{label:"Fixed amount (NGN)",value:"fixed"}]}/>
      <AdminField label="Value" name="value" type="number" required/><AdminField label="Minimum subtotal (NGN)" name="minSubtotal" type="number"/><AdminField label="Maximum redemptions" name="maxRedemptions" type="number"/>
      <AdminField label="Starts at" name="startsAt" type="datetime-local"/><AdminField label="Ends at" name="endsAt" type="datetime-local"/>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isActive" defaultChecked className="size-4"/> Active</label>
    </div></AdminActionForm></section>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Discount codes ({rows.length})</div><div className="divide-y">{rows.map(({discount:d,brandName})=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold">{d.code}</p><p className="mt-1 text-xs text-neutral-500">{brandName??"House-wide"} · {d.kind==="percent"?d.value+"%":"₦"+(d.value/100).toLocaleString("en-NG")} · {d.redemptionCount} redemptions</p></div><span className={d.isActive?"rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800":"rounded-full bg-neutral-100 px-3 py-1 text-xs"}>{d.isActive?"Active":"Inactive"}</span></div>)}</div></section>
  </main>;
}
