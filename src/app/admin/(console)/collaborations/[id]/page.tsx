import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { can } from "@/domains/authorization";
import { brands, collaborationProductVariants, collaborationProducts, collaborationRequests, collaborations, productVariants, products } from "@/infrastructure/db/schema";
import { PageHead, Panel, Table, Badge, when, toLocalInput } from "@/components/admin/ui";
import { listMedia } from "@/domains/media";
import { formatMoney } from "@/lib/money";
import { ActionForm } from "@/components/ui/action-form";
import { addCollaborationVariantAction, removeCollaborationVariantAction, saveCollaborationAction, saveCollaborationProductAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function CollaborationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, actor } = await adminCtx();
  const [collab] = await db.select().from(collaborations).where(eq(collaborations.id, id));
  if (!collab || !can(actor, "content.write", collab.brandId)) notFound();
  const [request] = await db.select().from(collaborationRequests).where(eq(collaborationRequests.collaborationId, collab.id));
  if (!request || request.status !== "accepted" || !can(actor, "content.write", request.fromBrandId) || !can(actor, "content.write", request.toBrandId)) {
    return <div><PageHead title={collab.title} sub="This collaboration must have an accepted partner request, and your account must have access to both brands." /><Panel><p className="text-sm text-muted">The product workspace is unavailable until the accepted request and brand permissions are in place.</p></Panel></div>;
  }

  const [brandA, brandB, productsA, productsB, allCollabProducts] = await Promise.all([
    db.select().from(brands).where(eq(brands.id, request.fromBrandId)),
    db.select().from(brands).where(eq(brands.id, request.toBrandId)),
    db.select().from(products).where(eq(products.brandId, request.fromBrandId)),
    db.select().from(products).where(eq(products.brandId, request.toBrandId)),
    db.select().from(collaborationProducts).where(eq(collaborationProducts.collaborationId, collab.id)).orderBy(desc(collaborationProducts.createdAt)),
  ]);
  const media = await listMedia(db, actor);
  const coverOptions: Array<[string, string]> = [["", "— none —"], ...media.filter((m) => m.kind === "image" && (!m.brandId || m.brandId === collab.brandId)).map((m) => [m.id, m.altText ?? m.storageKey] as [string, string])];
  const aName = brandA[0]?.name ?? "Requesting brand";
  const bName = brandB[0]?.name ?? "Partner brand";
  const aOptions: Array<[string, string]> = productsA.filter((p) => p.status !== "archived").map((p) => [p.id, `${p.name} (${p.status})`]);
  const bOptions: Array<[string, string]> = productsB.filter((p) => p.status !== "archived").map((p) => [p.id, `${p.name} (${p.status})`]);
  const productDetails = await Promise.all(allCollabProducts.map(async (cp) => {
    const [a] = await db.select().from(products).where(eq(products.id, cp.brandAProductId));
    const [b] = await db.select().from(products).where(eq(products.id, cp.brandBProductId));
    const variants = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, cp.id));
    const aVariants = a ? await db.select().from(productVariants).where(eq(productVariants.productId, a.id)) : [];
    const bVariants = b ? await db.select().from(productVariants).where(eq(productVariants.productId, b.id)) : [];
    return { cp, a, b, variants, aVariants: aVariants.filter((v) => v.isActive), bVariants: bVariants.filter((v) => v.isActive) };
  }));

  return <div>
    <PageHead title={collab.title} sub={`${aName} × ${bName} · accepted request · ${collab.status}`} />
    <Panel title="Collaboration publication">
      <p className="mb-4 text-sm text-muted">Keep this landing in draft while the product and paired variants are prepared. Publishing is blocked until at least one collaboration product is published.</p>
      <ActionForm action={saveCollaborationAction} submitLabel="Save collaboration" hidden={{ collaborationId: collab.id }} fields={[
        { name: "title", label: "Collaboration title", defaultValue: collab.title },
        { name: "slug", label: "Public URL slug", defaultValue: collab.slug, hint: `Public URL: /collaborations/${collab.slug}` },
        { name: "description", label: "Introduction", type: "textarea", required: false, defaultValue: collab.description ?? "" },
        { name: "coverMediaId", label: "Cover image", type: "select", options: coverOptions, defaultValue: collab.coverMediaId ?? "" },
        { name: "status", label: "Publication status", type: "select", defaultValue: collab.status, options: [["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]] },
        { name: "publishAt", label: "Publish at (optional)", type: "datetime-local", required: false, defaultValue: toLocalInput(collab.publishAt) },
      ]} />
    </Panel>
    <Panel title="Create collaboration product">
      <p className="mb-4 text-sm text-muted">A collaboration product links one catalog item from each brand. Both source products must be published before the collaboration product can be published. Add at least one paired variant before publishing.</p>
      <ActionForm action={saveCollaborationProductAction} submitLabel="Create draft product" fields={[
        { name: "name", label: "Collaboration product name" },
        { name: "price", label: "Displayed collaboration price (NGN)", hint: "Displayed as the collaboration price; customers purchase the two source items from their own product pages." },
        { name: "brandAProductId", label: aName + " product", type: "select", options: aOptions },
        { name: "brandBProductId", label: bName + " product", type: "select", options: bOptions },
        { name: "description", label: "Description", type: "textarea", required: false },
      ]} hidden={{ collaborationId: collab.id, status: "draft" }} />
    </Panel>

    <Panel title="Collaboration products">
      {productDetails.length === 0 ? <p className="text-sm text-muted">No collaboration products yet.</p> : productDetails.map(({ cp, a, b, variants, aVariants, bVariants }) => <div key={cp.id} className="border-b border-line py-6 last:border-b-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{cp.name}</h3><p className="mt-1 text-sm text-muted">{a?.name ?? "Missing source product"} × {b?.name ?? "Missing source product"} · {formatMoney(cp.price, "NGN")}</p><p className="mt-1 text-xs text-muted">{cp.description}</p></div><Badge tone={cp.status === "published" ? "ok" : cp.status === "draft" ? "warn" : ""}>{cp.status}</Badge></div>
        <div className="mt-4 max-w-3xl"><ActionForm action={saveCollaborationProductAction} submitLabel="Save product" hidden={{ id: cp.id, collaborationId: collab.id }} fields={[
          { name: "name", label: "Product name", defaultValue: cp.name },
          { name: "price", label: "Displayed price (NGN)", defaultValue: (cp.price / 100).toFixed(2) },
          { name: "brandAProductId", label: aName + " product", type: "select", defaultValue: cp.brandAProductId, options: aOptions },
          { name: "brandBProductId", label: bName + " product", type: "select", defaultValue: cp.brandBProductId, options: bOptions },
          { name: "description", label: "Description", type: "textarea", required: false, defaultValue: cp.description ?? "" },
          { name: "status", label: "Publication", type: "select", defaultValue: cp.status, options: [["draft", "Draft"], ["published", "Publish"], ["archived", "Archive"]] },
        ]} /></div>
        <h4 className="mt-6 text-sm font-medium">Paired variants ({variants.length})</h4>
        {variants.length ? <Table head={[aName + " variant", bName + " variant", "Added", "Action"]} rows={variants.map((v) => [`${v.brandAColor ?? "—"} ${v.brandASize ?? ""}`, `${v.brandBColor ?? "—"} ${v.brandBSize ?? ""}`, when(v.createdAt), cp.status !== "published" ? <div key={v.id} className="max-w-xs"><ActionForm action={removeCollaborationVariantAction} submitLabel="Remove paired variant" hidden={{ variantId: v.id }} fields={[]} /></div> : "—"])} /> : <p className="mt-2 text-sm text-muted">Add at least one paired variant before publishing.</p>}
        {cp.status !== "published" && aVariants.length && bVariants.length ? <div className="mt-4 max-w-3xl"><ActionForm action={addCollaborationVariantAction} submitLabel="Add paired variant" hidden={{ collaborationProductId: cp.id }} fields={[
          { name: "brandAVariantId", label: aName + " variant", type: "select", options: aVariants.map((v) => [v.id, `${v.sku} · ${v.colorName ?? ""} ${v.size ?? ""}`]) },
          { name: "brandBVariantId", label: bName + " variant", type: "select", options: bVariants.map((v) => [v.id, `${v.sku} · ${v.colorName ?? ""} ${v.size ?? ""}`]) },
        ]} /></div> : null}
        <p className="mt-3 text-xs text-muted">Publication is available only after both source products are published and at least one paired variant is configured. The public page links customers to each source product so stock, payment and fulfilment continue through the existing secure checkout.</p>
      </div>)}
    </Panel>
  </div>;
}
