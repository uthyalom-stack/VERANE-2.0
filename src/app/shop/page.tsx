import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/server";
import { listAvailableFacets, listShopProducts, toCardData } from "@/domains/catalog/public";
import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Shop", alternates: { canonical: "/shop" } };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const flat = (sp: SP) => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = flat(await searchParams);
  const db = getDb();
  const [{ items, hasMore, query }, facets] = await Promise.all([listShopProducts(db, sp), listAvailableFacets(db)]);
  const cards = await toCardData(db, items);
  const href = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams({ ...sp, ...patch } as Record<string, string>);
    for (const [k, v] of [...u]) if (!v) u.delete(k);
    if (!("page" in patch)) u.delete("page");
    return `/shop?${u}`;
  };
  const group = (label: string, key: string, values: string[]) => values.length === 0 ? null : (
    <fieldset className="mb-6"><legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">{values.map((v) => (
        <Link key={v} href={href({ [key]: sp[key] === v ? undefined : v })} aria-pressed={sp[key] === v} className="min-h-9 rounded-full border border-line px-4 py-1.5 text-sm aria-pressed:bg-accent aria-pressed:text-accent-fg">{v}</Link>))}</div></fieldset>);
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-8xl">Shop</h1>
      <div className="mt-10 grid gap-10 md:grid-cols-[240px_1fr]">
        <aside aria-label="Filters">
          {group("Brand", "brand", ["uthy-luxury", "alomziee-footies"])}
          {group("Type", "type", facets.types)}{group("Style", "style", facets.styles)}{group("Occasion", "occasion", facets.occasions)}
          {group("Size", "size", facets.sizes)}{group("Colour", "color", facets.colors)}
          {group("Availability", "availability", ["in_stock"])}
        </aside>
        <section aria-live="polite">
          <div className="mb-6 flex items-center justify-between text-sm"><span className="text-muted">{cards.length} shown</span>
            <nav aria-label="Sort" className="flex gap-4">{(["featured", "newest", "price_asc", "price_desc"] as const).map((s) => (
              <Link key={s} href={href({ sort: s })} aria-current={query.sort === s ? "true" : undefined} className="text-muted aria-[current=true]:text-fg aria-[current=true]:underline">{{ featured: "Featured", newest: "Newest", price_asc: "Price low", price_desc: "Price high" }[s]}</Link>))}</nav></div>
          {cards.length === 0 ? <EmptyState title="Nothing matches those filters">Remove a filter to see more of the house.</EmptyState> : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">{cards.map((c) => <ProductCard key={c.product.id} item={c} />)}</div>)}
          <div className="mt-12 flex justify-between text-sm">
            {query.page > 1 ? <Link href={href({ page: String(query.page - 1) })} className="underline">Previous</Link> : <span />}
            {hasMore && <Link href={href({ page: String(query.page + 1) })} className="underline">Next</Link>}</div>
        </section>
      </div>
    </div>
  );
}
