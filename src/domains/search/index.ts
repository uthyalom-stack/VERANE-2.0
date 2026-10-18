import { sql } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { products } from "@/infrastructure/db/schema";
import { publiclyVisible } from "@/domains/catalog/public";
import { and, inArray } from "drizzle-orm";

export type SearchResult = { productIds: string[]; engine: "fts5" | "like" };

/** UI depends on this interface only; an NL/AI implementation can replace it later without UI changes. */
export interface SearchService {
  searchProducts(query: string, opts?: { brandSlug?: string; limit?: number }): Promise<SearchResult>;
}

/** Turn arbitrary user text into a safe FTS5 prefix query: alphanumerics only, quoted tokens. */
export function toFtsQuery(input: string): string | null {
  const tokens = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]{2,}/g)?.slice(0, 8) ?? [];
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(" AND ") : null;
}

export function createSqliteSearchService(db: Db): SearchService {
  return {
    async searchProducts(query, opts = {}) {
      const fts = toFtsQuery(query);
      if (!fts) return { productIds: [], engine: "fts5" };
      const limit = Math.min(opts.limit ?? 24, 48);
      let ids: string[];
      let engine: "fts5" | "like" = "fts5";
      try {
        const res = await db.all<{ product_id: string }>(sql`SELECT product_id FROM product_search WHERE product_search MATCH ${fts} ORDER BY bm25(product_search, 0, 0, 10, 4, 2, 2, 1, 1, 1) LIMIT ${limit * 2}`);
        ids = res.map((r) => r.product_id);
      } catch {
        engine = "like"; // FTS table missing (migrations not fully applied): degrade, don't break browsing
        const like = `%${query.replace(/[%_]/g, "")}%`;
        ids = (await db.select({ id: products.id }).from(products).where(sql`${products.name} LIKE ${like}`).limit(limit * 2)).map((r) => r.id);
      }
      if (!ids.length) return { productIds: [], engine };
      // Visibility is re-checked against the primary table so drafts never leak through the index.
      const visible = await db.select({ id: products.id }).from(products).where(and(inArray(products.id, ids), publiclyVisible()));
      const ok = new Set(visible.map((v) => v.id));
      return { productIds: ids.filter((i) => ok.has(i)).slice(0, limit), engine };
    },
  };
}

/** Rebuild one product's index row. Called after product writes and by the seed script. */
export async function reindexProduct(db: Db, productId: string): Promise<void> {
  await db.run(sql`DELETE FROM product_search WHERE product_id = ${productId}`);
  await db.run(sql`INSERT INTO product_search (product_id, brand_id, name, subtitle, description, product_type, style, occasion, categories)
    SELECT p.id, p.brand_id, p.name, coalesce(p.subtitle,''), coalesce(p.description,''), coalesce(p.product_type,''), coalesce(p.style,''), coalesce(p.occasion,''),
      coalesce((SELECT group_concat(c.name, ' ') FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id), '')
    FROM products p WHERE p.id = ${productId}`);
}
