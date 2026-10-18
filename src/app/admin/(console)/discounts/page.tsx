import { adminCtx, dollars } from "@/lib/admin";
import { listDiscounts } from "@/domains/admin/discounts";
import { brands } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { PageHead, Panel, Table, Badge, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveDiscountAction } from "@/app/actions/admin";
export default async function Discounts() {
  const { db, actor } = await adminCtx(); const [list, bs] = await Promise.all([listDiscounts(db, actor), db.select().from(brands)]); const bn = new Map(bs.map((b) => [b.id, b.name]));
  const opts: Array<[string, string]> = [...(can(actor, "discounts.write", null) ? [["", "All brands"] as [string, string]] : []), ...bs.filter((b) => can(actor, "discounts.write", b.id)).map((b) => [b.id, b.name] as [string, string])];
  return (<div><PageHead title="Discounts" />
    <Table head={["Code", "Brand", "Value", "Used", "Window", "Active"]} rows={list.map((d) => [d.code, d.brandId ? bn.get(d.brandId) : "All brands", d.kind === "percent" ? `${d.value}%` : `₦${dollars(d.value)}`, `${d.redemptionCount}${d.maxRedemptions ? ` / ${d.maxRedemptions}` : ""}`, `${when(d.startsAt)} → ${when(d.endsAt)}`, <Badge key="a" tone={d.isActive ? "ok" : "bad"}>{d.isActive ? "Yes" : "No"}</Badge>])} empty="No discount codes." />
    <Panel title="New discount"><div className="max-w-md"><ActionForm action={saveDiscountAction} submitLabel="Create discount" fields={[{ name: "code", label: "Code" }, { name: "brandId", label: "Applies to", type: "select", options: opts }, { name: "kind", label: "Type", type: "select", options: [["percent", "Percent"], ["fixed", "Fixed amount"]] }, { name: "value", label: "Value (percent, or ₦ amount)", type: "number", step: "0.01" }, { name: "minSubtotal", label: "Minimum subtotal (₦)", type: "number", step: "0.01", required: false }, { name: "maxRedemptions", label: "Max redemptions", type: "number", required: false }, { name: "startsAt", label: "Starts", type: "datetime-local", required: false }, { name: "endsAt", label: "Ends", type: "datetime-local", required: false }, { name: "isActive", label: "Active", type: "checkbox", required: false, defaultValue: "on" }]} /></div></Panel></div>);
}
