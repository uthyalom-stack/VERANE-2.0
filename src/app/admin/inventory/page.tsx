import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, inventoryLevels, productVariants, products, inventoryTransactions } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { adjustStockAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminInventoryPage() {
  const { actor } = await requireAdmin(); const db = getDb(); const scope = scopedBrandIds(actor,"inventory.adjust");
  const rows = await db.select({variant:productVariants,product:products,brandName:brands.name,stock:inventoryLevels})
    .from(productVariants).innerJoin(products,eq(products.id,productVariants.productId)).innerJoin(brands,eq(brands.id,products.brandId))
    .leftJoin(inventoryLevels,eq(inventoryLevels.variantId,productVariants.id))
    .where(scope==="all"?undefined:inArray(products.brandId,scope)).orderBy(asc(brands.name),asc(products.name),asc(productVariants.sortOrder)).limit(300);
  const txs = await db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.createdAt)).limit(30);
  const skuById = new Map(rows.map(r=>[r.variant.id,r.variant.sku]));
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Inventory</h1><p className="mt-2 text-sm text-neutral-600">Available stock is on-hand minus reserved. Adjustments are written to the stock ledger.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Variant stock ({rows.length})</div><div className="divide-y">{rows.map(({variant:v,product:p,brandName,stock})=><div key={v.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_1fr_2fr] lg:items-center"><div><p className="font-medium">{p.name}</p><p className="mt-1 text-xs text-neutral-500">{brandName} · {v.sku} · {[v.size,v.colorName].filter(Boolean).join(" / ")}</p></div><div className="text-sm">On hand <strong>{stock?.onHand??0}</strong> · Reserved <strong>{stock?.reserved??0}</strong> · Available <strong>{(stock?.onHand??0)-(stock?.reserved??0)}</strong></div>
      <AdminActionForm action={adjustStockAction} submitLabel="Apply adjustment"><input type="hidden" name="variantId" value={v.id}/><div className="grid gap-2 sm:grid-cols-3"><AdminField label="Delta (+/-)" name="delta" type="number" required/><AdminSelect label="Type" name="type" defaultValue="adjust" options={[{label:"Manual adjustment",value:"adjust"},{label:"Receive stock",value:"receive"},{label:"Correction",value:"correction"},{label:"Return",value:"return"}]}/><AdminField label="Reason" name="reason" required/></div><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" className="size-4"/> Confirm large adjustment (20+ units)</label></AdminActionForm>
    </div>)}</div></section>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Recent stock transactions</div><div className="divide-y">{txs.map(t=><div key={t.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm"><span>{skuById.get(t.variantId)??t.variantId} · {t.type} · {t.reason??"No reason"}</span><span className="text-neutral-500">{t.onHandDelta>=0?"+":""}{t.onHandDelta} on hand · {new Date(t.createdAt).toLocaleString()}</span></div>)}</div></section>
  </main>;
}
