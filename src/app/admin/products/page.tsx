import Link from "next/link";
import { asc, desc, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, products, productVariants } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveProductAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminProductsPage() {
  const { actor } = await requireAdmin();
  const db = getDb();
  const scope = scopedBrandIds(actor, "catalog.product.write");
  const brandRows = await db.select().from(brands).where(scope === "all" ? undefined : inArray(brands.id, scope)).orderBy(asc(brands.name));
  const rows = await db.select({ product: products, brandName: brands.name })
    .from(products).innerJoin(brands, eq(brands.id, products.brandId))
    .where(scope === "all" ? undefined : inArray(products.brandId, scope))
    .orderBy(desc(products.updatedAt)).limit(100);
  const variantCounts = await db.select({ productId: productVariants.productId, count: productVariants.id }).from(productVariants);
  const counts = new Map<string, number>();
  for (const v of variantCounts) counts.set(v.productId, (counts.get(v.productId) ?? 0) + 1);
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-black">← Admin workspace</Link>
      <h1 className="mt-3 text-3xl font-semibold">Products</h1>
      <p className="mt-2 text-sm text-neutral-600">Prices are entered in naira and stored as integer kobo. Add at least one sellable variant before publishing a product.</p>
      <section className="mt-8 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold">Create product</h2>
        <AdminActionForm action={saveProductAction} submitLabel="Create product">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminSelect label="Brand" name="brandId" required options={brandRows.map(b => ({label:b.name,value:b.id}))}/>
            <AdminField label="Product name" name="name" required/>
            <AdminField label="Slug (optional)" name="slug" hint="Leave blank to generate from the name."/>
            <AdminField label="Price (NGN)" name="basePrice" type="number" required hint="Enter naira, e.g. 25000.00"/>
            <AdminField label="Compare-at price (optional)" name="compareAtPrice" type="number"/>
            <AdminSelect label="Initial status" name="status" defaultValue="draft" options={[{label:"Draft",value:"draft"},{label:"Published",value:"published"}]}/>
            <AdminField label="Product type" name="productType"/>
            <AdminField label="Style" name="style"/>
            <AdminField label="Occasion" name="occasion"/>
            <AdminField label="Short subtitle" name="subtitle"/>
          </div>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" rows={4} className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"/></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" className="size-4"/> Feature this product</label>
        </AdminActionForm>
      </section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
        <div className="border-b border-neutral-200 px-5 py-4"><h2 className="font-semibold">Catalog ({rows.length})</h2></div>
        <div className="divide-y divide-neutral-100">
          {rows.map(({product:p,brandName}) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div><Link href={`/admin/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.name}</Link><p className="mt-1 text-xs text-neutral-500">{brandName} · {p.slug} · {counts.get(p.id) ?? 0} variants</p></div>
            <div className="flex items-center gap-3 text-sm"><span className="rounded-full bg-neutral-100 px-3 py-1">{p.status}</span><span>₦{(p.basePrice/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          </div>)}
          {rows.length === 0 ? <p className="px-5 py-8 text-sm text-neutral-500">No products in your permitted brand scope yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
