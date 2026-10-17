import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { campaigns, journalArticles, lookItems, looks, pageBlocks, pages, products } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { assertCan, type Actor } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { brandScopeWhere } from "./scope";

const status = z.enum(["draft", "scheduled", "published", "archived"]).default("draft");
const href = z.string().max(300).refine((s) => s === "" || /^\/(?!\/)/.test(s) || /^https:\/\//.test(s), "Use a path like /shop or an https:// link");
const nullableDate = z.coerce.date().nullable().optional();
const optId = z.string().nullable().optional().transform((s) => s || null);
async function guard(actor: Actor, perm: "content.write", existingBrand: string | null | undefined, newBrand: string | null) { if (existingBrand !== undefined) assertCan(actor, perm, existingBrand); assertCan(actor, perm, newBrand); }
const dupe = (e: unknown, msg: string) => { if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", msg); throw e; };

/* ---------- Looks ---------- */
const lookSchema = z.object({ brandId: z.string().min(1), title: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), description: z.string().max(2000).nullable().optional(), stylingNotes: z.string().max(1000).nullable().optional(), imageMediaId: optId, status, publishAt: nullableDate, sortOrder: z.coerce.number().int().default(0), seoTitle: z.string().max(70).nullable().optional(), seoDescription: z.string().max(170).nullable().optional() });
export async function saveLook(db: Db, actor: Actor, raw: unknown, id?: string) {
  let existingBrand: string | null | undefined;
  if (id) { const [ex] = await db.select().from(looks).where(eq(looks.id, id)); if (!ex) throw new AppError("NOT_FOUND", "Look not found"); existingBrand = ex.brandId; }
  const candidateBrandId = raw && typeof raw === "object" && "brandId" in raw && typeof (raw as { brandId?: unknown }).brandId === "string"
    ? (raw as { brandId: string }).brandId
    : null;
  if (existingBrand !== undefined) assertCan(actor, "content.write", existingBrand);
  assertCan(actor, "content.write", candidateBrandId);
  const l = lookSchema.parse(raw);
  const row = { brandId: l.brandId, title: l.title, slug: l.slug ?? slugify(l.title), description: l.description ?? null, stylingNotes: l.stylingNotes ?? null, imageMediaId: l.imageMediaId, status: l.status, publishAt: l.publishAt ?? null, sortOrder: l.sortOrder, seoTitle: l.seoTitle ?? null, seoDescription: l.seoDescription ?? null };
  try { if (id) await db.update(looks).set(row).where(eq(looks.id, id)); else id = (await db.insert(looks).values(row).returning())[0]!.id; } catch (e) { dupe(e, "A look with that slug exists"); }
  await writeAudit(db, { actorUserId: actor.userId, action: "look.save", entityType: "look", entityId: id!, brandId: l.brandId, after: row });
  return id!;
}
export async function setLookItems(db: Db, actor: Actor, lookId: string, items: Array<{ productId: string; variantId?: string | null; stylingNote?: string | null }>) {
  const [l] = await db.select().from(looks).where(eq(looks.id, lookId)); if (!l) throw new AppError("NOT_FOUND", "Look not found");
  assertCan(actor, "content.write", l.brandId);
  for (const it of items) { const [p] = await db.select().from(products).where(eq(products.id, it.productId)); if (!p || p.brandId !== l.brandId) throw new AppError("VALIDATION", "Looks can only contain products from their own brand"); }
  await db.transaction(async (tx) => { await tx.delete(lookItems).where(eq(lookItems.lookId, lookId)); for (const [i, it] of items.entries()) await tx.insert(lookItems).values({ lookId, productId: it.productId, variantId: it.variantId || null, stylingNote: it.stylingNote ?? null, sortOrder: i }); });
  await writeAudit(db, { actorUserId: actor.userId, action: "look.items", entityType: "look", entityId: lookId, brandId: l.brandId, after: items });
}
export const listLooksAdmin = (db: Db, actor: Actor) => db.select().from(looks).where(brandScopeWhere(actor, "content.write", looks.brandId)).orderBy(desc(looks.updatedAt));

/* ---------- Campaigns ---------- */
const campSchema = z.object({ brandId: optId, title: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), subtitle: z.string().max(200).nullable().optional(), heroMediaId: optId, heroMobileMediaId: optId, posterMediaId: optId, ctaLabel: z.string().max(40).nullable().optional(), ctaHref: href.nullable().optional(), status, startsAt: nullableDate, endsAt: nullableDate, seoTitle: z.string().max(70).nullable().optional(), seoDescription: z.string().max(170).nullable().optional() });
export async function saveCampaign(db: Db, actor: Actor, raw: unknown, id?: string) {
  const c = campSchema.parse(raw); let ex: string | null | undefined;
  if (id) { const [r] = await db.select().from(campaigns).where(eq(campaigns.id, id)); if (!r) throw new AppError("NOT_FOUND", "Campaign not found"); ex = r.brandId; }
  await guard(actor, "content.write", ex, c.brandId);
  const row = { brandId: c.brandId, title: c.title, slug: c.slug ?? slugify(c.title), subtitle: c.subtitle ?? null, heroMediaId: c.heroMediaId, heroMobileMediaId: c.heroMobileMediaId, posterMediaId: c.posterMediaId, ctaLabel: c.ctaLabel ?? null, ctaHref: c.ctaHref || null, status: c.status, startsAt: c.startsAt ?? null, endsAt: c.endsAt ?? null, seoTitle: c.seoTitle ?? null, seoDescription: c.seoDescription ?? null };
  try { if (id) await db.update(campaigns).set(row).where(eq(campaigns.id, id)); else id = (await db.insert(campaigns).values(row).returning())[0]!.id; } catch (e) { dupe(e, "A campaign with that slug exists"); }
  await writeAudit(db, { actorUserId: actor.userId, action: "campaign.save", entityType: "campaign", entityId: id!, brandId: c.brandId, after: row });
}
export const listCampaignsAdmin = (db: Db, actor: Actor) => db.select().from(campaigns).where(brandScopeWhere(actor, "content.write", campaigns.brandId)).orderBy(desc(campaigns.updatedAt));

/* ---------- Journal ---------- */
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(5000) }), z.object({ type: z.literal("heading"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("quote"), text: z.string().min(1).max(600), cite: z.string().max(120).optional() }),
  z.object({ type: z.literal("image"), mediaId: z.string().min(1), alt: z.string().max(200).optional() }),
  z.object({ type: z.literal("product_embed"), refId: z.string().min(1) }), z.object({ type: z.literal("look_embed"), slug: z.string().min(1) }), z.object({ type: z.literal("collection_embed"), slug: z.string().min(1) }),
]);
const artSchema = z.object({ brandId: optId, title: z.string().trim().min(2).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), kind: z.enum(["story", "interview", "lookbook", "styling_guide", "film", "brand_story", "collaboration"]), excerpt: z.string().max(400).nullable().optional(), coverMediaId: optId, videoMediaId: optId, authorName: z.string().max(80).nullable().optional(), status, publishAt: nullableDate, seoTitle: z.string().max(70).nullable().optional(), seoDescription: z.string().max(170).nullable().optional(), body: z.array(blockSchema).max(200) });
export async function saveArticle(db: Db, actor: Actor, raw: unknown, id?: string) {
  const a = artSchema.parse(raw); let ex: string | null | undefined;
  if (id) { const [r] = await db.select().from(journalArticles).where(eq(journalArticles.id, id)); if (!r) throw new AppError("NOT_FOUND", "Article not found"); ex = r.brandId; }
  await guard(actor, "content.write", ex, a.brandId);
  const row = { brandId: a.brandId, title: a.title, slug: a.slug ?? slugify(a.title), kind: a.kind, excerpt: a.excerpt ?? null, coverMediaId: a.coverMediaId, videoMediaId: a.videoMediaId, authorName: a.authorName ?? null, status: a.status, publishAt: a.publishAt ?? null, seoTitle: a.seoTitle ?? null, seoDescription: a.seoDescription ?? null, body: a.body as Array<Record<string, unknown>> };
  try { if (id) await db.update(journalArticles).set(row).where(eq(journalArticles.id, id)); else id = (await db.insert(journalArticles).values(row).returning())[0]!.id; } catch (e) { dupe(e, "An article with that slug exists"); }
  await writeAudit(db, { actorUserId: actor.userId, action: "article.save", entityType: "article", entityId: id!, brandId: a.brandId });
  return id!;
}
export const listArticlesAdmin = (db: Db, actor: Actor) => db.select().from(journalArticles).where(brandScopeWhere(actor, "content.write", journalArticles.brandId)).orderBy(desc(journalArticles.updatedAt));

/* ---------- Pages & block editor (homepage and brand landings) ---------- */
export const BLOCK_SCHEMAS = {
  hero: z.object({ title: z.string().max(120), subtitle: z.string().max(240).optional(), ctaLabel: z.string().max(40).optional(), ctaHref: href.optional(), mediaKey: z.string().optional() }),
  campaign_hero: z.object({ slug: z.string().min(1) }),
  brand_intro: z.object({}), outfit_builder_intro: z.object({}), newsletter: z.object({}),
  product_rail: z.object({ title: z.string().max(80), source: z.enum(["newest", "featured", "discounted"]), limit: z.coerce.number().int().min(1).max(24) }),
  collection_feature: z.object({ slug: z.string().min(1) }), look_feature: z.object({ slug: z.string().min(1) }),
  editorial_rail: z.object({ title: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(6) }),
  promo: z.object({ title: z.string().max(120), body: z.string().max(300).optional(), ctaLabel: z.string().max(40).optional(), ctaHref: href.optional() }),
} as const;
export type BlockType = keyof typeof BLOCK_SCHEMAS;

export async function getOrCreateHome(db: Db, actor: Actor) {
  assertCan(actor, "content.write", null); // the house homepage is a global resource
  const [p] = await db.select().from(pages).where(and(eq(pages.kind, "home"), isNull(pages.brandId)));
  if (p) return p;
  return (await db.insert(pages).values({ kind: "home", slug: "", title: "VÉRANE", status: "draft" }).returning())[0]!;
}
/** Replaces the page's blocks atomically after validating every block against its schema; unknown types are rejected. */
export async function savePageBlocks(db: Db, actor: Actor, pageId: string, input: { status: "draft" | "published"; blocks: Array<{ type: string; data: unknown; isVisible?: boolean }> }) {
  const [p] = await db.select().from(pages).where(eq(pages.id, pageId)); if (!p) throw new AppError("NOT_FOUND", "Page not found");
  assertCan(actor, "content.write", p.brandId);
  const clean = input.blocks.map((b) => {
    const s = BLOCK_SCHEMAS[b.type as BlockType];
    if (!s) throw new AppError("VALIDATION", `Unknown block type: ${b.type}`);
    try {
      return { type: b.type, data: s.parse(b.data ?? {}) as Record<string, unknown>, isVisible: b.isVisible ?? true };
    } catch (error) {
      if (error instanceof z.ZodError) throw new AppError("VALIDATION", error.issues[0]?.message ?? "Invalid page block data");
      throw error;
    }
  });
  await db.transaction(async (tx) => { await tx.delete(pageBlocks).where(eq(pageBlocks.pageId, pageId)); for (const [i, b] of clean.entries()) await tx.insert(pageBlocks).values({ pageId, sortOrder: i, type: b.type, data: b.data, isVisible: b.isVisible }); await tx.update(pages).set({ status: input.status }).where(eq(pages.id, pageId)); });
  await writeAudit(db, { actorUserId: actor.userId, action: "page.blocks", entityType: "page", entityId: pageId, brandId: p.brandId, after: { status: input.status, blocks: clean.length } });
}
