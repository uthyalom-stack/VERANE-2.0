import { adminCtx } from "@/lib/admin";
import { listAudit } from "@/domains/admin/ops";
import { PageHead, Table, when } from "@/components/admin/ui";
export default async function Audit() {
  const { db, actor } = await adminCtx(); const rows = await listAudit(db, actor);
  return (<div><PageHead title="Audit log" /><Table head={["When", "Actor", "Action", "Entity"]} rows={rows.map((r) => [when(r.createdAt), r.actorUserId?.slice(0, 8) ?? "system", r.action, `${r.entityType}:${r.entityId ?? ""}`])} empty="Nothing recorded yet." /></div>);
}
