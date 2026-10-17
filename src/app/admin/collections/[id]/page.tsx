import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, collectionProducts, collections, products } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveCollectionAction, setCollectionProductsAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminCollectionDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {actor}=await requireAdmin(); const db=getDb();
  const [collection]=await db.select().from(collections).where(eq(collections.id,id));
  if(!collection) notFound();
  assertCan(actor,"catalog.collection.write",collection.brandId);
  const [brand]=collection.brandId?await db.select().from(brands).where(eq(brands.id,collection.brandId)):[undefined];
  const productRows=await db.select({product:products,brandName:brands.name}).from(products).innerJoin(brands,eq(brands.id,products.brandId))
    .where(collection.brandId?eq(products.brandId,collection.brandId):undefined).orderBy(asc(products.name)).limit(300);
  const assigned=await db.select().from(collectionProducts).where(eq(collectionProducts.collectionId,id));
  const assignedIds=new Set(assigned.map(p=>p.productId));
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin/collections" className="text-sm text-neutral-500">← Collections</Link>
    <div className="mt-3"><p className="text-xs uppercase tracking-widest text-neutral-500">{brand?.name??"House-wide collection"}</p><h1 className="mt-2 text-3xl font-semibold">{collection.title}</h1></div>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Collection details</h2><AdminActionForm action={saveCollectionAction} submitLabel="Save collection">
      <input type="hidden" name="id" value={id}/><input type="hidden" name="brandId" value={collection.brandId??""}/>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><AdminField label="Title" name="title" defaultValue={collection.title} required/><AdminField label="Slug" name="slug" defaultValue={collection.slug} required/><AdminSelect label="Status" name="status" defaultValue={collection.status} options={[{label:"Draft",value:"draft"},{label:"Scheduled",value:"scheduled"},{label:"Published",value:"published"},{label:"Archived",value:"archived"}]}/><AdminField label="Publish date" name="publishAt" type="datetime-local" defaultValue={collection.publishAt?collection.publishAt.toISOString().slice(0,16):""}/><label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={collection.isFeatured} className="size-4"/> Featured collection</label></div>
      <label className="block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" defaultValue={collection.description??""} rows={4} className="w-full rounded-xl border px-3 py-2.5"/></label>
    </AdminActionForm></section>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="text-lg font-semibold">Products in this collection</h2><p className="mt-1 text-sm text-neutral-600">Only products from this collection's brand can be assigned. Save the list to update order.</p>
      <AdminActionForm action={setCollectionProductsAction} submitLabel="Save product order"><input type="hidden" name="collectionId" value={id}/><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{productRows.map(({product:p,brandName})=><label key={p.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" name="productIds" value={p.id} defaultChecked={assignedIds.has(p.id)} className="mt-1 size-4"/><span><span className="block font-medium">{p.name}</span><span className="block text-xs text-neutral-500">{brandName} · {p.status}</span></span></label>)}</div></AdminActionForm>
    </section>
  </main>;
}
