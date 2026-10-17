import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, collections } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveCollectionAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminCollectionsPage() {
  const { actor } = await requireAdmin(); const db = getDb();
  const scope = scopedBrandIds(actor, "catalog.collection.write");
  const brandRows = await db.select().from(brands).where(scope === "all" ? undefined : inArray(brands.id, scope)).orderBy(asc(brands.name));
  const rows = await db.select({collection:collections,brandName:brands.name}).from(collections).leftJoin(brands,eq(brands.id,collections.brandId)).where(scope === "all" ? undefined : inArray(collections.brandId, scope)).orderBy(desc(collections.updatedAt)).limit(100);
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Collections</h1>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Create collection</h2>
      <AdminActionForm action={saveCollectionAction} submitLabel="Create collection">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminSelect label="Brand scope" name="brandId" options={[...(scope==="all"?[{label:"House-wide (SUPER_ADMIN only)",value:""}]:[]),...brandRows.map(b=>({label:b.name,value:b.id}))]}/>
          <AdminField label="Title" name="title" required/><AdminField label="Slug (optional)" name="slug" hint="Lowercase words separated by hyphens."/>
          <AdminSelect label="Status" name="status" defaultValue="draft" options={[{label:"Draft",value:"draft"},{label:"Published",value:"published"},{label:"Scheduled",value:"scheduled"}]}/>
          <AdminField label="Publish date (if scheduled)" name="publishAt" type="datetime-local"/>
          <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="isFeatured" className="size-4"/> Featured collection</label>
        </div>
        <label className="block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" rows={3} className="w-full rounded-xl border px-3 py-2.5"/></label>
      </AdminActionForm>
    </section>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Collections ({rows.length})</div><div className="divide-y">{rows.map(({collection:c,brandName})=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><Link href={`/admin/collections/${c.id}`} className="font-medium underline-offset-4 hover:underline">{c.title}</Link><p className="mt-1 text-xs text-neutral-500">{brandName ?? "House-wide"} · {c.slug}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">{c.status}</span></div>)}</div></section>
  </main>;
}
