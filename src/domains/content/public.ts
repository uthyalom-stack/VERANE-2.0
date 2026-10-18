import { and, asc, desc, eq, inArray, lte, or } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { brands, campaigns, collectionProducts, collections, inventoryLevels, journalArticles, lookItems, looks, mediaAssets, productVariants, products } from "@/infrastructure/db/schema";
import { publiclyVisible, toCardData } from "@/domains/catalog/public";

const live = (t: { status: unknown; publishAt?: unknown }, now: Date) =>
  or(eq(t.status as never, "published"), and(eq(t.status as never, "scheduled"), lte(t.publishAt as never, now)))!;

async function media(db: Db, ids: Array<string | null | undefined>) {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (!clean.length) return new Map<string, typeof mediaAssets.$inferSelect>();
  return new Map((await db.select().from(mediaAssets).where(inArray(mediaAssets.id, clean))).map((m) => [m.id, m]));
}

export async function listCollections(db: Db, now = new Date()) {
  const rows = await db.select().from(collections).where(live(collections, now)).orderBy(desc(collections.isFeatured), desc(collections.createdAt)).limit(60);
  const m = await media(db, rows.map((r) => r.heroMediaId)); const bs = new Map((await db.select().from(brands)).map((b) => [b.id, b]));
  return rows.map((c) => ({ collection: c, hero: c.heroMediaId ? m.get(c.heroMediaId) ?? null : null, brand: c.brandId ? bs.get(c.brandId) ?? null : null }));
}

export async function getCollection(db: Db, slug: string, now = new Date()) {
  const [c] = await db.select().from(collections).where(and(eq(collections.slug, slug), live(collections, now)));
  if (!c) return null;
  const rows = await db.select({ p: products }).from(collectionProducts).innerJoin(products, eq(products.id, collectionProducts.productId))
    .where(and(eq(collectionProducts.collectionId, c.id), publiclyVisible(now))).orderBy(asc(collectionProducts.sortOrder));
  const hero = (await media(db, [c.heroMediaId])).get(c.heroMediaId ?? "") ?? null;
  return { collection: c, hero, cards: await toCardData(db, rows.map((r) => r.p)) };
}

export async function listLooks(db: Db, brandSlug?: string, now = new Date()) {
  const where = [live(looks, now)];
  if (brandSlug) { const [b] = await db.select().from(brands).where(eq(brands.slug, brandSlug)); if (!b) return []; where.push(eq(looks.brandId, b.id)); }
  const rows = await db.select().from(looks).where(and(...where)).orderBy(asc(looks.sortOrder), desc(looks.createdAt)).limit(60);
  const m = await media(db, rows.map((r) => r.imageMediaId)); const bs = new Map((await db.select().from(brands)).map((b) => [b.id, b]));
  return rows.map((l) => ({ look: l, image: l.imageMediaId ? m.get(l.imageMediaId) ?? null : null, brand: bs.get(l.brandId)! }));
}

/** Look with its items resolved to *currently purchasable* variants; unavailable products are flagged, never silently dropped. */
export async function getLook(db: Db, slug: string, now = new Date()) {
  const [l] = await db.select().from(looks).where(and(eq(looks.slug, slug), live(looks, now)));
  if (!l) return null;
  const [brand] = await db.select().from(brands).where(eq(brands.id, l.brandId));
  const items = await db.select().from(lookItems).where(eq(lookItems.lookId, l.id)).orderBy(asc(lookItems.sortOrder));
  const ps = items.length ? await db.select().from(products).where(inArray(products.id, items.map((i) => i.productId))) : [];
  const cards = await toCardData(db, ps.filter((p) => p.status === "published" || (p.status === "scheduled" && !!p.publishAt && p.publishAt <= now)));
  const vs = ps.length ? await db.select({ v: productVariants, lv: inventoryLevels }).from(productVariants).leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id)).where(and(inArray(productVariants.productId, ps.map((p) => p.id)), eq(productVariants.isActive, true))).orderBy(asc(productVariants.sortOrder)) : [];
  const image = (await media(db, [l.imageMediaId])).get(l.imageMediaId ?? "") ?? null;
  return {
    look: l, brand: brand!, image,
    items: items.flatMap((i) => {
      const card = cards.find((c) => c.product.id === i.productId); if (!card) return [];
      const variants = vs.filter((x) => x.v.productId === i.productId).map(({ v, lv }) => ({ id: v.id, size: v.size, colorName: v.colorName, unitPrice: v.priceOverride ?? card.product.basePrice, available: lv ? lv.onHand - lv.reserved : 0, allowBackorder: lv?.allowBackorder ?? false }));
      return [{ item: i, card, variants }];
    }),
  };
}

export async function listArticles(db: Db, opts: { kind?: string; brandSlug?: string; limit?: number } = {}, now = new Date()) {
  const where = [live(journalArticles, now)];
  if (opts.kind) where.push(eq(journalArticles.kind, opts.kind as never));
  const rows = await db.select().from(journalArticles).where(and(...where)).orderBy(desc(journalArticles.publishAt), desc(journalArticles.createdAt)).limit(Math.min(opts.limit ?? 30, 60));
  const m = await media(db, rows.map((r) => r.coverMediaId));
  return rows.map((a) => ({ article: a, cover: a.coverMediaId ? m.get(a.coverMediaId) ?? null : null }));
}

export type ArticleBlock = { type: "paragraph" | "heading" | "quote" | "image" | "product_embed" | "look_embed" | "collection_embed"; text?: string; mediaId?: string; alt?: string; refId?: string; slug?: string; cite?: string };
export async function getArticle(db: Db, slug: string, now = new Date()) {
  const [a] = await db.select().from(journalArticles).where(and(eq(journalArticles.slug, slug), live(journalArticles, now)));
  if (!a) return null;
  const blocks = (a.body ?? []) as ArticleBlock[];
  const m = await media(db, [a.coverMediaId, a.videoMediaId, ...blocks.map((b) => b.mediaId)]);
  const productIds = blocks.filter((b) => b.type === "product_embed" && b.refId).map((b) => b.refId!);
  const embeds = productIds.length ? await toCardData(db, await db.select().from(products).where(and(inArray(products.id, productIds), publiclyVisible(now)))) : [];
  const lookSlugs = blocks.filter((b) => b.type === "look_embed" && b.slug).map((b) => b.slug!);
  const embeddedLooks = lookSlugs.length ? (await listLooks(db)).filter((x) => lookSlugs.includes(x.look.slug)) : [];
  const colSlugs = blocks.filter((b) => b.type === "collection_embed" && b.slug).map((b) => b.slug!);
  const embeddedCollections = colSlugs.length ? (await listCollections(db)).filter((x) => colSlugs.includes(x.collection.slug)) : [];
  return { article: a, blocks, media: m, embeds, embeddedLooks, embeddedCollections };
}

/** Same-brand, same-type neighbours first, then same brand. Real catalog rows only. */
export async function relatedProducts(db: Db, p: typeof products.$inferSelect, limit = 4) {
  const rows = await db.select().from(products).where(and(eq(products.brandId, p.brandId), publiclyVisible(), p.productType ? eq(products.productType, p.productType) : undefined)).limit(limit + 1);
  const same = rows.filter((r) => r.id !== p.id);
  const more = same.length < limit ? (await db.select().from(products).where(and(eq(products.brandId, p.brandId), publiclyVisible())).limit(limit + 4)).filter((r) => r.id !== p.id && !same.some((s) => s.id === r.id)) : [];
  return toCardData(db, [...same, ...more].slice(0, limit));
}
export async function looksForProduct(db: Db, productId: string, now = new Date()) {
  const rows = await db.select({ l: looks }).from(lookItems).innerJoin(looks, eq(looks.id, lookItems.lookId)).where(and(eq(lookItems.productId, productId), live(looks, now))).limit(3);
  const m = await media(db, rows.map((r) => r.l.imageMediaId));
  return rows.map((r) => ({ look: r.l, image: r.l.imageMediaId ? m.get(r.l.imageMediaId) ?? null : null }));
}

/** A campaign is active when published and inside its optional start/end window. Returns desktop, mobile and poster media. */
export async function getActiveCampaign(db: Db, slug: string, now = new Date()) {
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.slug, slug), eq(campaigns.status, "published")));
  if (!c || (c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) return null;
  const m = await media(db, [c.heroMediaId, c.heroMobileMediaId, c.posterMediaId]);
  const g = (id: string | null) => (id ? m.get(id) ?? null : null);
  return { campaign: c, hero: g(c.heroMediaId), mobile: g(c.heroMobileMediaId), poster: g(c.posterMediaId) };
}
