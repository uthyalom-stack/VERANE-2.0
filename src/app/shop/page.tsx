import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/server";
import { brands } from "@/infrastructure/db/schema";
import { getSiteConfig } from "@/domains/site-content";
import { listAvailableFacets, listShopProducts, toCardData } from "@/domains/catalog/public";
import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Shop", alternates: { canonical: "/shop" } };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const flat = (sp: SP): Record<string, string> => {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(sp)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string" && first.length > 0) entries.push([key, first]);
  }
  return Object.fromEntries(entries);
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = flat(await searchParams);
  const db = getDb();
  const [{ items, hasMore, query }, facets, brandRows, siteConfig] = await Promise.all([listShopProducts(db, sp), listAvailableFacets(db), db.select({ slug: brands.slug, name: brands.name }).from(brands).where(eq(brands.isActive, true)), getSiteConfig(db)]);
  const cards = await toCardData(db, items);
  const href = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (value) u.set(key, value);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") u.delete(key);
      else u.set(key, value);
    }
    if (!("page" in patch)) u.delete("page");
    const queryString = u.toString();
    return queryString ? `/shop?${queryString}` : "/shop";
  };
  const pretty = (v: string) => {
    const labels: Record<string, string> = { ...Object.fromEntries(brandRows.map((b) => [b.slug, b.name])), in_stock: "In stock", true: "Yes" };
    return labels[v] ?? v.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const priceRanges = [
    { label: "Under ₦25,000", minPrice: undefined, maxPrice: "2499999" },
    { label: "₦25,000–₦49,999", minPrice: "2500000", maxPrice: "4999999" },
    { label: "₦50,000–₦99,999", minPrice: "5000000", maxPrice: "9999999" },
    { label: "₦100,000+", minPrice: "10000000", maxPrice: undefined },
  ];
  const selectedPriceRange = priceRanges.find((range) => (sp.minPrice ?? "") === (range.minPrice ?? "") && (sp.maxPrice ?? "") === (range.maxPrice ?? ""));
  const activeFilterKeys = ["brand", "type", "style", "occasion", "size", "color", "availability", "sale", "featured"].filter((key) => Boolean(sp[key]) && sp[key] !== "false");
  if (sp.minPrice || sp.maxPrice) activeFilterKeys.push("price");
  const activeFilterLabels: Record<string, string> = { brand: "Brand", type: "Type", style: "Style", occasion: "Occasion", size: "Size", color: "Colour", availability: "Availability", sale: "On sale", featured: "Featured only", price: "Price" };
  const activeFilterLabel = (key: string) => activeFilterLabels[key] ?? key;
  const activeFilterValue = (key: string) => key === "price" ? (selectedPriceRange?.label ?? "Custom range") : pretty(sp[key]!);
  const priceFilter = (
    <div role="group" aria-label="Price range" className="house-filter-group mb-7 border-b border-line pb-6">
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">Price / NGN</p>
      <div className="flex flex-wrap gap-2">
        {priceRanges.map((range) => {
          const selected = (sp.minPrice ?? "") === (range.minPrice ?? "") && (sp.maxPrice ?? "") === (range.maxPrice ?? "");
          return <Link key={range.label} href={href({ minPrice: range.minPrice, maxPrice: range.maxPrice })} aria-current={selected && (sp.minPrice || sp.maxPrice) ? "true" : undefined} className="house-filter-chip min-h-9 rounded-full border border-line px-3.5 py-2 text-xs transition-colors aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{range.label}</Link>;
        })}
      </div>
    </div>
  );
  const group = (label: string, key: string, values: string[]) => values.length === 0 ? null : (
    <div role="group" aria-label={label} className="house-filter-group mb-7 border-b border-line pb-6"><p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{values.map((v) => (
        <Link key={v} href={href({ [key]: sp[key] === v ? undefined : v })} aria-current={sp[key] === v ? "true" : undefined} className="house-filter-chip min-h-9 rounded-full border border-line px-3.5 py-2 text-xs transition-colors aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{pretty(v)}</Link>))}</div></div>);
  const toggleFilter = (label: string, key: "sale" | "featured") => (
    <div role="group" aria-label={label} className="house-filter-group mb-7 border-b border-line pb-6">
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ [key]: sp[key] === "true" ? undefined : "true" })} aria-current={sp[key] === "true" ? "true" : undefined} className="house-filter-chip min-h-9 rounded-full border border-line px-3.5 py-2 text-xs transition-colors aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">
          {key === "sale" ? "On sale" : "Featured only"}
        </Link>
      </div>
    </div>
  );
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-shop-intro relative overflow-hidden rounded-[var(--r-lg)] border border-line px-6 py-10 md:px-10 md:py-14">
        <div className="house-shop-intro__glow" aria-hidden="true" />
        <p className="house-kicker relative">{siteConfig.settings.siteName} edit / Shop all</p>
        <div className="relative mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="display max-w-[9ch] text-6xl md:text-8xl">Find your next statement.</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted">Discover the latest pieces, styles and considered essentials from the catalogue.</p>
        </div>
        <div className="glass relative mt-8 inline-flex items-center gap-3 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em]"><span className="size-1.5 rounded-full bg-accent" /> Two brands. One expression.</div>
      </div>
      <div className="mt-10 grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-12">
        <aside aria-label="Filters" className="house-shop-filters md:sticky md:top-24 md:self-start">
          <details className="mb-7 rounded-[var(--r-md)] border border-line p-4 md:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] [&::-webkit-details-marker]:hidden">
              <span>Refine the edit</span>
              <span className="flex items-center gap-3 text-muted">{activeFilterKeys.length ? `${activeFilterKeys.length} active` : "Filters"} <span aria-hidden="true">＋</span></span>
            </summary>
            <div className="mt-5">
              {activeFilterKeys.length > 0 && <Link href="/shop" className="mb-5 inline-flex min-h-10 items-center text-xs underline underline-offset-4">Clear all filters</Link>}
              {group("Brand", "brand", ["uthy-luxury", "alomziee-footies"])}
              {group("Type", "type", facets.types)}{group("Style", "style", facets.styles)}{group("Occasion", "occasion", facets.occasions)}
              {group("Size", "size", facets.sizes)}{group("Colour", "color", facets.colors)}
              {priceFilter}
              {group("Availability", "availability", ["in_stock"])}
              {toggleFilter("Offers", "sale")}
              {toggleFilter("Discovery", "featured")}
            </div>
          </details>
          <div className="hidden md:block">
            <div className="mb-5 flex items-center justify-between"><p className="house-kicker">Refine the edit</p>{activeFilterKeys.length > 0 && <Link href="/shop" className="text-xs text-muted underline underline-offset-4">Clear all</Link>}</div>
            {group("Brand", "brand", ["uthy-luxury", "alomziee-footies"])}
            {group("Type", "type", facets.types)}{group("Style", "style", facets.styles)}{group("Occasion", "occasion", facets.occasions)}
            {group("Size", "size", facets.sizes)}{group("Colour", "color", facets.colors)}
            {priceFilter}
            {group("Availability", "availability", ["in_stock"])}
            {toggleFilter("Offers", "sale")}
            {toggleFilter("Discovery", "featured")}
          </div>
        </aside>
        <section aria-live="polite">
          <div className="house-shop-toolbar mb-6 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs uppercase tracking-[0.14em] text-muted">{cards.length} pieces shown <span className="mx-2 opacity-40">/</span> Page {query.page}</span>
            <nav aria-label="Sort" className="flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.1em]">{(["featured", "newest", "price_asc", "price_desc"] as const).map((s) => (
              <Link key={s} href={href({ sort: s })} aria-current={query.sort === s ? "true" : undefined} className="text-muted transition-colors hover:text-fg aria-[current=true]:text-accent aria-[current=true]:underline aria-[current=true]:underline-offset-4">{{ featured: "Featured", newest: "Newest", price_asc: "Price ↑", price_desc: "Price ↓" }[s]}</Link>))}</nav></div>
          {activeFilterKeys.length > 0 && <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Active filters">
            <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-muted">Applied</span>
            {activeFilterKeys.map((key) => <Link key={key} href={key === "price" ? href({ minPrice: undefined, maxPrice: undefined }) : href({ [key]: undefined })} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line px-3 py-2 text-xs transition-colors hover:border-accent hover:text-accent"><span>{activeFilterLabel(key)}: {activeFilterValue(key)}</span><span aria-hidden="true">×</span><span className="sr-only">Remove {activeFilterLabel(key)} filter</span></Link>)}
            <Link href="/shop" className="ml-1 min-h-9 px-2 py-2 text-xs text-muted underline underline-offset-4">Clear all</Link>
          </div>}
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
