import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { updateBrandAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField } from "@/components/admin/action-form";

export default async function AdminBrandsPage() {
  const {actor}=await requireAdmin(); assertCan(actor,"brands.write",null);
  const rows=await getDb().select().from(brands).orderBy(asc(brands.name));
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Brand profiles</h1><p className="mt-2 text-sm text-neutral-600">Manage the house brand names and descriptions. Brand codes and slugs are immutable here.</p>
    <div className="mt-8 space-y-5">{rows.map(b=><section key={b.id} className="rounded-2xl border p-5"><div className="mb-4"><h2 className="text-lg font-semibold">{b.name}</h2><p className="text-xs text-neutral-500">{b.code} · {b.slug}</p></div><AdminActionForm action={updateBrandAction} submitLabel="Save brand"><input type="hidden" name="id" value={b.id}/><div className="grid gap-4 sm:grid-cols-2"><AdminField label="Display name" name="name" defaultValue={b.name} required/><AdminField label="Tagline" name="tagline" defaultValue={b.tagline??""}/></div><label className="mt-4 block space-y-1.5 text-sm"><span className="font-medium">Description</span><textarea name="description" defaultValue={b.description??""} rows={3} className="w-full rounded-xl border px-3 py-2.5"/></label><label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={b.isActive} className="size-4"/> Active</label></AdminActionForm></section>)}</div>
  </main>;
}
