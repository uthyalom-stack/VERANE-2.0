import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTestDb, seedBrandsAndActors } from "../helpers";
import { createProduct, updateProduct, archiveProduct, getProductForAdmin, listProductsForAdmin } from "@/domains/catalog/admin";
import { listShopProducts } from "@/domains/catalog/public";

let ctx: Awaited<ReturnType<typeof makeTestDb>>; let a: Awaited<ReturnType<typeof seedBrandsAndActors>>;
beforeAll(async () => { ctx = await makeTestDb(); a = await seedBrandsAndActors(ctx.db); });
afterAll(() => ctx.cleanup());

const base = (brandId: string, name: string) => ({ brandId, name, basePrice: 500000, status: "published", variants: [{ sku: name.replace(/\s/g, "-").toUpperCase(), size: "M", initialStock: 5 }] });

describe("brand isolation", () => {
  let uthyProductId = ""; let aloProductId = "";
  it("UTHY admin creates UTHY products but cannot create ALOMZIEE products", async () => {
    uthyProductId = (await createProduct(ctx.db, a.uthyAdmin, base(a.uthy.id, "Uthy Coat"))).id;
    await expect(createProduct(ctx.db, a.uthyAdmin, base(a.alo.id, "Sneaky"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    aloProductId = (await createProduct(ctx.db, a.aloAdmin, base(a.alo.id, "Alo Sneaker"))).id;
  });
  it("blocks cross-brand read, update, archive by id manipulation", async () => {
    await expect(getProductForAdmin(ctx.db, a.uthyAdmin, aloProductId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateProduct(ctx.db, a.uthyAdmin, aloProductId, base(a.uthy.id, "Hijack"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archiveProduct(ctx.db, a.uthyAdmin, aloProductId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("blocks moving an own product into the other brand", async () => {
    await expect(updateProduct(ctx.db, a.uthyAdmin, uthyProductId, base(a.alo.id, "Uthy Coat"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("list is scoped per brand; super admin sees all", async () => {
    expect((await listProductsForAdmin(ctx.db, a.uthyAdmin)).every((p) => p.brandId === a.uthy.id)).toBe(true);
    expect((await listProductsForAdmin(ctx.db, a.superAdmin)).length).toBeGreaterThanOrEqual(2);
  });
  it("unauthenticated actor is rejected", async () => {
    await expect(createProduct(ctx.db, null as never, base(a.uthy.id, "X"))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("catalog validation and public visibility", () => {
  it("rejects duplicate SKUs, invalid compare-at price, scheduled without date", async () => {
    const dup = { ...base(a.uthy.id, "Dup"), variants: [{ sku: "AB-1", size: "S" }, { sku: "ab-1", size: "M" }] };
    await expect(createProduct(ctx.db, a.superAdmin, dup)).rejects.toThrow();
    await expect(createProduct(ctx.db, a.superAdmin, { ...base(a.uthy.id, "Bad"), compareAtPrice: 100 })).rejects.toThrow();
    await expect(createProduct(ctx.db, a.superAdmin, { ...base(a.uthy.id, "Sched"), status: "scheduled" })).rejects.toThrow();
  });
  it("drafts and archived products never appear publicly; filters by brand work", async () => {
    await createProduct(ctx.db, a.superAdmin, { ...base(a.uthy.id, "Hidden Draft"), status: "draft" });
    const all = await listShopProducts(ctx.db, {});
    expect(all.items.some((p) => p.name === "Hidden Draft")).toBe(false);
    const uthyOnly = await listShopProducts(ctx.db, { brand: "uthy-luxury" });
    expect(uthyOnly.items.length).toBeGreaterThan(0);
    expect(uthyOnly.items.every((p) => p.brandId === a.uthy.id)).toBe(true);
  });
  it("slug change creates a redirect and keeps audit trail", async () => {
    const { id } = await createProduct(ctx.db, a.superAdmin, base(a.uthy.id, "Old Name"));
    await updateProduct(ctx.db, a.superAdmin, id, { ...base(a.uthy.id, "New Name") });
    const { slugRedirects, auditLogs } = await import("@/infrastructure/db/schema");
    expect((await ctx.db.select().from(slugRedirects)).some((r) => r.fromPath === "/product/old-name")).toBe(true);
    expect((await ctx.db.select().from(auditLogs)).some((l) => l.entityId === id && l.action.startsWith("product.update"))).toBe(true);
  });
});
