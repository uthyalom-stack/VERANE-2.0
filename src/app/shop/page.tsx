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
  const pretty = (v: string) => {
    const labels: Record<string, string> = { "uthy-luxury": "UTHY LUXURY", "alomziee-footies": "ALOMZIEE FOOTIES", in_stock: "In stock" };
    return labels[v] ?? v.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const group = (label: string, key: string, values: string[]) => values.length === 0 ? null : (
    <fieldset className="house-filter-group mb-7 border-b border-line pb-6"><legend className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">{values.map((v) => (
        <Link key={v} href={href({ [key]: sp[key] === v ? undefined : v })} aria-pressed={sp[key] === v} className="house-filter-chip min-h-9 rounded-full border border-line px-3.5 py-2 text-xs transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg">{pretty(v)}</Link>))}</div></fieldset>);
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-shop-intro relative overflow-hidden rounded-[var(--r-lg)] border border-line px-6 py-10 md:px-10 md:py-14">
        <div className="house-shop-intro__glow" aria-hidden="true" />
        <p className="house-kicker relative">The VÉRANE edit / Shop all</p>
        <div className="relative mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="display max-w-[9ch] text-6xl md:text-8xl">Find your next statement.</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted">Considered essentials from UTHY LUXURY. Expressive pieces from ALOMZIEE FOOTIES. Make them yours.</p>
        </div>
        <div className="glass relative mt-8 inline-flex items-center gap-3 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em]"><span className="size-1.5 rounded-full bg-accent" /> Two brands. One expression.</div>
      </div>
      <div className="mt-10 grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-12">
        <aside aria-label="Filters" className="house-shop-filters md:sticky md:top-24 md:self-start">
          <div className="mb-5 flex items-center justify-between"><p className="house-kicker">Refine the edit</p>{Object.values(sp).some(Boolean) && <Link href="/shop" className="text-xs text-muted underline underline-offset-4">Clear all</Link>}</div>
          {group("Brand", "brand", ["uthy-luxury", "alomziee-footies"])}
          {group("Type", "type", facets.types)}{group("Style", "style", facets.styles)}{group("Occasion", "occasion", facets.occasions)}
          {group("Size", "size", facets.sizes)}{group("Colour", "color", facets.colors)}
          {group("Availability", "availability", ["in_stock"])}
        </aside>
        <section aria-live="polite">
          <div className="house-shop-toolbar mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs uppercase tracking-[0.14em] text-muted">{cards.length} pieces shown <span className="mx-2 opacity-40">/</span> Page {query.page}</span>
            <nav aria-label="Sort" className="flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.1em]">{(["featured", "newest", "price_asc", "price_desc"] as const).map((s) => (
              <Link key={s} href={href({ sort: s })} aria-current={query.sort === s ? "true" : undefined} className="text-muted transition-colors hover:text-fg aria-[current=true]:text-accent aria-[current=true]:underline aria-[current=true]:underline-offset-4">{{ featured: "Featured", newest: "Newest", price_asc: "Price ↑", price_desc: "Price ↓" }[s]}</Link>))}</nav></div>
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
