import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { lookItems, looks, products } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveLookAction, setLookItemsAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminLookDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {actor}=await requireAdmin(); const db=getDb();
  const [look]=await db.select().from(looks).where(eq(looks.id,id)); if(!look) notFound();
  assertCan(actor,"content.write",look.brandId);
  const productRows=await db.select().from(products).where(eq(products.brandId,look.brandId)).orderBy(asc(products.name)).limit(300);
  const assigned=await db.select().from(lookItems).where(eq(lookItems.lookId,id)); const assignedIds=new Set(assigned.map(x=>x.productId));
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin/content" className="text-sm text-neutral-500">← Editorial content</Link><h1 className="mt-3 text-3xl font-semibold">{look.title}</h1>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Look details</h2><AdminActionForm action={saveLookAction} submitLabel="Save look"><input type="hidden" name="id" value={id}/><input type="hidden" name="brandId" value={look.brandId}/><input type="hidden" name="imageMediaId" value={look.imageMediaId??""}/><input type="hidden" name="seoTitle" value={look.seoTitle??""}/><input type="hidden" name="seoDescription" value={look.seoDescription??""}/>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><AdminField label="Title" name="title" defaultValue={look.title} required/><AdminField label="Slug" name="slug" defaultValue={look.slug} required/><AdminSelect label="Status" name="status" defaultValue={look.status} options={[{label:"Draft",value:"draft"},{label:"Scheduled",value:"scheduled"},{label:"Published",value:"published"},{label:"Archived",value:"archived"}]}/><AdminField label="Publish date" name="publishAt" type="datetime-local" defaultValue={look.publishAt?look.publishAt.toISOString().slice(0,16):""}/><AdminField label="Sort order" name="sortOrder" type="number" defaultValue={look.sortOrder}/></div>
      <label className="mt-4 block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" defaultValue={look.description??""} rows={3} className="w-full rounded-xl border px-3 py-2.5"/></label><label className="mt-4 block space-y-1.5 text-sm"><span className="font-medium">Styling notes</span><textarea name="stylingNotes" defaultValue={look.stylingNotes??""} rows={3} className="w-full rounded-xl border px-3 py-2.5"/></label>
    </AdminActionForm></section>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="text-lg font-semibold">Products in this look</h2><AdminActionForm action={setLookItemsAction} submitLabel="Save look composition"><input type="hidden" name="lookId" value={id}/><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{productRows.map(p=><label key={p.id} className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" name="productIds" value={p.id} defaultChecked={assignedIds.has(p.id)} className="mt-1 size-4"/><span><span className="block font-medium">{p.name}</span><span className="block text-xs text-neutral-500">{p.status} · {p.slug}</span><input name={`note_${p.id}`} placeholder="Optional styling note" defaultValue={assigned.find(x=>x.productId===p.id)?.stylingNote??""} className="mt-2 w-full rounded-lg border px-2 py-1 text-xs"/></span></label>)}</div></AdminActionForm></section>
  </main>;
}
