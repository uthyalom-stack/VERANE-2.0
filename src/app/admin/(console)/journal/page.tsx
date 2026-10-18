import { adminCtx } from "@/lib/admin";
import { listArticlesAdmin } from "@/domains/admin/content";
import { brands } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { PageHead, Panel, Table, Badge, statusTone, A } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveArticleAction } from "@/app/actions/admin";
export const KINDS: Array<[string, string]> = [["story", "Story"], ["interview", "Interview"], ["lookbook", "Lookbook"], ["styling_guide", "Styling guide"], ["film", "Film"], ["brand_story", "Brand story"], ["collaboration", "Collaboration"]];
export default async function Journal() {
  const { db, actor } = await adminCtx(); const [list, bs] = await Promise.all([listArticlesAdmin(db, actor), db.select().from(brands)]);
  const brandOpts: Array<[string, string]> = [...(can(actor, "content.write", null) ? [["", "House-wide"] as [string, string]] : []), ...bs.filter((b) => can(actor, "content.write", b.id)).map((b) => [b.id, b.name] as [string, string])];
  return (<div><PageHead title="Journal" /><Table head={["Title", "Kind", "Status"]} rows={list.map((a) => [<A key="t" href={`/admin/journal/${a.id}`}>{a.title}</A>, a.kind.replace(/_/g, " "), <Badge key="s" tone={statusTone(a.status)}>{a.status}</Badge>])} empty="No articles yet." />
    <Panel title="New article"><div className="max-w-md"><ActionForm action={saveArticleAction} submitLabel="Create article" fields={[{ name: "title", label: "Title" }, { name: "kind", label: "Kind", type: "select", options: KINDS }, { name: "brandId", label: "Brand", type: "select", options: brandOpts }, { name: "excerpt", label: "Excerpt", type: "textarea", required: false, rows: 3 }]} /></div></Panel></div>);
}
