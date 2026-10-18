import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/server";
import { products } from "@/infrastructure/db/schema";
import { createSqliteSearchService } from "@/domains/search";
import { toCardData } from "@/domains/catalog/public";
import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { trackServer } from "@/lib/http/track";

export const metadata: Metadata = { title: "Search", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 100).trim();
  const db = getDb();
  let cards: Awaited<ReturnType<typeof toCardData>> = [];
  if (q) {
    void trackServer({ name: "search", props: { len: q.length } }); // query text is deliberately NOT stored (may contain personal data)
    const { productIds } = await createSqliteSearchService(db).searchProducts(q);
    const rows = productIds.length ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
    const order = new Map(productIds.map((id, i) => [id, i]));
    cards = await toCardData(db, rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
  }
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-8xl">Search</h1>
      <form role="search" action="/search" className="mt-8 flex max-w-2xl gap-3">
        <label htmlFor="q" className="sr-only">Search the house</label>
        <input id="q" name="q" defaultValue={q} autoFocus placeholder="Black dress, sneakers, wool coat" className="min-h-12 flex-1 rounded-[var(--r-sm)] border border-line bg-surface px-4 placeholder:text-muted" />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-12" aria-live="polite">
        {!q ? <p className="text-muted">Search by name, type, style or occasion.</p>
          : cards.length === 0 ? <EmptyState title={`No results for “${q}”`}>Check the spelling or try a broader word like “dress” or “sneaker”.</EmptyState>
          : <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{cards.map((c) => <ProductCard key={c.product.id} item={c} />)}</div>}
      </div>
    </div>
  );
}
