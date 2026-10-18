import type { MetadataRoute } from "next";
import { getDb } from "@/lib/server";
import { brands } from "@/infrastructure/db/schema";
import { listShopProducts } from "@/domains/catalog/public";
import { listArticles, listCollections, listLooks } from "@/domains/content/public";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const db = getDb(); const bs = await db.select().from(brands); const bySlug = new Map(bs.map((b) => [b.id, b.slug]));
  const out: MetadataRoute.Sitemap = [{ url: base }, ...["/shop", "/collections", "/looks", "/journal", "/outfit-builder"].map((p) => ({ url: `${base}${p}` })), ...bs.map((b) => ({ url: `${base}/brands/${b.slug}` }))];
  for (let page = 1; page <= 50; page++) { // bounded
    const r = await listShopProducts(db, { page, pageSize: 48 });
    out.push(...r.items.map((p) => ({ url: `${base}/product/${p.slug}?brand=${bySlug.get(p.brandId)}`, lastModified: p.updatedAt })));
    if (!r.hasMore) break;
  }
  out.push(...(await listCollections(db)).map((c) => ({ url: `${base}/collections/${c.collection.slug}`, lastModified: c.collection.updatedAt })));
  out.push(...(await listLooks(db)).map((l) => ({ url: `${base}/looks/${l.look.slug}`, lastModified: l.look.updatedAt })));
  out.push(...(await listArticles(db)).map((a) => ({ url: `${base}/journal/${a.article.slug}`, lastModified: a.article.updatedAt })));
  return out;
}
