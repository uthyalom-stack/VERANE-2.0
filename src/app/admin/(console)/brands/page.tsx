import { adminCtx } from "@/lib/admin";
import { brands } from "@/infrastructure/db/schema";
import { PageHead, Panel } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { updateBrandAction } from "@/app/actions/admin";
export default async function Brands() {
  const { db } = await adminCtx();
  return (<div><PageHead title="Brands" sub="Brand records are global; only super admins can edit them." />{(await db.select().from(brands)).map((b) => <Panel key={b.id} title={b.name}><div className="max-w-md"><ActionForm action={updateBrandAction} submitLabel="Save brand" hidden={{ id: b.id }} fields={[{ name: "name", label: "Name", defaultValue: b.name }, { name: "tagline", label: "Tagline", required: false, defaultValue: b.tagline ?? "" }, { name: "description", label: "Description", type: "textarea", required: false, defaultValue: b.description ?? "" }, { name: "isActive", label: "Active", type: "checkbox", required: false, defaultValue: b.isActive ? "on" : "" }]} /></div></Panel>)}</div>);
}
