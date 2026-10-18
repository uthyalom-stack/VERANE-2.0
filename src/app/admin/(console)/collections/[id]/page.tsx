import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { collectionProducts, collections, products } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { brandScopeWhere } from "@/domains/admin/scope";
import { PageHead, Panel, toLocalInput } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { saveCollectionAction, setCollectionProductsAction } from "@/app/actions/admin";
export default async function EditCollection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const [c] = await db.select().from(collections).where(eq(collections.id, id));
  if (!c || !can(actor, "catalog.collection.write", c.brandId)) notFound();
  const [sel, ps, media] = await Promise.all([db.select().from(collectionProducts).where(eq(collectionProducts.collectionId, id)).orderBy(collectionProducts.sortOrder), db.select().from(products).where(brandScopeWhere(actor, "catalog.product.read", products.brandId)), listMedia(db, actor)]);
  const eligible = ps.filter((p) => !c.brandId || p.brandId === c.brandId);
  return (<div><PageHead title={c.title} sub="Products appear in the order listed here." />
    <Panel title="Details"><div className="max-w-xl"><ActionForm action={saveCollectionAction} submitLabel="Save collection" hidden={{ id: c.id, brandId: c.brandId ?? "" }} fields={[{ name: "title", label: "Title", defaultValue: c.title }, { name: "slug", label: "Slug", defaultValue: c.slug }, { name: "description", label: "Description", type: "textarea", required: false, defaultValue: c.description ?? "" }, { name: "heroMediaId", label: "Hero media", type: "select", required: false, defaultValue: c.heroMediaId ?? "", options: [["", "— none —"], ...media.map((m) => [m.id, m.altText ?? m.storageKey] as [string, string])] }, { name: "status", label: "Status", type: "select", defaultValue: c.status, options: [["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]] }, { name: "publishAt", label: "Publish at", type: "datetime-local", required: false, defaultValue: toLocalInput(c.publishAt) }, { name: "isFeatured", label: "Featured", type: "checkbox", required: false, defaultValue: c.isFeatured ? "on" : "" }, { name: "seoTitle", label: "SEO title", required: false, defaultValue: c.seoTitle ?? "" }, { name: "seoDescription", label: "SEO description", required: false, defaultValue: c.seoDescription ?? "" }]} /></div></Panel>
    <Panel title="Products"><div className="max-w-xl"><ActionForm action={setCollectionProductsAction} submitLabel="Save products" hidden={{ collectionId: id }} fields={[{ name: "productIds", label: "Included products", type: "checkboxes", required: false, options: eligible.map((p) => [p.id, p.name]), defaultValue: sel.map((s) => s.productId).join(",") }]} /></div></Panel></div>);
}
