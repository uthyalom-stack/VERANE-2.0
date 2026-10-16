/**
 * DEVELOPMENT SEED — sample data only. Every product/campaign here is clearly labelled SAMPLE and uses
 * placeholder media. Refuses to run when APP_ENV=production. Never mixes into production data.
 */
import { eq } from "drizzle-orm";
import { createDb } from "../src/infrastructure/db/client";
import * as s from "../src/infrastructure/db/schema";
import { reconcileRbac } from "../src/domains/authorization/seed";
import { createProduct } from "../src/domains/catalog/admin";
import { loadActor } from "../src/domains/authorization";
import { hashPassword } from "../src/lib/crypto";
import { reindexProduct } from "../src/domains/search";

if (process.env.APP_ENV === "production") throw new Error("Seed refuses to run in production");
const { db } = createDb(process.env.DATABASE_URL ?? "file:./local.db", process.env.DATABASE_AUTH_TOKEN);
await reconcileRbac(db);

const brandRows = [
  { code: "UTHY_LUXURY", slug: "uthy-luxury", name: "UTHY LUXURY", tagline: "Restraint, sculpted.", themeKey: "uthy", description: "Refined, sculptural, premium." },
  { code: "ALOMZIEE_FOOTIES", slug: "alomziee-footies", name: "ALOMZIEE FOOTIES", tagline: "Loud on purpose.", themeKey: "alomzie", description: "Expressive footwear and fashion." },
];
for (const b of brandRows) await db.insert(s.brands).values({ ...b, createdAt: new Date(), updatedAt: new Date() }).onConflictDoUpdate({ target: s.brands.code, set: { tagline: b.tagline, themeKey: b.themeKey, description: b.description, updatedAt: new Date() } });
const brand = Object.fromEntries((await db.select().from(s.brands)).map((b) => [b.code, b]));

const cats = [
  { slug: "dresses", name: "Dresses", kind: "clothing" as const }, { slug: "outerwear", name: "Outerwear", kind: "clothing" as const },
  { slug: "tops", name: "Tops", kind: "clothing" as const }, { slug: "trousers", name: "Trousers", kind: "clothing" as const },
  { slug: "sneakers", name: "Sneakers", kind: "footwear" as const }, { slug: "heels", name: "Heels", kind: "footwear" as const },
  { slug: "bags", name: "Bags", kind: "accessory" as const },
];
for (const c of cats) await db.insert(s.categories).values(c).onConflictDoNothing();
const cat = Object.fromEntries((await db.select().from(s.categories)).map((c) => [c.slug, c.id]));

// admin users (credentials from env; never hardcode real ones)
const pw = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Dev-Only-123";
const roleRows = Object.fromEntries((await db.select().from(s.roles)).map((r) => [r.code ?? "", r.id]));
async function admin(email: string, name: string, role: string, brandId: string | null) {
  const [ex] = await db.select().from(s.users).where(eq(s.users.email, email));
  const id = ex?.id ?? crypto.randomUUID();
  if (!ex) {
    await db.insert(s.users).values({ id, email, name, isActive: true, passwordHash: await hashPassword(pw), kind: "admin", emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    await db.insert(s.adminProfiles).values({ id: crypto.randomUUID(), userId: id, displayName: name, createdAt: new Date(), updatedAt: new Date() });
  }
  await db.insert(s.userRoles).values({ userId: id, roleId: roleRows[role]!, brandId }).onConflictDoNothing();
  return id;
}
await admin("super@verane.local", "Super Admin", "SUPER_ADMIN", null);
await admin("uthy@verane.local", "UTHY Admin", "UTHY_ADMIN", brand.UTHY_LUXURY!.id);
await admin("alomzie@verane.local", "ALOMZIEE Admin", "ALOMZIEE_ADMIN", brand.ALOMZIEE_FOOTIES!.id);
const superActor = await loadActor(db, (await db.select().from(s.users).where(eq(s.users.email, "super@verane.local")))[0]!.id);

// placeholder media (clearly flagged)
const ph = ["uthy-hero", "alomzie-hero", "look-1", "look-2", "product-1", "product-2"];
for (const k of ph) await db.insert(s.mediaAssets).values({ storageKey: `placeholders/${k}.svg`, kind: "image", mimeType: "image/svg+xml", byteSize: 1200, width: 1600, height: 1000, altText: `Placeholder artwork (${k})`, isPlaceholder: true }).onConflictDoNothing();

const sample = [
  { b: "UTHY_LUXURY", name: "SAMPLE Sculpted Column Dress", price: 18500000, type: "Dress", style: "Evening", occasion: "Event", cat: "dresses", sizes: ["XS", "S", "M", "L"], colors: [["Obsidian", "#121316"]] },
  { b: "UTHY_LUXURY", name: "SAMPLE Architectural Wool Coat", price: 32000000, type: "Coat", style: "Tailored", occasion: "Work", cat: "outerwear", sizes: ["S", "M", "L"], colors: [["Pewter", "#8C9096"], ["Obsidian", "#121316"]] },
  { b: "UTHY_LUXURY", name: "SAMPLE Satin Draped Top", price: 9800000, type: "Top", style: "Evening", occasion: "Event", cat: "tops", sizes: ["XS", "S", "M"], colors: [["Champagne", "#B9A27A"]] },
  { b: "ALOMZIEE_FOOTIES", name: "SAMPLE Neon Block Sneaker", price: 7500000, type: "Sneaker", style: "Street", occasion: "Casual", cat: "sneakers", sizes: ["40", "41", "42", "43", "44"], colors: [["Ultramarine", "#2B2BFF"], ["Citrus", "#E4FF3A"]] },
  { b: "ALOMZIEE_FOOTIES", name: "SAMPLE Graphic Platform Heel", price: 6900000, type: "Heel", style: "Statement", occasion: "Party", cat: "heels", sizes: ["37", "38", "39", "40"], colors: [["Lilac", "#C9B8FF"]] },
];
for (const p of sample) {
  const variants = p.colors.flatMap(([colorName, colorHex], ci) => p.sizes.map((size, si) => ({
    sku: `${p.b.slice(0, 3)}-${p.name.replace(/SAMPLE /, "").split(" ").map((w) => w[0]).join("")}-${colorName!.slice(0, 3).toUpperCase()}-${size}`,
    size, colorName, colorHex, isActive: true, sortOrder: ci * 10 + si, initialStock: 8,
  })));
  try {
    const { id } = await createProduct(db, superActor, { brandId: brand[p.b]!.id, name: p.name, basePrice: p.price, productType: p.type, style: p.style, occasion: p.occasion,
      description: "Sample catalog item for development only.", status: "published", isFeatured: true, categoryIds: [cat[p.cat]!], variants });
    await reindexProduct(db, id);
  } catch (e) { if (!String(e).includes("already exists")) throw e; }
}

// Homepage as structured, CMS-editable blocks
const [home] = await db.insert(s.pages).values({ kind: "home", slug: "", title: "VÉRANE", status: "published" }).onConflictDoNothing().returning();
if (home) {
  const blocks = [
    { type: "hero", data: { title: "Two Brands. One Expression.", subtitle: "SAMPLE campaign — replace via admin", ctaLabel: "Shop the house", ctaHref: "/shop", mediaKey: "placeholders/uthy-hero.svg" } },
    { type: "brand_intro", data: { brandSlugs: ["uthy-luxury", "alomziee-footies"] } },
    { type: "product_rail", data: { title: "New arrivals", source: "newest", limit: 8 } },
    { type: "outfit_builder_intro", data: {} },
    { type: "newsletter", data: {} },
  ];
  for (const [i, b] of blocks.entries()) await db.insert(s.pageBlocks).values({ pageId: home.id, sortOrder: i, type: b.type, data: b.data });
}
// ---- sample editorial/commerce content (clearly SAMPLE) ----
const media = Object.fromEntries((await db.select().from(s.mediaAssets)).map((m) => [m.storageKey, m.id]));
const allProducts = await db.select().from(s.products);
const uthyProducts = allProducts.filter((p) => p.brandId === brand.UTHY_LUXURY!.id);
const [col] = await db.insert(s.collections).values({ brandId: brand.UTHY_LUXURY!.id, slug: "sample-evening-edit", title: "SAMPLE Evening Edit", description: "Sample collection for development.", heroMediaId: media["placeholders/look-1.svg"], status: "published", isFeatured: true }).onConflictDoNothing().returning();
if (col) for (const [i, p] of uthyProducts.entries()) await db.insert(s.collectionProducts).values({ collectionId: col.id, productId: p.id, sortOrder: i }).onConflictDoNothing();
const [look] = await db.insert(s.looks).values({ brandId: brand.UTHY_LUXURY!.id, slug: "sample-city-after-dark", title: "SAMPLE City After Dark", description: "Sample look for development.", stylingNotes: "Keep the line long and the accessories quiet.", imageMediaId: media["placeholders/look-1.svg"], status: "published" }).onConflictDoNothing().returning();
if (look) for (const [i, p] of uthyProducts.entries()) await db.insert(s.lookItems).values({ lookId: look.id, productId: p.id, sortOrder: i }).onConflictDoNothing();
await db.insert(s.journalArticles).values({ slug: "sample-two-houses", kind: "brand_story", title: "SAMPLE: Two houses, one expression", excerpt: "Sample story for development.", coverMediaId: media["placeholders/look-2.svg"], status: "published", body: [{ type: "paragraph", text: "This is sample editorial copy." }, { type: "heading", text: "Sample heading" }, { type: "paragraph", text: "Replace via the admin journal editor." }] }).onConflictDoNothing();
await db.insert(s.discounts).values({ code: "WELCOME10", kind: "percent", value: 10, isActive: true }).onConflictDoNothing();
for (const pg of home ? [home] : []) { await db.insert(s.pageBlocks).values([{ pageId: pg.id, sortOrder: 5, type: "collection_feature", data: { slug: "sample-evening-edit" } }, { pageId: pg.id, sortOrder: 6, type: "look_feature", data: { slug: "sample-city-after-dark" } }, { pageId: pg.id, sortOrder: 7, type: "editorial_rail", data: { title: "From the Journal", limit: 3 } }]); }
console.log("Seed complete (sample data). Dev admins: super@/uthy@/alomzie@verane.local — password from SEED_ADMIN_PASSWORD.");
