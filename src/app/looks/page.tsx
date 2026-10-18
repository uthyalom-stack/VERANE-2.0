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
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-9xl">Looks</h1>
      <nav aria-label="Filter looks" className="mt-6 flex gap-3 text-sm">{[["", "All"], ["uthy-luxury", "UTHY LUXURY"], ["alomziee-footies", "ALOMZIEE FOOTIES"]].map(([s, l]) => <Link key={s} href={s ? `/looks?brand=${s}` : "/looks"} aria-current={(brand ?? "") === s ? "true" : undefined} className="rounded-full border border-line px-4 py-2 aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{l}</Link>)}</nav>
      {list.length === 0 ? <EmptyState title="No looks published yet" /> : <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{list.map(({ look, image, brand: b }) => (
        <Link key={look.id} href={`/looks/${look.slug}`} data-brand={b.themeKey} className="group"><div className="aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">{image && <Media storageKey={image.storageKey} alt={image.altText ?? look.title} className="transition-transform duration-[1200ms] group-hover:scale-105" />}</div>
          <p className="mt-3 text-xs text-muted">{b.name}</p><h2 className="display text-3xl">{look.title}</h2></Link>))}</div>}
    </div>
  );
}
