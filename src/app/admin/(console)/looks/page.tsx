import { adminCtx } from "@/lib/admin";
import { listLooksAdmin } from "@/domains/admin/content";
import { brands } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { PageHead, Panel, Table, Badge, statusTone, A } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveLookAction } from "@/app/actions/admin";
export default async function Looks() {
  const { db, actor } = await adminCtx(); const [list, bs] = await Promise.all([listLooksAdmin(db, actor), db.select().from(brands)]); const bn = new Map(bs.map((b) => [b.id, b.name]));
  return (<div><PageHead title="Looks" /><Table head={["Title", "Brand", "Status"]} rows={list.map((l) => [<A key="t" href={`/admin/looks/${l.id}`}>{l.title}</A>, bn.get(l.brandId), <Badge key="s" tone={statusTone(l.status)}>{l.status}</Badge>])} empty="No looks yet." />
    <Panel title="New look"><div className="max-w-md"><ActionForm action={saveLookAction} submitLabel="Create look" fields={[{ name: "title", label: "Title" }, { name: "brandId", label: "Brand", type: "select", options: bs.filter((b) => can(actor, "content.write", b.id)).map((b) => [b.id, b.name]) }, { name: "description", label: "Description", type: "textarea", required: false }]} /></div></Panel></div>);
}
