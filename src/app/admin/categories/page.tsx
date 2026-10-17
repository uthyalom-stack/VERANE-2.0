import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { categories } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveCategoryAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminCategoriesPage() {
  const { actor } = await requireAdmin();
  assertCan(actor, "catalog.category.write", null);
  const rows = await getDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Categories</h1>
    <p className="mt-2 text-sm text-neutral-600">Categories are house-wide, so only users with the global category permission can edit them.</p>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Add category</h2>
      <AdminActionForm action={saveCategoryAction} submitLabel="Create category">
        <div className="grid gap-4 sm:grid-cols-3"><AdminField label="Name" name="name" required/><AdminSelect label="Type" name="kind" defaultValue="clothing" options={[{label:"Clothing",value:"clothing"},{label:"Footwear",value:"footwear"},{label:"Accessory",value:"accessory"},{label:"Other",value:"other"}]}/><AdminField label="Sort order" name="sortOrder" type="number" defaultValue="0"/></div>
      </AdminActionForm>
    </section>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Current categories ({rows.length})</div><div className="divide-y">{rows.map(c=><div key={c.id} className="px-5 py-4"><p className="mb-3 text-xs text-neutral-500">{c.slug}</p><AdminActionForm action={saveCategoryAction} submitLabel="Update category"><input type="hidden" name="id" value={c.id}/><div className="grid gap-3 sm:grid-cols-3"><AdminField label="Name" name="name" defaultValue={c.name} required/><AdminSelect label="Type" name="kind" defaultValue={c.kind} options={[{label:"Clothing",value:"clothing"},{label:"Footwear",value:"footwear"},{label:"Accessory",value:"accessory"},{label:"Other",value:"other"}]}/><AdminField label="Sort order" name="sortOrder" type="number" defaultValue={c.sortOrder}/></div></AdminActionForm></div>)}</div></section>
  </main>;
}
