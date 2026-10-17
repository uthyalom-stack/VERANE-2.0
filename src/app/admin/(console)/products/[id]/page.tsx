import { eq } from "drizzle-orm";
import { adminCtx, dollars } from "@/lib/admin";
import { getProductForAdmin } from "@/domains/catalog/admin";
import { brands, categories, inventoryLevels, mediaAssets, productCategories, productMedia } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { PageHead, Panel, Table, Badge, statusTone } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { archiveProductAction, attachMediaAction, detachMediaAction, moveMediaAction, removeVariantAction, saveVariantAction, setProductStatusAction } from "@/app/actions/admin";
import { Media } from "@/components/ui/media";
import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const data = await getProductForAdmin(db, actor, id).catch((e) => { if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null; throw e; });
  if (!data) notFound(); // cross-brand access renders as 404, never leaking existence
  const { product: p, variants } = data;
  const [bs, cats, sel, pm, lib, levels] = await Promise.all([db.select().from(brands), db.select().from(categories), db.select().from(productCategories).where(eq(productCategories.productId, id)),
    db.select({ pm: productMedia, m: mediaAssets }).from(productMedia).innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.mediaId)).where(eq(productMedia.productId, id)).orderBy(productMedia.sortOrder), listMedia(db, actor), db.select().from(inventoryLevels)]);
  const stock = new Map(levels.map((l) => [l.variantId, l.onHand - l.reserved])); const ids = pm.map((x) => x.pm.id);
  const writable = can(actor, "catalog.product.write", p.brandId);
  return (<div><PageHead title={p.name} sub={`Brand: ${bs.find((b) => b.id === p.brandId)?.name}`} action={<Badge tone={statusTone(p.status)}>{p.status}</Badge>} />
    {writable && <div className="mb-8 flex flex-wrap gap-3"><form action={setProductStatusAction.bind(null, id, p.status === "published" ? "draft" : "published")}><Button variant="outline">{p.status === "published" ? "Unpublish" : "Publish"}</Button></form><form action={archiveProductAction.bind(null, id)}><Button variant="outline">Archive</Button></form></div>}
    <Panel title="Details"><div className="max-w-2xl"><ProductForm brands={bs.filter((b) => can(actor, "catalog.product.write", b.id))} categories={cats} selectedCategoryIds={sel.map((s) => s.categoryId)} mediaOptions={lib.filter((m) => m.kind === "image" && (!m.brandId || m.brandId === p.brandId)).map((m) => [m.id, `${m.altText ?? m.storageKey}`] as [string, string])} product={p} /></div></Panel>
    <Panel title="Variants"><Table head={["SKU", "Size", "Colour", "Price override", "Available", "Active", ""]} rows={variants.map((v) => [v.sku, v.size, v.colorName, v.priceOverride ? dollars(v.priceOverride) : "—", stock.get(v.id) ?? 0, v.isActive ? "Yes" : "No", writable ? <form key="r" action={removeVariantAction.bind(null, id, v.id)}><button className="text-sm underline">Remove</button></form> : null])} empty="No variants yet — add one below." />
      {writable && <div className="mt-6 max-w-md"><h3 className="mb-3 text-sm text-muted">Add variant</h3><ActionForm action={saveVariantAction} submitLabel="Add variant" hidden={{ productId: id }} fields={[{ name: "sku", label: "SKU" }, { name: "size", label: "Size", required: false }, { name: "colorName", label: "Colour name", required: false }, { name: "colorHex", label: "Colour hex (#RRGGBB)", required: false }, { name: "priceOverride", label: "Price override (₦)", type: "number", step: "0.01", required: false }, { name: "initialStock", label: "Opening stock", type: "number", required: false, defaultValue: "0" }]} /></div>}</Panel>
    <Panel title="Media"><ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{pm.map(({ pm: x, m }, i) => <li key={x.id} className="text-xs"><div className="aspect-[4/5] overflow-hidden rounded bg-surface">{m.kind === "image" ? <Media storageKey={m.storageKey} alt={m.altText ?? ""} /> : <div className="grid h-full place-items-center">{m.kind}</div>}</div><p className="mt-1">{x.role}</p>
      {writable && <div className="mt-1 flex gap-2"><form action={moveMediaAction.bind(null, id, ids.map((v, n) => (n === i - 1 ? ids[i]! : n === i ? ids[i - 1]! : v)))}><button disabled={i === 0} className="underline disabled:opacity-30">Earlier</button></form><form action={detachMediaAction.bind(null, id, x.id)}><button className="underline">Remove</button></form></div>}</li>)}</ul>
      {pm.length === 0 && <p className="text-sm text-muted">No media. Product pages show a clearly-marked placeholder until real photography is attached.</p>}
      {writable && <div className="mt-6 max-w-md"><ActionForm action={attachMediaAction} submitLabel="Attach media" hidden={{ productId: id }} fields={[{ name: "mediaId", label: "Library item", type: "select", options: lib.filter((m) => !m.brandId || m.brandId === p.brandId).map((m) => [m.id, `${m.kind}: ${m.altText ?? m.storageKey}`]) }, { name: "role", label: "Role", type: "select", options: [["primary", "Primary"], ["secondary", "Secondary"], ["model", "Model"], ["lifestyle", "Lifestyle"], ["detail", "Detail"], ["video", "Video"], ["model3d", "3D model"]] }]} /></div>}</Panel></div>);
}
