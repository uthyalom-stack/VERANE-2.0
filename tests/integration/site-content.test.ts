import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSiteConfig, getStaticContent, saveSiteRecord } from "@/domains/site-content";
import { mediaAssets } from "@/infrastructure/db/schema";
import { makeTestDb, seedBrandsAndActors } from "../helpers";

let ctx: Awaited<ReturnType<typeof makeTestDb>>;
let brands: Awaited<ReturnType<typeof seedBrandsAndActors>>;
let imageId = "";
const storageKey = `image/${"a".repeat(32)}.webp`;

beforeAll(async () => {
  ctx = await makeTestDb();
  brands = await seedBrandsAndActors(ctx.db);
  const [image] = await ctx.db.insert(mediaAssets).values({
    storageKey,
    kind: "image",
    mimeType: "image/webp",
    byteSize: 512,
    altText: "Editorial test image",
    createdAt: new Date(),
  }).returning({ id: mediaAssets.id });
  imageId = image!.id;
});

afterAll(() => ctx.cleanup());

describe("site content configuration", () => {
  it("derives fallback brand navigation from active database brands", async () => {
    const config = await getSiteConfig(ctx.db);

    expect(config.navigation).toContainEqual({ href: `/brands/${brands.uthy.slug}`, label: brands.uthy.name });
    expect(config.navigation).toContainEqual({ href: `/brands/${brands.alo.slug}`, label: brands.alo.name });
    expect(config.settings.siteName).toBe("Your Store");
  });

  it("resolves selected brand hero, logo and favicon media from the media library", async () => {
    await saveSiteRecord(ctx.db, "site-settings", "Site settings", "site_settings", {
      siteName: "VERANE Test",
      tagline: "Two Brands. One Expression.",
      announcementEnabled: true,
      announcementText: "New collection available",
      brandHeroMedia: { [brands.uthy.slug]: imageId },
      logoMediaId: imageId,
      faviconMediaId: imageId,
    });

    const config = await getSiteConfig(ctx.db);
    const expectedUrl = `http://localhost:3000/media/${storageKey}`;

    expect(config.settings).toMatchObject({
      siteName: "VERANE Test",
      tagline: "Two Brands. One Expression.",
      announcementEnabled: true,
      announcementText: "New collection available",
    });
    expect(config.heroImageUrls[brands.uthy.slug]).toBe(expectedUrl);
    expect(config.logoUrl).toBe(expectedUrl);
    expect(config.faviconUrl).toBe(expectedUrl);
    expect(config.heroImageUrls[brands.alo.slug]).toBeNull();
  });

  it("keeps custom navigation URLs but synchronizes brand labels to current brand records", async () => {
    await saveSiteRecord(ctx.db, "site-navigation", "Site navigation", "site_navigation", {
      links: [
        { href: `/brands/${brands.uthy.slug}`, label: "Old brand name" },
        { href: "https://example.com/editorial", label: "Editorial" },
      ],
    });

    const config = await getSiteConfig(ctx.db);

    expect(config.navigation).toEqual([
      { href: `/brands/${brands.uthy.slug}`, label: brands.uthy.name },
      { href: "https://example.com/editorial", label: "Editorial" },
    ]);
  });

  it("returns editable static content and safe generic defaults", async () => {
    expect(await getStaticContent(ctx.db, "about")).toMatchObject({
      title: "About us",
      body: "Discover the point of view, products and creative work behind our store.",
    });

    await saveSiteRecord(ctx.db, "about", "Our story", "static_content", {
      title: "Our story",
      body: "A story written by the site administrator.",
    });

    expect(await getStaticContent(ctx.db, "about")).toEqual({
      title: "Our story",
      body: "A story written by the site administrator.",
    });
  });
});
