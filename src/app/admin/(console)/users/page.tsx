import { adminCtx } from "@/lib/admin";
import { listAdminUsers } from "@/domains/admin/ops";
import { brands } from "@/infrastructure/db/schema";
import { ROLE_DEFINITIONS } from "@/domains/authorization/permissions";
import { PageHead, Panel, Table } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { createAdminUserAction, grantRoleAction, revokeGrantAction } from "@/app/actions/admin";
export default async function Users() {
  const { db, actor } = await adminCtx(); const [users, bs] = await Promise.all([listAdminUsers(db, actor), db.select().from(brands)]);
  return (<div><PageHead title="Users & roles" sub="Brand-scoped admin roles can only access their assigned brand; global roles are reserved for super admins." />
    <Table head={["User", "Email", "Grants"]} rows={users.map((u) => [u.name, u.email, <ul key="g" className="grid gap-1">{u.grants.map((g) => <li key={g.id} className="flex gap-3">{g.role} · {g.brand}<form action={revokeGrantAction.bind(null, g.id)}><button className="underline text-xs">Revoke</button></form></li>)}</ul>])} />
    <Panel title="Create admin"><div className="max-w-md"><ActionForm action={createAdminUserAction} submitLabel="Create admin" fields={[{ name: "name", label: "Name" }, { name: "email", label: "Email", type: "email" }]} /></div></Panel>
    <Panel title="Grant role"><div className="max-w-md"><ActionForm action={grantRoleAction} submitLabel="Grant" fields={[{ name: "userId", label: "User", type: "select", options: users.map((u) => [u.id, u.email]) }, { name: "role", label: "Role", type: "select", options: Object.entries(ROLE_DEFINITIONS).map(([code, definition]) => [code, definition.name]) }, { name: "brandId", label: "Brand (required for brand roles)", type: "select", required: false, options: [["", "— none (global) —"], ...bs.map((b) => [b.id, b.name] as [string, string])] }]} /></div></Panel></div>);
}
