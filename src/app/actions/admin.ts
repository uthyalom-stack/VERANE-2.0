"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { parseMajorToMinor } from "@/lib/money";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/lib/http/session";
import { run, fd, type ActionState } from "@/lib/http/action";
import { archiveProduct, createProduct, updateProduct } from "@/domains/catalog/admin";
import { adjustStock } from "@/domains/inventory";
import { attachProductMedia, detachProductMedia, removeVariant, reorderProductMedia, saveCategory, saveCollection, setCollectionProducts, setProductStatus, upsertVariant } from "@/domains/admin/catalog";
import { saveDiscount } from "@/domains/admin/discounts";
import { saveArticle, saveCampaign, saveLook, savePageBlocks, setLookItems } from "@/domains/admin/content";
import { createAdminUser, grantRole, revokeGrant } from "@/domains/admin/ops";
import { createShipmentForOrder, adminSetOrderStatus } from "@/domains/orders/fulfilment";
import { getShippingProvider } from "@/infrastructure/shipping";
import { updateAlt } from "@/domains/media";
import { brands } from "@/infrastructure/db/schema";
import { writeAudit } from "@/domains/audit";
import { assertCan } from "@/domains/authorization";

const money = (v: string | undefined) => (v && v.trim() ? parseMajorToMinor(v.replace(/,/g, "")) : null);
const dateOrNull = (v: string | undefined) => (v && v.trim() ? v : null);
const nul = (v: string | undefined) => (v && v.trim() ? v : null);
const ctx = () => requireAdmin();

function productPayload(f: FormData) {
  const r = fd(f);
  return { brandId: r.brandId, name: r.name, slug: nul(r.slug) ?? undefined, subtitle: nul(r.subtitle), description: nul(r.description), materials: nul(r.materials), fit: nul(r.fit), sizingInfo: nul(r.sizingInfo), careInstructions: nul(r.careInstructions), deliveryInfo: nul(r.deliveryInfo),
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
    await adjustStock(getDb(), (await ctx()).actor, { variantId: r.variantId!, delta, type: (r.type || "adjust") as never, reason: r.reason ?? "" });
    revalidatePath("/admin/inventory"); return { ok: true, message: "Stock updated" };
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
  return run(async () => { const r = fd(f); let blocks: Array<{ type: string; data: unknown }> = []; try { blocks = JSON.parse(r.blocks || "[]"); } catch { throw new AppError("VALIDATION", "Blocks are malformed"); } await savePageBlocks(getDb(), (await ctx()).actor, r.pageId!, { status: r.status === "published" ? "published" : "draft", blocks }); revalidatePath("/"); revalidatePath("/admin/pages"); return { ok: true, message: r.status === "published" ? "Published" : "Draft saved" }; });
}

export async function updateOrderStatusAction(_: ActionState, f: FormData): Promise<ActionState> { return run(async () => { const r = fd(f); await adminSetOrderStatus(getDb(), (await ctx()).actor, r.orderId!, r.status!, r.note ?? ""); revalidatePath(`/admin/orders/${r.orderId}`); return { ok: true, message: "Status updated" }; }); }
export async function createShipmentAction(orderId: string): Promise<void> { await run(async () => { await createShipmentForOrder(getDb(), getShippingProvider(), (await ctx()).actor, orderId); revalidatePath(`/admin/orders/${orderId}`); }); }

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
