import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { can, scopedBrandIds } from "@/domains/authorization";
import { brands, backInStockSubscriptions, collaborationRequests, pickupLocations, products, trackingCampaigns, trackingCampaignVisits } from "@/infrastructure/db/schema";
import { PageHead, Panel, Table, Badge, when } from "@/components/admin/ui";
import { ActionForm } from "@/components/ui/action-form";
import { cancelBackInStockSubscriptionAction, createCollaborationRequestAction, reviewCollaborationRequestAction, savePickupLocationAction, saveTrackingLinkAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function OperationsAdminPage() {
  const { db, actor } = await adminCtx();
  const [allBrands, campaignVisits] = await Promise.all([
    db.select().from(brands).where(eq(brands.isActive, true)),
    db.select({ campaignId: trackingCampaignVisits.campaignId, visits: sql<number>\`count(*)\` }).from(trackingCampaignVisits).groupBy(trackingCampaignVisits.campaignId),
  ]);
  const contentScope = scopedBrandIds(actor, "content.write");
  const orderScope = scopedBrandIds(actor, "orders.manage");
  const inventoryScope = scopedBrandIds(actor, "inventory.read");
  const visibleBrands = contentScope === "all" ? allBrands : allBrands.filter((b) => contentScope.includes(b.id));
  const pickupBrands = orderScope === "all" ? allBrands : allBrands.filter((b) => orderScope.includes(b.id));
  const brandNames = new Map(allBrands.map((b) => [b.id, b.name]));
  const trackingQuery = db.select().from(trackingCampaigns).orderBy(desc(trackingCampaigns.createdAt));
  const tracking = contentScope === "all" ? await trackingQuery : contentScope.length ? await trackingQuery.where(inArray(trackingCampaigns.brandId, contentScope)) : [];
  const pickups = orderScope === "all"
    ? await db.select().from(pickupLocations).orderBy(desc(pickupLocations.createdAt))
    : orderScope.length ? await db.select().from(pickupLocations).where(inArray(pickupLocations.brandId, orderScope)).orderBy(desc(pickupLocations.createdAt)) : [];
  const requests = contentScope === "all"
    ? await db.select().from(collaborationRequests).orderBy(desc(collaborationRequests.createdAt))
    : contentScope.length ? await db.select().from(collaborationRequests).where(or(inArray(collaborationRequests.fromBrandId, contentScope), inArray(collaborationRequests.toBrandId, contentScope))).orderBy(desc(collaborationRequests.createdAt)) : [];
  const subscriptions = inventoryScope === "all"
    ? await db.select({ s: backInStockSubscriptions, productName: products.name, brandId: products.brandId }).from(backInStockSubscriptions).innerJoin(products, eq(products.id, backInStockSubscriptions.productId)).orderBy(desc(backInStockSubscriptions.createdAt)).limit(100)
    : inventoryScope.length ? await db.select({ s: backInStockSubscriptions, productName: products.name, brandId: products.brandId }).from(backInStockSubscriptions).innerJoin(products, eq(products.id, backInStockSubscriptions.productId)).where(inArray(products.brandId, inventoryScope)).orderBy(desc(backInStockSubscriptions.createdAt)).limit(100) : [];
  const visits = new Map(campaignVisits.map((v) => [v.campaignId, v.visits]));
  const contentBrandOptions: Array<[string, string]> = [...(can(actor, "content.write", null) ? [["", "House-wide"]] as Array<[string, string]> : []), ...visibleBrands.map((b) => [b.id, b.name] as [string, string])];
  const pickupBrandOptions: Array<[string, string]> = pickupBrands.map((b) => [b.id, b.name]);

  return <div>
    <PageHead title="Operations" sub="V1 parity workflows, rebuilt with brand-scoped permissions and an auditable V2 foundation." />
    <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[var(--r-md)] border border-line p-4"><p className="text-xs text-muted">Tracking links</p><p className="display mt-2 text-3xl">{tracking.length}</p></div>
      <div className="rounded-[var(--r-md)] border border-line p-4"><p className="text-xs text-muted">Collaboration requests</p><p className="display mt-2 text-3xl">{requests.filter((r) => r.status === "pending").length}</p></div>
      <div className="rounded-[var(--r-md)] border border-line p-4"><p className="text-xs text-muted">Pickup locations</p><p className="display mt-2 text-3xl">{pickups.filter((p) => p.isActive).length}</p></div>
      <div className="rounded-[var(--r-md)] border border-line p-4"><p className="text-xs text-muted">Active waitlist entries</p><p className="display mt-2 text-3xl">{subscriptions.filter((s) => s.s.status === "active").length}</p></div>
    </div>

    {can(actor, "content.write", null) || visibleBrands.length > 0 ? <Panel title="Social tracking links">
      <p className="mb-4 text-sm text-muted">Use <code>/go/slug</code> in social posts. Visits are recorded against the campaign; destinations are restricted to on-site paths.</p>
      <Table head={["Campaign", "Brand", "Link", "Visits", "Status", "Created"]} rows={tracking.map((c) => [c.name, c.brandId ? brandNames.get(c.brandId) ?? "Unknown" : "House-wide", <code key="url">/go/{c.slug}</code>, visits.get(c.id) ?? 0, <Badge key="status" tone={c.isActive ? "ok" : "warn"}>{c.isActive ? "Active" : "Paused"}</Badge>, when(c.createdAt)])} empty="No tracking links created yet." />
      {tracking.map((c) => <div key={c.id} className="mt-6 border-t border-line pt-5"><h3 className="mb-3 text-sm font-medium">Edit {c.name}</h3><div className="max-w-2xl"><ActionForm action={saveTrackingLinkAction} submitLabel="Save tracking link" hidden={{ id: c.id }} fields={[
        { name: "name", label: "Campaign name", defaultValue: c.name },
        { name: "slug", label: "Short slug", defaultValue: c.slug, hint: "Public link: /go/this-slug" },
        { name: "brandId", label: "Brand", type: "select", defaultValue: c.brandId ?? "", options: contentBrandOptions },
        { name: "platform", label: "Platform", defaultValue: c.platform, required: false },
        { name: "source", label: "Source", defaultValue: c.source ?? "", required: false },
        { name: "medium", label: "Medium", defaultValue: c.medium ?? "", required: false },
        { name: "destination", label: "On-site destination", defaultValue: c.destination, hint: "Example: /shop?brand=uthy" },
        { name: "isActive", label: "Link is active", type: "checkbox", defaultValue: c.isActive ? "on" : "" },
      ]} /></div></div>)}
      <div className="mt-6 border-t border-line pt-5"><h3 className="mb-3 text-sm font-medium">Create tracking link</h3><div className="max-w-2xl"><ActionForm action={saveTrackingLinkAction} submitLabel="Create link" fields={[
        { name: "name", label: "Campaign name" }, { name: "slug", label: "Short slug", hint: "Lowercase letters, numbers and hyphens" },
        { name: "brandId", label: "Brand", type: "select", options: contentBrandOptions }, { name: "platform", label: "Platform", defaultValue: "Instagram", required: false },
        { name: "source", label: "Source", defaultValue: "social", required: false }, { name: "medium", label: "Medium", defaultValue: "social", required: false },
        { name: "destination", label: "On-site destination", defaultValue: "/shop" }, { name: "isActive", label: "Link is active", type: "checkbox", defaultValue: "on" },
      ]} /></div></div>
    </Panel> : null}

    {visibleBrands.length > 0 ? <Panel title="Brand collaborations">
      <Table head={["Request", "From", "To", "Status", "Submitted"]} rows={requests.map((r) => [r.title, brandNames.get(r.fromBrandId) ?? r.fromBrandId, brandNames.get(r.toBrandId) ?? r.toBrandId, <Badge key="status" tone={r.status === "accepted" ? "ok" : r.status === "pending" ? "warn" : ""}>{r.status}</Badge>, when(r.createdAt)])} empty="No collaboration requests." />
      {requests.filter((r) => r.status === "pending" && can(actor, "content.write", r.toBrandId)).map((r) => <div key={r.id} className="mt-4 rounded-[var(--r-md)] border border-line p-4"><p className="font-medium">{r.title}</p><p className="mt-1 text-sm text-muted">{brandNames.get(r.fromBrandId)} → {brandNames.get(r.toBrandId)}</p>{r.message && <p className="mt-3 text-sm">{r.message}</p>}<div className="mt-4 max-w-sm"><ActionForm action={reviewCollaborationRequestAction} submitLabel="Review request" hidden={{ requestId: r.id }} fields={[{ name: "status", label: "Decision", type: "select", options: [["accepted", "Accept and create draft collaboration"], ["rejected", "Reject request"]] }]} /></div></div>)}
      <div className="mt-6 border-t border-line pt-5"><h3 className="mb-3 text-sm font-medium">Request a collaboration</h3><div className="max-w-2xl"><ActionForm action={createCollaborationRequestAction} submitLabel="Send request" fields={[
        { name: "fromBrandId", label: "Requesting brand", type: "select", options: visibleBrands.map((b) => [b.id, b.name] as [string, string]) },
        { name: "toBrandId", label: "Partner brand", type: "select", options: allBrands.map((b) => [b.id, b.name] as [string, string]) },
        { name: "title", label: "Collaboration title" }, { name: "message", label: "Proposal / notes", type: "textarea", required: false },
      ]} /></div></div>
    </Panel> : null}

    {pickupBrands.length > 0 ? <Panel title="Customer pickup locations">
      <p className="mb-4 text-sm text-muted">These are per-brand pickup locations. Creating a location does not automatically expose pickup at checkout; the checkout selection and fulfilment workflow must also be enabled.</p>
      <Table head={["Location", "Brand", "Address", "Status"]} rows={pickups.map((p) => [p.name, brandNames.get(p.brandId) ?? p.brandId, [p.addressLine1, p.city, p.state].join(", "), <Badge key="status" tone={p.isActive ? "ok" : "warn"}>{p.isActive ? "Active" : "Disabled"}</Badge>])} empty="No pickup locations configured." />
      {pickups.map((p) => <div key={p.id} className="mt-6 border-t border-line pt-5"><h3 className="mb-3 text-sm font-medium">Edit {p.name}</h3><div className="max-w-2xl"><ActionForm action={savePickupLocationAction} submitLabel="Save pickup location" hidden={{ id: p.id }} fields={[
        { name: "brandId", label: "Brand", type: "select", defaultValue: p.brandId, options: pickupBrandOptions }, { name: "name", label: "Location name", defaultValue: p.name },
        { name: "addressLine1", label: "Address", defaultValue: p.addressLine1 }, { name: "addressLine2", label: "Address line 2", defaultValue: p.addressLine2 ?? "", required: false },
        { name: "city", label: "City", defaultValue: p.city }, { name: "state", label: "State", defaultValue: p.state },
        { name: "postalCode", label: "Postal code", defaultValue: p.postalCode ?? "", required: false }, { name: "instructions", label: "Pickup instructions", type: "textarea", defaultValue: p.instructions ?? "", required: false },
        { name: "isActive", label: "Location is active", type: "checkbox", defaultValue: p.isActive ? "on" : "" },
      ]} /></div></div>)}
      <div className="mt-6 border-t border-line pt-5"><h3 className="mb-3 text-sm font-medium">Add pickup location</h3><div className="max-w-2xl"><ActionForm action={savePickupLocationAction} submitLabel="Add location" fields={[
        { name: "brandId", label: "Brand", type: "select", options: pickupBrandOptions }, { name: "name", label: "Location name" },
        { name: "addressLine1", label: "Address" }, { name: "addressLine2", label: "Address line 2", required: false },
        { name: "city", label: "City" }, { name: "state", label: "State" }, { name: "postalCode", label: "Postal code", required: false },
        { name: "instructions", label: "Pickup instructions", type: "textarea", required: false }, { name: "isActive", label: "Location is active", type: "checkbox", defaultValue: "on" },
      ]} /></div></div>
    </Panel> : null}

    {inventoryScope === "all" || inventoryScope.length > 0 ? <Panel title="Back-in-stock waitlist">
      <p className="mb-4 text-sm text-muted">This queue lets brand admins review and cancel entries. Automatic restock email delivery is a separate worker workflow and is not represented as live until it is connected.</p>
      <Table head={["Product", "Brand", "Email", "Status", "Joined", "Action"]} rows={subscriptions.map(({ s, productName, brandId }) => [productName, brandNames.get(brandId) ?? brandId, s.email, <Badge key="status" tone={s.status === "active" ? "warn" : s.status === "notified" ? "ok" : ""}>{s.status}</Badge>, when(s.createdAt), s.status === "active" ? <div key="action" className="max-w-xs"><ActionForm action={cancelBackInStockSubscriptionAction} submitLabel="Cancel entry" hidden={{ subscriptionId: s.id }} fields={[]} /></div> : "—"])} empty="No waitlist entries yet." />
    </Panel> : null}
  </div>;
}
