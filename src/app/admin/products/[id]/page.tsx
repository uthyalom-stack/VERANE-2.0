import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, categories, inventoryLevels, mediaAssets, productCategories, productMedia, productVariants, products } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { archiveProductAction, attachMediaAction, detachMediaAction, saveProductAction, saveVariantAction, removeVariantAction, setProductStatusAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireAdmin();
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id,id));
  if (!product) notFound();
  assertCan(actor, "catalog.product.write", product.brandId);
  const [brand] = await db.select().from(brands).where(eq(brands.id,product.brandId));
  const categoryRows = await db.select().from(categories).orderBy(asc(categories.name));
  const assigned = await db.select().from(productCategories).where(eq(productCategories.productId,id));
  const assignedIds = new Set(assigned.map(c=>c.categoryId));
  const variants = await db.select({variant:productVariants,stock:inventoryLevels}).from(productVariants).leftJoin(inventoryLevels,eq(inventoryLevels.variantId,productVariants.id)).where(eq(productVariants.productId,id)).orderBy(asc(productVariants.sortOrder));
  const mediaRows = await db.select().from(mediaAssets).where(or(eq(mediaAssets.brandId,product.brandId),isNull(mediaAssets.brandId))).orderBy(asc(mediaAssets.createdAt)).limit(150);
  const attachedMedia = await db.select({attachment:productMedia,media:mediaAssets}).from(productMedia).innerJoin(mediaAssets,eq(mediaAssets.id,productMedia.mediaId)).where(eq(productMedia.productId,id)).orderBy(asc(productMedia.sortOrder));
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link href="/admin/products" className="text-sm text-neutral-500 hover:text-black">← Products</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-neutral-500">{brand?.name ?? "Brand"}</p><h1 className="mt-2 text-3xl font-semibold">{product.name}</h1><p className="mt-2 text-sm text-neutral-600">SKU variants, stock and publication controls.</p></div>
      <div className="flex gap-2">
        <form action={setProductStatusAction.bind(null,id,product.status==="published"?"draft":"published")}><button className="rounded-full border px-4 py-2 text-sm">{product.status==="published"?"Unpublish":"Publish"}</button></form>
        <form action={archiveProductAction.bind(null,id)}><button className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700">Archive</button></form>
      </div></div>
      <section className="mt-8 rounded-2xl border p-5">
        <h2 className="mb-4 text-lg font-semibold">Product details</h2>
        <AdminActionForm action={saveProductAction} submitLabel="Save product">
          <input type="hidden" name="id" value={id}/>
          <input type="hidden" name="brandId" value={product.brandId}/>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminField label="Name" name="name" defaultValue={product.name} required/>
            <AdminField label="Slug" name="slug" defaultValue={product.slug} required/>
            <AdminField label="Price (NGN)" name="basePrice" type="number" defaultValue={(product.basePrice/100).toFixed(2)} required/>
            <AdminField label="Compare-at price (NGN)" name="compareAtPrice" type="number" defaultValue={product.compareAtPrice == null ? "" : (product.compareAtPrice/100).toFixed(2)}/>
            <AdminField label="Subtitle" name="subtitle" defaultValue={product.subtitle ?? ""}/>
            <AdminField label="Product type" name="productType" defaultValue={product.productType ?? ""}/><AdminField label="Publish date" name="publishAt" type="datetime-local" defaultValue={product.publishAt?product.publishAt.toISOString().slice(0,16):""}/>
            <AdminField label="Style" name="style" defaultValue={product.style ?? ""}/>
            <AdminField label="Occasion" name="occasion" defaultValue={product.occasion ?? ""}/>
            <AdminSelect label="Status" name="status" defaultValue={["draft","scheduled","published"].includes(product.status)?product.status:"draft"} options={[{label:"Draft",value:"draft"},{label:"Scheduled",value:"scheduled"},{label:"Published",value:"published"}]}/>
          </div>
          <label className="block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" defaultValue={product.description ?? ""} rows={4} className="w-full rounded-xl border border-neutral-300 px-3 py-2.5"/></label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><AdminField label="Materials" name="materials" defaultValue={product.materials??""}/><AdminField label="Fit" name="fit" defaultValue={product.fit??""}/><AdminField label="Sizing info" name="sizingInfo" defaultValue={product.sizingInfo??""}/><AdminField label="Care instructions" name="careInstructions" defaultValue={product.careInstructions??""}/><AdminField label="Delivery info" name="deliveryInfo" defaultValue={product.deliveryInfo??""}/><AdminField label="SEO title" name="seoTitle" defaultValue={product.seoTitle??""}/><AdminField label="SEO description" name="seoDescription" defaultValue={product.seoDescription??""}/></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={product.isFeatured} className="size-4"/> Featured product</label>
          <div><p className="mb-2 text-sm font-medium">Categories</p><div className="flex flex-wrap gap-3">{categoryRows.map(c=><label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categoryIds" value={c.id} defaultChecked={assignedIds.has(c.id)}/>{c.name}</label>)}</div></div>
        </AdminActionForm>
      </section>
      <section className="mt-8 rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Add a variant</h2><p className="mb-4 mt-1 text-sm text-neutral-600">A product needs an active size/colour variant with stock before customers can buy it.</p>
        <AdminActionForm action={saveVariantAction} submitLabel="Add variant">
          <input type="hidden" name="productId" value={id}/>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminField label="SKU" name="sku" required/>
            <AdminField label="Size" name="size"/>
            <AdminField label="Colour name" name="colorName"/>
            <AdminField label="Colour hex (optional)" name="colorHex" hint="#000000"/>
            <AdminField label="Variant price override (NGN)" name="priceOverride" type="number"/>
            <AdminField label="Initial stock" name="initialStock" type="number" defaultValue="0"/>
            <AdminField label="Sort order" name="sortOrder" type="number" defaultValue="0"/>
            <AdminSelect label="Active" name="isActive" defaultValue="on" options={[{label:"Active",value:"on"},{label:"Inactive",value:"off"}]}/>
          </div>
        </AdminActionForm>
      </section>
<section className="mt-8 rounded-2xl border p-5"><h2 className="text-lg font-semibold">Product media</h2><p className="mt-1 text-sm text-neutral-600">Attach assets already registered in the media library. Uploading new files is not part of this screen yet.</p>
        <AdminActionForm action={attachMediaAction} submitLabel="Attach media"><input type="hidden" name="productId" value={id}/><div className="grid gap-4 sm:grid-cols-2"><AdminSelect label="Media asset" name="mediaId" required options={mediaRows.map(m=>({label:`${m.kind} · ${m.storageKey}`,value:m.id}))}/><AdminSelect label="Role" name="role" defaultValue="secondary" options={[{label:"Primary",value:"primary"},{label:"Secondary",value:"secondary"},{label:"Model",value:"model"},{label:"Lifestyle",value:"lifestyle"},{label:"Detail",value:"detail"},{label:"Video",value:"video"},{label:"3D model",value:"model3d"}]}/></div></AdminActionForm>
        <div className="mt-5 divide-y">{attachedMedia.map(({attachment:a,media:m})=><div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{m.storageKey}</p><p className="text-xs text-neutral-500">{a.role} · order {a.sortOrder}</p></div><form action={detachMediaAction.bind(null,id,a.id)}><button className="rounded-full border border-red-200 px-3 py-2 text-xs text-red-700">Detach</button></form></div>)}
        {attachedMedia.length===0?<p className="py-4 text-sm text-neutral-500">No media is attached to this product.</p>:null}</div>
      </section>
      
      <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4"><h2 className="font-semibold">Variants & stock ({variants.length})</h2></div>
        <div className="divide-y">{variants.map(({variant:v,stock})=><div key={v.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div><p className="font-medium">{v.sku} · {[v.size,v.colorName].filter(Boolean).join(" / ") || "No options"}</p><p className="mt-1 text-xs text-neutral-500">{v.isActive?"Active":"Inactive"} · On hand {stock?.onHand ?? 0} · Reserved {stock?.reserved ?? 0} · Available {(stock?.onHand ?? 0)-(stock?.reserved ?? 0)}</p></div>
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <AdminActionForm action={saveVariantAction} submitLabel="Save variant"><input type="hidden" name="productId" value={id}/><input type="hidden" name="id" value={v.id}/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><AdminField label="SKU" name="sku" defaultValue={v.sku} required/><AdminField label="Size" name="size" defaultValue={v.size??""}/><AdminField label="Colour" name="colorName" defaultValue={v.colorName??""}/><AdminField label="Colour hex" name="colorHex" defaultValue={v.colorHex??""}/><AdminField label="Price override (NGN)" name="priceOverride" type="number" defaultValue={v.priceOverride==null?"":(v.priceOverride/100).toFixed(2)}/><AdminField label="Sort order" name="sortOrder" type="number" defaultValue={v.sortOrder}/><AdminSelect label="Status" name="isActive" defaultValue={v.isActive?"on":"off"} options={[{label:"Active",value:"on"},{label:"Inactive",value:"off"}]}/></div></AdminActionForm>
            <form action={removeVariantAction.bind(null,id,v.id)}><button className="rounded-full border border-red-200 px-3 py-2 text-xs text-red-700">{v.isActive?"Remove / deactivate":"Delete variant"}</button></form>
          </div>
        </div>)}</div>
      </section>
    </main>
  );
}
