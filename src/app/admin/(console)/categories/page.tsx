import { adminCtx } from "@/lib/admin";
import { categories } from "@/infrastructure/db/schema";
import { PageHead, Panel, Table } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveCategoryAction } from "@/app/actions/admin";
export default async function Categories() {
  const { db } = await adminCtx(); const list = await db.select().from(categories);
  return (<div><PageHead title="Categories" sub="House-wide taxonomy. Changes require super admin access." />
    <Table head={["Name", "Slug", "Kind", "Order"]} rows={list.map((c) => [c.name, c.slug, c.kind, c.sortOrder])} empty="No categories." />
    <Panel title="Add category"><div className="max-w-md"><ActionForm action={saveCategoryAction} submitLabel="Add category" fields={[{ name: "name", label: "Name" }, { name: "kind", label: "Kind", type: "select", options: [["clothing", "Clothing"], ["footwear", "Footwear"], ["accessory", "Accessory"], ["other", "Other"]] }, { name: "sortOrder", label: "Sort order", type: "number", required: false, defaultValue: "0" }]} /></div></Panel></div>);
}
