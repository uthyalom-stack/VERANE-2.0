import { adminCtx } from "@/lib/admin";
import { listCollectionsAdmin } from "@/domains/admin/catalog";
import { brands } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { PageHead, Panel, Table, Badge, statusTone, A } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveCollectionAction } from "@/app/actions/admin";
export default async function Collections() {
  const { db, actor } = await adminCtx(); const [list, bs] = await Promise.all([listCollectionsAdmin(db, actor), db.select().from(brands)]); const bn = new Map(bs.map((b) => [b.id, b.name]));
  const opts: Array<[string, string]> = [...(can(actor, "catalog.collection.write", null) ? [["", "House-wide"] as [string, string]] : []), ...bs.filter((b) => can(actor, "catalog.collection.write", b.id)).map((b) => [b.id, b.name] as [string, string])];
  return (<div><PageHead title="Collections" /><Table head={["Title", "Brand", "Status"]} rows={list.map((c) => [<A key="t" href={`/admin/collections/${c.id}`}>{c.title}</A>, c.brandId ? bn.get(c.brandId) : "House-wide", <Badge key="s" tone={statusTone(c.status)}>{c.status}</Badge>])} empty="No collections yet." />
    <Panel title="New collection"><div className="max-w-md"><ActionForm action={saveCollectionAction} submitLabel="Create collection" fields={[{ name: "title", label: "Title" }, { name: "brandId", label: "Brand", type: "select", options: opts }, { name: "description", label: "Description", type: "textarea", required: false }]} /></div></Panel></div>);
}
