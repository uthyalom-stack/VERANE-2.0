import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { lookItems, looks, products } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { PageHead, Panel, toLocalInput } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveLookAction, setLookItemsAction } from "@/app/actions/admin";
export default async function EditLook({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const [l] = await db.select().from(looks).where(eq(looks.id, id)); if (!l || !can(actor, "content.write", l.brandId)) notFound();
  const [items, ps, media] = await Promise.all([db.select().from(lookItems).where(eq(lookItems.lookId, id)).orderBy(lookItems.sortOrder), db.select().from(products).where(eq(products.brandId, l.brandId)), listMedia(db, actor)]);
  return (<div><PageHead title={l.title} sub="A look only contains products from its own brand." />
    <Panel title="Details"><div className="max-w-xl"><ActionForm action={saveLookAction} submitLabel="Save look" hidden={{ id: l.id, brandId: l.brandId }} fields={[{ name: "title", label: "Title", defaultValue: l.title }, { name: "slug", label: "Slug", defaultValue: l.slug }, { name: "description", label: "Description", type: "textarea", required: false, defaultValue: l.description ?? "" }, { name: "stylingNotes", label: "Styling notes", type: "textarea", required: false, defaultValue: l.stylingNotes ?? "" }, { name: "imageMediaId", label: "Look image", type: "select", required: false, defaultValue: l.imageMediaId ?? "", options: [["", "— none —"], ...media.filter((m) => m.kind === "image").map((m) => [m.id, m.altText ?? m.storageKey] as [string, string])] }, { name: "status", label: "Status", type: "select", defaultValue: l.status, options: [["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]] }, { name: "publishAt", label: "Publish at", type: "datetime-local", required: false, defaultValue: toLocalInput(l.publishAt) }, { name: "sortOrder", label: "Sort order", type: "number", required: false, defaultValue: String(l.sortOrder) }]} /></div></Panel>
    <Panel title="Products in this look"><div className="max-w-xl"><ActionForm action={setLookItemsAction} submitLabel="Save items" hidden={{ lookId: id }} fields={[{ name: "productIds", label: "Products", type: "checkboxes", required: false, options: ps.map((p) => [p.id, p.name]), defaultValue: items.map((i) => i.productId).join(",") }]} /></div></Panel></div>);
}
