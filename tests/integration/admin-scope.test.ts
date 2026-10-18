import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct } from "@/domains/catalog/admin";
import { saveCollection, setCollectionProducts, attachProductMedia, upsertVariant } from "@/domains/admin/catalog";
import { saveDiscount } from "@/domains/admin/discounts";
import { saveLook, setLookItems, savePageBlocks, getOrCreateHome } from "@/domains/admin/content";
import { grantRole, createAdminUser, revokeGrant, listAdminUsers } from "@/domains/admin/ops";
import { mediaAssets, userRoles, users } from "@/infrastructure/db/schema";
import { storeUpload } from "@/domains/media";
import { loadActor } from "@/domains/authorization";

let ctx: Awaited<ReturnType<typeof makeTestDb>>; let a: Awaited<ReturnType<typeof seedBrandsAndActors>>; let uthyProd = ""; let aloProd = "";
beforeAll(async () => {
  ctx = await makeTestDb(); a = await seedBrandsAndActors(ctx.db);
  const mk = (brandId: string, name: string) => createProduct(ctx.db, a.superAdmin, { brandId, name, basePrice: 100000, status: "published", variants: [{ sku: name.replace(/\W/g, "").toUpperCase(), size: "M" }] });
  uthyProd = (await mk(a.uthy.id, "Uthy Item")).id; aloProd = (await mk(a.alo.id, "Alo Item")).id;
});
afterAll(() => ctx.cleanup());

describe("cross-brand denial across admin domains", () => {
  it("collections: brand admin cannot create house-wide or other-brand collections, nor mix brands", async () => {
    await expect(saveCollection(ctx.db, a.uthyAdmin, { title: "House", brandId: null, status: "draft" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveCollection(ctx.db, a.uthyAdmin, { title: "Alo", brandId: a.alo.id, status: "draft" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const id = await saveCollection(ctx.db, a.uthyAdmin, { title: "Uthy Edit", brandId: a.uthy.id, status: "published" });
    await expect(setCollectionProducts(ctx.db, a.uthyAdmin, id, [aloProd])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setCollectionProducts(ctx.db, a.uthyAdmin, id, [uthyProd]);
    await expect(setCollectionProducts(ctx.db, a.aloAdmin, id, [uthyProd])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("discounts: house-wide codes are super-admin only; brand codes are brand-scoped", async () => {
    await expect(saveDiscount(ctx.db, a.uthyAdmin, { code: "ALL10", kind: "percent", value: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveDiscount(ctx.db, a.uthyAdmin, { code: "ALO10", brandId: a.alo.id, kind: "percent", value: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await saveDiscount(ctx.db, a.uthyAdmin, { code: "UTHY10", brandId: a.uthy.id, kind: "percent", value: 10 });
    await expect(saveDiscount(ctx.db, a.superAdmin, { code: "BAD", kind: "percent", value: 150 })).rejects.toThrow();
  });
  it("looks only contain own-brand products; pages/blocks homepage is global-only and validated", async () => {
    const lookId = await saveLook(ctx.db, a.uthyAdmin, { brandId: a.uthy.id, title: "Uthy Look", status: "draft" });
    await expect(setLookItems(ctx.db, a.uthyAdmin, lookId, [{ productId: aloProd }])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveLook(ctx.db, a.aloAdmin, { brandId: a.alo.id, title: "x" }, lookId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getOrCreateHome(ctx.db, a.uthyAdmin)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const home = await getOrCreateHome(ctx.db, a.superAdmin);
    await expect(savePageBlocks(ctx.db, a.superAdmin, home.id, { status: "published", blocks: [{ type: "evil_block", data: {} }] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(savePageBlocks(ctx.db, a.superAdmin, home.id, { status: "published", blocks: [{ type: "promo", data: { title: "x", ctaHref: "javascript:alert(1)" } }] })).rejects.toThrow();
    await savePageBlocks(ctx.db, a.superAdmin, home.id, { status: "published", blocks: [{ type: "hero", data: { title: "Hi", ctaHref: "/shop" } }] });
  });
  it("variants and media follow the product's brand", async () => {
    await expect(upsertVariant(ctx.db, a.aloAdmin, uthyProd, { sku: "X-1", size: "L" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const png = new Uint8Array(32); png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(png.buffer).setUint32(16, 10); new DataView(png.buffer).setUint32(20, 10);
    const store = { put: async () => undefined, delete: async () => undefined, publicUrl: (k: string) => k };
    const m = await storeUpload(ctx.db, store, a.aloAdmin, { bytes: png, uploadId: "upload-abc-123", brandId: a.alo.id, altText: "alo" });
    await expect(attachProductMedia(ctx.db, a.superAdmin, uthyProd, { mediaId: m.id, role: "primary" })).rejects.toMatchObject({ code: "FORBIDDEN" }); // ALO media on UTHY product
    await expect(storeUpload(ctx.db, store, a.uthyAdmin, { bytes: png, uploadId: "upload-xyz-123", brandId: a.alo.id, altText: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await storeUpload(ctx.db, store, a.aloAdmin, { bytes: png, uploadId: "upload-abc-123", brandId: a.alo.id, altText: "alo" })).id).toBe(m.id); // idempotent retry
    expect((await ctx.db.select().from(mediaAssets)).length).toBe(1);
  });
});

describe("roles administration", () => {
  it("only super admins manage users; brand roles bind only to their own brand", async () => {
    await expect(listAdminUsers(ctx.db, a.uthyAdmin)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { id } = await createAdminUser(ctx.db, a.superAdmin, { email: "new@verane.test", name: "New Admin" });
    await expect(grantRole(ctx.db, a.superAdmin, id, "UTHY_ADMIN", a.alo.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(grantRole(ctx.db, a.superAdmin, id, "UTHY_ADMIN", null)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(grantRole(ctx.db, a.superAdmin, id, "SUPER_ADMIN", a.uthy.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await grantRole(ctx.db, a.superAdmin, id, "UTHY_ADMIN", a.uthy.id);
    const actor = await loadActor(ctx.db, id);
    expect(actor.grants).toHaveLength(1);
    const [g] = await ctx.db.select().from(userRoles).where(eq(userRoles.userId, id));
    await revokeGrant(ctx.db, a.superAdmin, g!.id);
    expect((await loadActor(ctx.db, id)).grants).toHaveLength(0);
    const self = (await ctx.db.select().from(userRoles).where(eq(userRoles.userId, a.superAdmin.userId)))[0]!;
    await expect(revokeGrant(ctx.db, a.superAdmin, self.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await ctx.db.select().from(users)).length).toBeGreaterThan(3);
  });
});
