import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { listAdminUsers } from "@/domains/admin/ops";
import { requireAdmin } from "@/lib/http/session";
import { createAdminUserAction, grantRoleAction, revokeGrantAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminUsersPage() {
  const {actor}=await requireAdmin(); assertCan(actor,"users.manage",null);
  const db=getDb(); const users=await listAdminUsers(db,actor); const brandRows=await db.select().from(brands).orderBy(asc(brands.name));
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Admin users & access</h1><p className="mt-2 text-sm text-neutral-600">Role changes revoke active sessions. Never share a temporary password beyond the secure handoff to the new admin.</p>
    <section className="mt-8 rounded-2xl border p-5"><h2 className="mb-4 text-lg font-semibold">Create administrator</h2><AdminActionForm action={createAdminUserAction} submitLabel="Create admin"><div className="grid gap-4 sm:grid-cols-2"><AdminField label="Full name" name="name" required/><AdminField label="Email" name="email" type="email" required/></div></AdminActionForm></section>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Administrators ({users.length})</div><div className="divide-y">{users.map(u=><div key={u.id} className="space-y-4 px-5 py-5"><div><p className="font-semibold">{u.name}</p><p className="text-sm text-neutral-500">{u.email} · {u.status}</p></div><div className="flex flex-wrap gap-2">{u.grants.map(g=><span key={g.id} className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs">{g.role} · {g.brand}<form action={revokeGrantAction.bind(null,g.id)}><button aria-label={`Revoke ${g.role} for ${u.email}`} className="font-bold text-red-700">×</button></form></span>)}</div>
      <AdminActionForm action={grantRoleAction} submitLabel="Grant role"><input type="hidden" name="userId" value={u.id}/><div className="grid gap-3 sm:grid-cols-3"><AdminSelect label="Role" name="role" options={[{label:"UTHY brand admin",value:"UTHY_ADMIN"},{label:"ALOMZIEE brand admin",value:"ALOMZIEE_ADMIN"},{label:"SUPER_ADMIN (global)",value:"SUPER_ADMIN"}]}/><AdminSelect label="Brand (required for brand admins)" name="brandId" options={[{label:"Global / none",value:""},...brandRows.map(b=>({label:b.name,value:b.id}))]}/><p className="self-end text-xs text-neutral-500">The server enforces role-to-brand rules.</p></div></AdminActionForm>
    </div>)}</div></section>
  </main>;
}
