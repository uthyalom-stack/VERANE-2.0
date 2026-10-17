"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { parseMajorToMinor } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/lib/http/session";
import { run, fd, type ActionState } from "@/lib/http/action";
import { archiveProduct, createProduct, restoreProduct, updateProduct } from "@/domains/catalog/admin";
import { adjustStock } from "@/domains/inventory";
import { queueBackInStockNotifications } from "@/domains/inventory/back-in-stock";
import { attachProductMedia, detachProductMedia, removeVariant, reorderProductMedia, saveCategory, saveCollection, setCollectionProducts, setProductStatus, upsertVariant } from "@/domains/admin/catalog";
import { saveDiscount } from "@/domains/admin/discounts";
import { saveArticle, saveCampaign, saveLook, savePageBlocks, setLookItems } from "@/domains/admin/content";
import { createAdminUser, grantRole, revokeGrant } from "@/domains/admin/ops";
import { createShipmentForBrand, createShipmentForOrder, adminSetOrderStatus, setOrderStatus } from "@/domains/orders/fulfilment";
import { getShippingProvider } from "@/infrastructure/shipping";
import { updateAlt } from "@/domains/media";
import { backInStockSubscriptions, brands, collaborationProductVariants, collaborationProducts, collaborationRequests, collaborations, mediaAssets, orderBrandFulfilments, orders, pages, pickupLocations, productVariants, products, trackingCampaigns } from "@/infrastructure/db/schema";
import { writeAudit } from "@/domains/audit";
import { assertCan } from "@/domains/authorization";
import { isPubliclyVisibleProduct, publiclyVisible } from "@/domains/catalog/public";

const money = (v: string | undefined) => (v && v.trim() ? parseMajorToMinor(v.replace(/,/g, "")) : null);
const dateOrNull = (v: string | undefined) => (v && v.trim() ? v : null);
const nul = (v: string | undefined) => (v && v.trim() ? v : null);
const ctx = () => requireAdmin();

function productPayload(f: FormData) {
  const r = fd(f);
  return { brandId: r.brandId, name: r.name, slug: nul(r.slug) ?? undefined, subtitle: nul(r.subtitle), description: nul(r.description), materials: nul(r.materials), fit: nul(r.fit), sizingInfo: nul(r.sizingInfo), sizeGuideMediaId: nul(r.sizeGuideMediaId), customSizingEnabled: r.customSizingEnabled === "on", preOrderEnabled: r.preOrderEnabled === "on", fulfillmentTime: nul(r.fulfillmentTime), careInstructions: nul(r.careInstructions), deliveryInfo: nul(r.deliveryInfo),
    productType: nul(r.productType), style: nul(r.style), occasion: nul(r.occasion), currency: "NGN", basePrice: money(r.basePrice) ?? NaN, compareAtPrice: money(r.compareAtPrice), status: r.status || "draft", publishAt: dateOrNull(r.publishAt), isFeatured: r.isFeatured === "on", seoTitle: nul(r.seoTitle), seoDescription: nul(r.seoDescription), categoryIds: f.getAll("categoryIds").map(String) };
}
export async function saveProductAction(_: ActionState, f: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const res = await run(async () => {
    const { actor } = await ctx(); const id = fd(f).id; const p = productPayload(f);
    if (id) { await updateProduct(getDb(), actor, id, p); revalidatePath(`/admin/products/${id}`); return { ok: true, message: "Product saved" }; }
    const r = await createProduct(getDb(), actor, p); dest = `/admin/products/${r.id}`;
  });
  if (dest) redirect(dest);
  return res;
}
export async function archiveProductAction(id: string): Promise<void> { await run(async () => { await archiveProduct(getDb(), (await ctx()).actor, id); revalidatePath("/admin/products"); }); redirect("/admin/products"); }
export async function restoreArchivedProductAction(id: string): Promise<void> { await run(async () => { await restoreProduct(getDb(), (await ctx()).actor, id); revalidatePath("/admin/products"); revalidatePath("/admin/products/history"); }); redirect("/admin/products/history"); }
export async function setProductStatusAction(id: string, status: "draft" | "published"): Promise<void> { await run(async () => { await setProductStatus(getDb(), (await ctx()).actor, id, status); revalidatePath(`/admin/products/${id}`); }); }

export async function saveVariantAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx();
    await upsertVariant(getDb(), actor, r.productId!, { id: nul(r.id) ?? undefined, sku: r.sku, size: nul(r.size), colorName: nul(r.colorName), colorHex: nul(r.colorHex), priceOverride: money(r.priceOverride), isActive: r.isActive !== "off", sortOrder: Number(r.sortOrder || 0), initialStock: r.initialStock ? Number(r.initialStock) : undefined });
    revalidatePath(`/admin/products/${r.productId}`); return { ok: true, message: "Variant saved" };
  });
}
export async function removeVariantAction(productId: string, variantId: string): Promise<void> { await run(async () => { await removeVariant(getDb(), (await ctx()).actor, productId, variantId); revalidatePath(`/admin/products/${productId}`); }); }
export async function attachMediaAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => { const r = fd(f); await attachProductMedia(getDb(), (await ctx()).actor, r.productId!, { mediaId: r.mediaId!, role: (r.role || "secondary") as never }); revalidatePath(`/admin/products/${r.productId}`); return { ok: true, message: "Media attached" }; });
}
export async function detachMediaAction(productId: string, pmId: string): Promise<void> { await run(async () => { await detachProductMedia(getDb(), (await ctx()).actor, productId, pmId); revalidatePath(`/admin/products/${productId}`); }); }
export async function moveMediaAction(productId: string, ids: string[]): Promise<void> { await run(async () => { await reorderProductMedia(getDb(), (await ctx()).actor, productId, ids); revalidatePath(`/admin/products/${productId}`); }); }

export async function adjustStockAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const delta = Number(r.delta);
    if (r.confirm !== "on" && Math.abs(delta) >= 20) throw new AppError("VALIDATION", "Large adjustments need the confirmation box ticked");
    const db = getDb();
    await adjustStock(db, (await ctx()).actor, { variantId: r.variantId!, delta, type: (r.type || "adjust") as never, reason: r.reason ?? "" });
    await queueBackInStockNotifications(db, r.variantId!);
    revalidatePath("/admin/inventory"); revalidatePath("/admin/operations"); return { ok: true, message: "Stock updated" };
  });
}

export async function saveCategoryAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await saveCategory(getDb(), (await ctx()).actor, r, nul(r.id) ?? undefined); revalidatePath("/admin/categories"); return { ok: true, message: "Category saved" }; }); }
export async function saveCollectionAction(_: ActionState, f: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const res = await run(async () => {
    const r = fd(f); const id = nul(r.id) ?? undefined;
    const saved = await saveCollection(getDb(), (await ctx()).actor, { brandId: nul(r.brandId), title: r.title, slug: nul(r.slug) ?? undefined, description: nul(r.description), heroMediaId: nul(r.heroMediaId), isFeatured: r.isFeatured === "on", status: r.status || "draft", publishAt: dateOrNull(r.publishAt), seoTitle: nul(r.seoTitle), seoDescription: nul(r.seoDescription) }, id);
    if (!id) dest = `/admin/collections/${saved}`; else return { ok: true, message: "Collection saved" };
  });
  if (dest) redirect(dest); return res;
}
export async function setCollectionProductsAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await setCollectionProducts(getDb(), (await ctx()).actor, r.collectionId!, f.getAll("productIds").map(String)); revalidatePath(`/admin/collections/${r.collectionId}`); return { ok: true, message: "Products updated" }; }); }

export async function saveDiscountAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const kind = r.kind as "percent" | "fixed";
    await saveDiscount(getDb(), (await ctx()).actor, { code: r.code, brandId: nul(r.brandId), kind, value: kind === "percent" ? Number(r.value) : money(r.value), minSubtotal: money(r.minSubtotal), maxRedemptions: r.maxRedemptions ? Number(r.maxRedemptions) : null, startsAt: dateOrNull(r.startsAt), endsAt: dateOrNull(r.endsAt), isActive: r.isActive === "on" }, nul(r.id) ?? undefined);
    revalidatePath("/admin/discounts"); return { ok: true, message: "Discount saved" };
  });
}

export async function saveLookAction(_: ActionState, f: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const res = await run(async () => {
    const r = fd(f); const id = nul(r.id) ?? undefined;
    const saved = await saveLook(getDb(), (await ctx()).actor, { brandId: r.brandId, title: r.title, slug: nul(r.slug) ?? undefined, description: nul(r.description), stylingNotes: nul(r.stylingNotes), imageMediaId: nul(r.imageMediaId), status: r.status || "draft", publishAt: dateOrNull(r.publishAt), sortOrder: Number(r.sortOrder || 0), seoTitle: nul(r.seoTitle), seoDescription: nul(r.seoDescription) }, id);
    if (!id) dest = `/admin/looks/${saved}`; else return { ok: true, message: "Look saved" };
  });
  if (dest) redirect(dest); return res;
}
export async function setLookItemsAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => { const r = fd(f); const ids = f.getAll("productIds").map(String); await setLookItems(getDb(), (await ctx()).actor, r.lookId!, ids.map((productId) => ({ productId, stylingNote: nul(r[`note_${productId}`]) }))); revalidatePath(`/admin/looks/${r.lookId}`); return { ok: true, message: "Look items saved" }; });
}
export async function saveCampaignAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => { const r = fd(f); await saveCampaign(getDb(), (await ctx()).actor, { brandId: nul(r.brandId), title: r.title, slug: nul(r.slug) ?? undefined, subtitle: nul(r.subtitle), heroMediaId: nul(r.heroMediaId), heroMobileMediaId: nul(r.heroMobileMediaId), posterMediaId: nul(r.posterMediaId), ctaLabel: nul(r.ctaLabel), ctaHref: nul(r.ctaHref), status: r.status || "draft", startsAt: dateOrNull(r.startsAt), endsAt: dateOrNull(r.endsAt), seoTitle: nul(r.seoTitle), seoDescription: nul(r.seoDescription) }, nul(r.id) ?? undefined); revalidatePath("/admin/campaigns"); return { ok: true, message: "Campaign saved" }; });
}
/** Journal + page editors send their block list as JSON from the client block editor; the server re-validates every block. */
export async function saveArticleAction(_: ActionState, f: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const res = await run(async () => {
    const r = fd(f); const id = nul(r.id) ?? undefined; let body: unknown = []; try { body = JSON.parse(r.body || "[]"); } catch { throw new AppError("VALIDATION", "Body blocks are malformed"); }
    const saved = await saveArticle(getDb(), (await ctx()).actor, { brandId: nul(r.brandId), title: r.title, slug: nul(r.slug) ?? undefined, kind: r.kind, excerpt: nul(r.excerpt), coverMediaId: nul(r.coverMediaId), videoMediaId: nul(r.videoMediaId), authorName: nul(r.authorName), status: r.status || "draft", publishAt: dateOrNull(r.publishAt), seoTitle: nul(r.seoTitle), seoDescription: nul(r.seoDescription), body }, id);
    if (!id) dest = `/admin/journal/${saved}`; else return { ok: true, message: "Article saved" };
  });
  if (dest) redirect(dest); return res;
}
export async function savePageAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); let blocks: Array<{ type: string; data: unknown }> = [];
    try { blocks = JSON.parse(r.blocks || "[]"); } catch { throw new AppError("VALIDATION", "Blocks are malformed"); }
    const db = getDb(); const actor = (await ctx()).actor;
    const [page] = await db.select().from(pages).where(eq(pages.id, r.pageId!));
    await savePageBlocks(db, actor, r.pageId!, { status: r.status === "published" ? "published" : "draft", blocks });
    if (page?.kind === "brand_landing" && page.brandId) {
      const [brand] = await db.select().from(brands).where(eq(brands.id, page.brandId));
      if (brand) revalidatePath(`/brands/${brand.slug}`);
      revalidatePath(`/admin/brands/${page.brandId}/storefront`);
    } else revalidatePath("/");
    revalidatePath("/admin/pages");
    return { ok: true, message: r.status === "published" ? "Published" : "Draft saved" };
  });
}

export async function updateOrderStatusAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await adminSetOrderStatus(getDb(), (await ctx()).actor, r.orderId!, r.status!, r.note ?? ""); revalidatePath(`/admin/orders/${r.orderId}`); return { ok: true, message: "Status updated" }; }); }
export async function createShipmentAction(orderId: string): Promise<void> { await run(async () => { await createShipmentForOrder(getDb(), getShippingProvider(), (await ctx()).actor, orderId); revalidatePath(`/admin/orders/${orderId}`); }); }

export async function createBrandShipmentAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const orderId = r.orderId; const brandId = r.brandId;
    if (!orderId || !brandId) throw new AppError("VALIDATION", "Order and brand are required");
    await createShipmentForBrand(getDb(), getShippingProvider(), (await ctx()).actor, orderId, brandId);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Brand shipment created" };
  });
}

export async function updateAltAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await updateAlt(getDb(), (await ctx()).actor, r.id!, r.altText ?? ""); revalidatePath("/admin/media"); return { ok: true, message: "Saved" }; }); }
export async function updateBrandAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await ctx(); const r = fd(f); assertCan(actor, "brands.write", null);
    await getDb().update(brands).set({ name: r.name!, tagline: nul(r.tagline), description: nul(r.description), isActive: r.isActive === "on" }).where(eq(brands.id, r.id!));
    await writeAudit(getDb(), { actorUserId: actor.userId, action: "brand.update", entityType: "brand", entityId: r.id!, after: r }); revalidatePath("/admin/brands"); return { ok: true, message: "Brand saved" };
  });
}
export async function createAdminUserAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); const out = await createAdminUser(getDb(), (await ctx()).actor, { email: r.email!, name: r.name! }); revalidatePath("/admin/users"); return { ok: true, message: `Created. Temporary password (shown once): ${out.tempPassword}` }; }); }
export async function grantRoleAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await grantRole(getDb(), (await ctx()).actor, r.userId!, r.role!, nul(r.brandId)); revalidatePath("/admin/users"); return { ok: true, message: "Role granted" }; }); }
export async function revokeGrantAction(grantId: string): Promise<void> { await run(async () => { await revokeGrant(getDb(), (await ctx()).actor, grantId); revalidatePath("/admin/users"); }); }


/** Create or update a social tracking link. Destinations must stay on-site to prevent open redirects. */
export async function saveTrackingLinkAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const brandId = nul(r.brandId);
    assertCan(actor, "content.write", brandId);
    const name = (r.name ?? "").trim(); const slug = (r.slug ?? "").trim().toLowerCase();
    const destination = (r.destination ?? "/").trim();
    if (name.length < 2 || name.length > 120) throw new AppError("VALIDATION", "Campaign name must be 2–120 characters");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new AppError("VALIDATION", "Use a URL-safe slug with letters, numbers and hyphens");
    if (!destination.startsWith("/") || destination.startsWith("//") || destination.includes(String.fromCharCode(92)) || destination.includes("\n") || destination.includes("\r")) throw new AppError("VALIDATION", "Destination must be a safe on-site path beginning with /");
    const patch = { brandId, name, slug, platform: (r.platform || "Other").slice(0, 40), source: nul(r.source), medium: nul(r.medium), destination, isActive: r.isActive === "on", updatedAt: new Date() };
    const id = nul(r.id);
    if (id) {
      const [old] = await db.select().from(trackingCampaigns).where(eq(trackingCampaigns.id, id));
      if (!old) throw new AppError("NOT_FOUND", "Tracking link not found");
      assertCan(actor, "content.write", old.brandId);
      await db.update(trackingCampaigns).set(patch).where(eq(trackingCampaigns.id, id));
    } else {
      await db.insert(trackingCampaigns).values({ id: crypto.randomUUID(), ...patch });
    }
    revalidatePath("/admin/operations");
    return { ok: true, message: id ? "Tracking link updated" : "Tracking link created" };
  });
}

export async function createCollaborationRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const fromBrandId = r.fromBrandId; const toBrandId = r.toBrandId;
    if (!fromBrandId || !toBrandId || fromBrandId === toBrandId) throw new AppError("VALIDATION", "Choose two different brands");
    assertCan(actor, "content.write", fromBrandId);
    const [from] = await db.select().from(brands).where(eq(brands.id, fromBrandId));
    const [to] = await db.select().from(brands).where(eq(brands.id, toBrandId));
    if (!from?.isActive || !to?.isActive) throw new AppError("VALIDATION", "Both brands must be active");
    const title = (r.title ?? "").trim(); const message = (r.message ?? "").trim();
    if (title.length < 3 || title.length > 120) throw new AppError("VALIDATION", "Title must be 3–120 characters");
    await db.insert(collaborationRequests).values({ id: crypto.randomUUID(), fromBrandId, toBrandId, title, message: message || null, status: "pending" });
    revalidatePath("/admin/operations");
    return { ok: true, message: "Collaboration request sent for review" };
  });
}

export async function reviewCollaborationRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const [request] = await db.select().from(collaborationRequests).where(eq(collaborationRequests.id, r.requestId!));
    if (!request) throw new AppError("NOT_FOUND", "Collaboration request not found");
    assertCan(actor, "content.write", request.toBrandId);
    if (request.status !== "pending") throw new AppError("CONFLICT", "This request has already been reviewed");
    const status = r.status;
    if (status !== "accepted" && status !== "rejected") throw new AppError("VALIDATION", "Choose accept or reject");
    let collaborationId: string | null = null;
    await db.transaction(async (tx) => {
      if (status === "accepted") {
        const [from] = await tx.select().from(brands).where(eq(brands.id, request.fromBrandId));
        const newCollaborationId = crypto.randomUUID();
        collaborationId = newCollaborationId;
        await tx.insert(collaborations).values({
          id: newCollaborationId, brandId: request.toBrandId, slug: "collaboration-" + request.id,
          partnerName: from?.name ?? "VÉRANE partner", title: request.title, status: "draft",
        });
      }
      await tx.update(collaborationRequests).set({ status, reviewedBy: actor.userId, reviewedAt: new Date(), collaborationId, updatedAt: new Date() }).where(eq(collaborationRequests.id, request.id));
    });
    await writeAudit(db, { actorUserId: actor.userId, action: "collaboration.request.review", entityType: "collaboration_request", entityId: request.id, brandId: request.toBrandId, before: { status: request.status }, after: { status, collaborationId } });
    revalidatePath("/admin/operations"); revalidatePath("/admin/journal");
    return { ok: true, message: status === "accepted" ? "Accepted. A draft collaboration has been created for editorial review." : "Collaboration request rejected" };
  });
}

export async function savePickupLocationAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb(); const id = nul(r.id);
    const brandId = r.brandId;
    if (!brandId) throw new AppError("VALIDATION", "Choose a brand");
    assertCan(actor, "orders.manage", brandId);
    const name = (r.name ?? "").trim(); const addressLine1 = (r.addressLine1 ?? "").trim();
    const city = (r.city ?? "").trim(); const state = (r.state ?? "").trim();
    if (name.length < 2 || addressLine1.length < 4 || city.length < 2 || state.length < 2) throw new AppError("VALIDATION", "Complete the location name, address, city and state");
    const patch = { brandId, name, addressLine1, addressLine2: nul(r.addressLine2), city, state, postalCode: nul(r.postalCode), country: "NG", instructions: nul(r.instructions), isActive: r.isActive === "on", updatedAt: new Date() };
    if (id) {
      const [old] = await db.select().from(pickupLocations).where(eq(pickupLocations.id, id));
      if (!old) throw new AppError("NOT_FOUND", "Pickup location not found");
      assertCan(actor, "orders.manage", old.brandId);
      await db.update(pickupLocations).set(patch).where(eq(pickupLocations.id, id));
    } else {
      await db.insert(pickupLocations).values({ id: crypto.randomUUID(), ...patch });
    }
    revalidatePath("/admin/operations");
    return { ok: true, message: id ? "Pickup location updated" : "Pickup location created" };
  });
}

export async function cancelBackInStockSubscriptionAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const [sub] = await db.select({ subscription: backInStockSubscriptions, brandId: products.brandId })
      .from(backInStockSubscriptions).innerJoin(products, eq(products.id, backInStockSubscriptions.productId))
      .where(eq(backInStockSubscriptions.id, r.subscriptionId!));
    if (!sub) throw new AppError("NOT_FOUND", "Subscription not found");
    assertCan(actor, "inventory.read", sub.brandId);
    await db.update(backInStockSubscriptions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(backInStockSubscriptions.id, r.subscriptionId!));
    revalidatePath("/admin/operations");
    return { ok: true, message: "Subscription cancelled" };
  });
}


/** Edit and publish the collaboration landing only after at least one paired product is published. */
export async function saveCollaborationAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const id = r.collaborationId;
    const [collab] = await db.select().from(collaborations).where(eq(collaborations.id, id!));
    if (!collab) throw new AppError("NOT_FOUND", "Collaboration not found");
    assertCan(actor, "content.write", collab.brandId);
    const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, collab.id), eq(collaborationRequests.status, "accepted")));
    if (!request) throw new AppError("CONFLICT", "An accepted partner request is required");
    assertCan(actor, "content.write", request.fromBrandId); assertCan(actor, "content.write", request.toBrandId);
    const title = (r.title ?? "").trim(); const slug = (r.slug ?? "").trim().toLowerCase();
    const description = (r.description ?? "").trim(); const status = r.status ?? "";
    if (title.length < 3 || title.length > 160) throw new AppError("VALIDATION", "Title must be 3–160 characters");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new AppError("VALIDATION", "Use a URL-safe slug with letters, numbers and hyphens");
    if (description.length > 3000) throw new AppError("VALIDATION", "Description is too long");
    if (!["draft", "scheduled", "published", "archived"].includes(status)) throw new AppError("VALIDATION", "Choose a valid publication status");
    const coverMediaId = nul(r.coverMediaId);
    if (coverMediaId) {
      const [cover] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, coverMediaId));
      if (!cover || cover.kind !== "image" || (cover.brandId && cover.brandId !== collab.brandId)) throw new AppError("VALIDATION", "Choose an image from this collaboration's brand media library");
    }
    if (status === "published" || status === "scheduled") {
      const published = await db.select().from(collaborationProducts).where(and(eq(collaborationProducts.collaborationId, collab.id), eq(collaborationProducts.status, "published")));
      let hasPublicProduct = false;
      for (const item of published) {
        const [a] = await db.select().from(products).where(and(eq(products.id, item.brandAProductId), publiclyVisible()));
        const [b] = await db.select().from(products).where(and(eq(products.id, item.brandBProductId), publiclyVisible()));
        if (!a || !b) continue;
        const pairs = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, item.id));
        for (const pair of pairs) {
          if (!pair.brandAVariantId || !pair.brandBVariantId) continue;
          const [av] = await db.select().from(productVariants).where(and(eq(productVariants.id, pair.brandAVariantId), eq(productVariants.productId, a.id), eq(productVariants.isActive, true)));
          const [bv] = await db.select().from(productVariants).where(and(eq(productVariants.id, pair.brandBVariantId), eq(productVariants.productId, b.id), eq(productVariants.isActive, true)));
          if (av && bv) { hasPublicProduct = true; break; }
        }
        if (hasPublicProduct) break;
      }
      if (!hasPublicProduct) throw new AppError("CONFLICT", "Publish at least one collaboration product with active paired variants and two publicly available source products before publishing the landing page");
    }
    const publishAt = r.publishAt?.trim() ? new Date(r.publishAt) : null;
    if (publishAt && Number.isNaN(publishAt.getTime())) throw new AppError("VALIDATION", "Enter a valid publication date");
    if (status === "scheduled" && !publishAt) throw new AppError("VALIDATION", "Choose a date for scheduled publication");
    try {
      await db.update(collaborations).set({ title, slug, description: description || null, coverMediaId, status: status as "draft" | "scheduled" | "published" | "archived", publishAt, updatedAt: new Date() }).where(eq(collaborations.id, collab.id));
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "That collaboration URL is already in use");
      throw e;
    }
    await writeAudit(db, { actorUserId: actor.userId, action: "collaboration.publish", entityType: "collaboration", entityId: collab.id, brandId: collab.brandId, before: { status: collab.status, slug: collab.slug }, after: { status, slug, publishAt } });
    revalidatePath("/admin/operations"); revalidatePath(`/admin/collaborations/${collab.id}`); revalidatePath("/collaborations"); revalidatePath(`/collaborations/${slug}`);
    return { ok: true, message: status === "published" ? "Collaboration landing published" : "Collaboration landing saved" };
  });
}

/** Save a draft collaboration product after validating both source brands and the accepted request. */
export async function saveCollaborationProductAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const collaborationId = r.collaborationId;
    const name = (r.name ?? "").trim();
    const description = (r.description ?? "").trim();
    const id = nul(r.id);
    if (!collaborationId || name.length < 3 || name.length > 160) throw new AppError("VALIDATION", "Choose a collaboration and enter a product name (3–160 characters)");
    if (description.length > 3000) throw new AppError("VALIDATION", "Description is too long");
    const price = money(r.price);
    if (price === null || !Number.isSafeInteger(price) || price < 0) throw new AppError("VALIDATION", "Enter a valid collaboration price");
    const [collab] = await db.select().from(collaborations).where(eq(collaborations.id, collaborationId));
    if (!collab) throw new AppError("NOT_FOUND", "Collaboration not found");
    assertCan(actor, "content.write", collab.brandId);
    const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, collaborationId), eq(collaborationRequests.status, "accepted")));
    if (!request) throw new AppError("CONFLICT", "This collaboration has no accepted partner request");
    assertCan(actor, "content.write", request.fromBrandId);
    assertCan(actor, "content.write", request.toBrandId);
    const brandAProductId = r.brandAProductId;
    const brandBProductId = r.brandBProductId;
    if (!brandAProductId || !brandBProductId) throw new AppError("VALIDATION", "Choose a source product from each brand");
    const [a] = await db.select().from(products).where(eq(products.id, brandAProductId));
    const [b] = await db.select().from(products).where(eq(products.id, brandBProductId));
    if (!a || !b || a.brandId !== request.fromBrandId || b.brandId !== request.toBrandId) {
      throw new AppError("VALIDATION", "Choose one product from the requesting brand and one from the partner brand");
    }
    if (a.id === b.id) throw new AppError("VALIDATION", "Choose two different source products");
    const status: "draft" | "published" | "archived" = r.status === "published" ? "published" : r.status === "archived" ? "archived" : "draft";
    if (status === "published") {
      if (!isPubliclyVisibleProduct(a) || !isPubliclyVisibleProduct(b)) throw new AppError("CONFLICT", "Both source products must be publicly available first");
      const variants = id ? await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, id)) : [];
      if (variants.length === 0) throw new AppError("CONFLICT", "Add at least one paired variant before publishing");
      let validPairs = 0;
      for (const pair of variants) {
        if (!pair.brandAVariantId || !pair.brandBVariantId) continue;
        const [av] = await db.select().from(productVariants).where(and(eq(productVariants.id, pair.brandAVariantId), eq(productVariants.productId, a.id), eq(productVariants.isActive, true)));
        const [bv] = await db.select().from(productVariants).where(and(eq(productVariants.id, pair.brandBVariantId), eq(productVariants.productId, b.id), eq(productVariants.isActive, true)));
        if (av && bv) validPairs++;
      }
      if (validPairs === 0) throw new AppError("CONFLICT", "At least one paired variant must still reference active variants from both published source products");
    }
    const values = { collaborationId, brandAProductId, brandBProductId, name, description: description || null, price, status, updatedAt: new Date() };
    let productId = id;
    if (id) {
      const [existing] = await db.select().from(collaborationProducts).where(and(eq(collaborationProducts.id, id), eq(collaborationProducts.collaborationId, collaborationId)));
      if (!existing) throw new AppError("NOT_FOUND", "Collaboration product not found");
      if (existing.status === "published" && status !== "published") { /* explicit unpublish is allowed before edits */ }
      const existingVariants = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, id));
      if (existingVariants.length && (existing.brandAProductId !== brandAProductId || existing.brandBProductId !== brandBProductId)) throw new AppError("CONFLICT", "Remove or recreate paired variants before changing source products");
      await db.update(collaborationProducts).set(values).where(eq(collaborationProducts.id, id));
    } else {
      productId = crypto.randomUUID();
      await db.insert(collaborationProducts).values({ id: productId, ...values });
    }
    await writeAudit(db, { actorUserId: actor.userId, action: "collaboration.product.save", entityType: "collaboration_product", entityId: productId!, brandId: collab.brandId, after: values });
    revalidatePath("/admin/operations"); revalidatePath(`/admin/collaborations/${collaborationId}`); revalidatePath(`/collaborations/${collab.slug}`); revalidatePath("/collaborations");
    return { ok: true, message: status === "published" ? "Collaboration product published" : "Collaboration product saved" };
  });
}

export async function addCollaborationVariantAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const collaborationProductId = r.collaborationProductId;
    const [cp] = await db.select().from(collaborationProducts).where(eq(collaborationProducts.id, collaborationProductId!));
    if (!cp) throw new AppError("NOT_FOUND", "Collaboration product not found");
    const [collab] = await db.select().from(collaborations).where(eq(collaborations.id, cp.collaborationId));
    if (!collab) throw new AppError("NOT_FOUND", "Collaboration not found");
    assertCan(actor, "content.write", collab.brandId);
    const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, cp.collaborationId), eq(collaborationRequests.status, "accepted")));
    if (!request) throw new AppError("CONFLICT", "Accepted partner request not found");
    assertCan(actor, "content.write", request.fromBrandId); assertCan(actor, "content.write", request.toBrandId);
    if (cp.status === "published") throw new AppError("CONFLICT", "Unpublish the collaboration product before changing its paired variants");
    const aId = nul(r.brandAVariantId); const bId = nul(r.brandBVariantId);
    if (!aId || !bId) throw new AppError("VALIDATION", "Choose a variant from each brand");
    const [a] = await db.select().from(productVariants).where(and(eq(productVariants.id, aId), eq(productVariants.productId, cp.brandAProductId)));
    const [b] = await db.select().from(productVariants).where(and(eq(productVariants.id, bId), eq(productVariants.productId, cp.brandBProductId)));
    if (!a || !b || !a.isActive || !b.isActive) throw new AppError("VALIDATION", "Choose active variants belonging to the selected source products");
    const duplicate = await db.select().from(collaborationProductVariants).where(and(eq(collaborationProductVariants.collaborationProductId, cp.id), eq(collaborationProductVariants.brandAVariantId, aId), eq(collaborationProductVariants.brandBVariantId, bId)));
    if (duplicate.length) throw new AppError("CONFLICT", "That variant pair already exists");
    await db.insert(collaborationProductVariants).values({ id: crypto.randomUUID(), collaborationProductId: cp.id, brandAVariantId: a.id, brandBVariantId: b.id, brandASize: a.size, brandAColor: a.colorName, brandBSize: b.size, brandBColor: b.colorName, onHand: 0, reserved: 0 });
    await writeAudit(db, { actorUserId: actor.userId, action: "collaboration.variant.add", entityType: "collaboration_product", entityId: cp.id, brandId: collab.brandId, after: { brandAVariantId: a.id, brandBVariantId: b.id } });
    revalidatePath(`/admin/collaborations/${cp.collaborationId}`);
    return { ok: true, message: "Paired variant added" };
  });
}

export async function removeCollaborationVariantAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const [variant] = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.id, r.variantId!));
    if (!variant) throw new AppError("NOT_FOUND", "Collaboration variant not found");
    const [cp] = await db.select().from(collaborationProducts).where(eq(collaborationProducts.id, variant.collaborationProductId));
    if (!cp) throw new AppError("NOT_FOUND", "Collaboration product not found");
    const [collab] = await db.select().from(collaborations).where(eq(collaborations.id, cp.collaborationId));
    const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, cp.collaborationId), eq(collaborationRequests.status, "accepted")));
    if (!collab || !request) throw new AppError("NOT_FOUND", "Collaboration not found");
    assertCan(actor, "content.write", collab.brandId); assertCan(actor, "content.write", request.fromBrandId); assertCan(actor, "content.write", request.toBrandId);
    if (cp.status === "published") throw new AppError("CONFLICT", "Unpublish the collaboration product before changing its variants");
    await db.delete(collaborationProductVariants).where(eq(collaborationProductVariants.id, variant.id));
    revalidatePath(`/admin/collaborations/${cp.collaborationId}`);
    return { ok: true, message: "Paired variant removed" };
  });
}


export async function updateBrandFulfilmentAction(_: ActionState, f: FormData): Promise<ActionState> {
  return run(async () => {
    const r = fd(f); const { actor } = await ctx(); const db = getDb();
    const [fulfilment] = await db.select().from(orderBrandFulfilments).where(eq(orderBrandFulfilments.id, r.fulfilmentId!));
    if (!fulfilment) throw new AppError("NOT_FOUND", "Fulfilment record not found");
    assertCan(actor, "orders.manage", fulfilment.brandId);
    const [order] = await db.select().from(orders).where(eq(orders.id, fulfilment.orderId));
    if (!order) throw new AppError("NOT_FOUND", "Order not found");
    if (order.paymentStatus !== "paid") throw new AppError("CONFLICT", "Fulfilment can only begin after payment is confirmed");
    const next = r.status;
    if (!next) throw new AppError("VALIDATION", "Choose the next fulfilment status");
    const allowed = fulfilment.method === "pickup"
      ? (fulfilment.status === "unfulfilled" ? ["processing", "cancelled"] : fulfilment.status === "processing" ? ["ready_for_pickup", "cancelled"] : fulfilment.status === "ready_for_pickup" ? ["delivered"] : [])
      : (fulfilment.status === "unfulfilled" ? ["processing", "cancelled"] : fulfilment.status === "processing" ? ["shipped", "cancelled"] : fulfilment.status === "shipped" ? ["delivered"] : []);
    if (!allowed.includes(next)) throw new AppError("CONFLICT", `Cannot move ${fulfilment.method} fulfilment from ${fulfilment.status} to ${next}`);
    await db.update(orderBrandFulfilments).set({
      status: next as "unfulfilled" | "processing" | "ready_for_pickup" | "shipped" | "delivered" | "cancelled",
      fulfilledAt: next === "delivered" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(orderBrandFulfilments.id, fulfilment.id));
    if (next !== "cancelled" && order.status === "paid") await setOrderStatus(db, order.id, "processing", "Brand fulfilment started", actor.userId);
    const allFulfilments = await db.select().from(orderBrandFulfilments).where(eq(orderBrandFulfilments.orderId, order.id));
    const [freshOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
    if (freshOrder?.status === "paid" && allFulfilments.some((row) => row.status !== "unfulfilled" && row.status !== "cancelled")) await setOrderStatus(db, order.id, "processing", "Brand fulfilment started", actor.userId);
    if (allFulfilments.length > 0 && allFulfilments.every((row) => row.status === "shipped" || row.status === "delivered") && allFulfilments.some((row) => row.status === "shipped") && freshOrder && freshOrder.status === "processing") {
      await setOrderStatus(db, order.id, "shipped", "All delivery fulfilments shipped", actor.userId);
    }
    if (allFulfilments.length > 0 && allFulfilments.every((row) => row.status === "delivered") && freshOrder && freshOrder.status !== "delivered") {
      const [latestOrder] = await db.select().from(orders).where(eq(orders.id, order.id));
      if (latestOrder?.status === "paid") await setOrderStatus(db, order.id, "processing", "All fulfilments completed", actor.userId);
      const [beforeDelivered] = await db.select().from(orders).where(eq(orders.id, order.id));
      if (beforeDelivered && beforeDelivered.status !== "delivered") await setOrderStatus(db, order.id, "delivered", "All brand fulfilments completed", actor.userId, { allowFulfilmentCompletion: true });
    }
    await writeAudit(db, { actorUserId: actor.userId, action: "order.brand_fulfilment.update", entityType: "order", entityId: fulfilment.orderId, brandId: fulfilment.brandId, before: { status: fulfilment.status }, after: { status: next, method: fulfilment.method } });
    revalidatePath(`/admin/orders/${fulfilment.orderId}`);
    return { ok: true, message: "Brand fulfilment updated" };
  });
}
