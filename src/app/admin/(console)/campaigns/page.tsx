import { adminCtx } from "@/lib/admin";
import { listCampaignsAdmin } from "@/domains/admin/content";
import { brands } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { PageHead, Panel, Table, Badge, statusTone, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveCampaignAction } from "@/app/actions/admin";
export default async function Campaigns() {
  const { db, actor } = await adminCtx(); const [list, bs, media] = await Promise.all([listCampaignsAdmin(db, actor), db.select().from(brands), listMedia(db, actor)]); const bn = new Map(bs.map((b) => [b.id, b.name]));
  const mo: Array<[string, string]> = [["", "— none —"], ...media.map((m) => [m.id, `${m.kind}: ${m.altText ?? m.storageKey}`] as [string, string])];
  const brandOpts: Array<[string, string]> = [...(can(actor, "content.write", null) ? [["", "House-wide"] as [string, string]] : []), ...bs.filter((b) => can(actor, "content.write", b.id)).map((b) => [b.id, b.name] as [string, string])];
  return (<div><PageHead title="Campaigns" sub="Hero imagery or film with a dedicated mobile crop and poster." />
    <Table head={["Title", "Brand", "Status", "Window"]} rows={list.map((c) => [c.title, c.brandId ? bn.get(c.brandId) : "House-wide", <Badge key="s" tone={statusTone(c.status)}>{c.status}</Badge>, `${when(c.startsAt)} → ${when(c.endsAt)}`])} empty="No campaigns yet." />
    <Panel title="New campaign"><div className="max-w-xl"><ActionForm action={saveCampaignAction} submitLabel="Save campaign" fields={[{ name: "title", label: "Title" }, { name: "brandId", label: "Brand", type: "select", options: brandOpts }, { name: "subtitle", label: "Subtitle", required: false }, { name: "heroMediaId", label: "Hero (desktop)", type: "select", required: false, options: mo }, { name: "heroMobileMediaId", label: "Hero (mobile crop)", type: "select", required: false, options: mo }, { name: "posterMediaId", label: "Video poster", type: "select", required: false, options: mo }, { name: "ctaLabel", label: "Button label", required: false }, { name: "ctaHref", label: "Button link", required: false, hint: "/shop or https://…" }, { name: "status", label: "Status", type: "select", options: [["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]] }, { name: "startsAt", label: "Starts", type: "datetime-local", required: false }, { name: "endsAt", label: "Ends", type: "datetime-local", required: false }]} /></div></Panel></div>);
}
