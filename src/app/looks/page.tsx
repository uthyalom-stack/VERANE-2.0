import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { listLooks } from "@/domains/content/public";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Looks", alternates: { canonical: "/looks" } };
export const dynamic = "force-dynamic";
export default async function Looks({ searchParams }: { searchParams: Promise<{ brand?: string }> }) {
  const brand = (await searchParams).brand; const list = await listLooks(getDb(), brand);
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-index-intro flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="house-kicker">Styled by the house</p><h1 className="display mt-4 text-6xl md:text-9xl">Looks</h1></div><p className="max-w-sm text-sm leading-relaxed text-muted">Complete outfits, considered combinations, and pieces that work together.</p></div>
      <nav aria-label="Filter looks" className="mt-8 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">{[["", "All"], ["uthy-luxury", "UTHY LUXURY"], ["alomziee-footies", "ALOMZIEE FOOTIES"]].map(([s, l]) => <Link key={s} href={s ? `/looks?brand=${s}` : "/looks"} aria-current={(brand ?? "") === s ? "true" : undefined} className="rounded-full border border-line px-4 py-2.5 transition-colors hover:border-accent aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{l}</Link>)}</nav>
      {list.length === 0 ? <EmptyState title="No looks published yet" /> : <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{list.map(({ look, image, brand: b }, i) => (
        <Link key={look.id} href={`/looks/${look.slug}`} data-brand={b.themeKey} className="house-index-card group"><div className="house-index-card__media relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">{image ? <Media storageKey={image.storageKey} alt={image.altText ?? look.title} className="transition-transform duration-[1200ms] group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted">Look imagery coming soon</div>}<span className="glass absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.15em]">Look / {String(i + 1).padStart(2, "0")}</span></div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted">{b.name}</p><h2 className="display mt-2 text-3xl transition-colors group-hover:text-accent">{look.title}</h2>{look.description && <p className="mt-2 text-sm leading-relaxed text-muted">{look.description}</p>}</Link>))}</div>}
    </div>
  );
}
