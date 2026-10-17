import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { listCollections } from "@/domains/content/public";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Collections", alternates: { canonical: "/collections" } };
export const dynamic = "force-dynamic";

export default async function Collections() {
  const list = await listCollections(getDb());
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-index-intro flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="house-kicker">Curated by the house</p><h1 className="display mt-4 text-6xl md:text-9xl">Collections</h1></div><p className="max-w-sm text-sm leading-relaxed text-muted">Distinct moods, considered together. Explore the edits shaping each house.</p></div>
      {list.length === 0 ? <EmptyState title="Collections are coming">Published collections will appear here.</EmptyState> :
        <div className="mt-12 grid gap-x-6 gap-y-12 md:grid-cols-2">{list.map(({ collection: c, hero, brand }, i) => (
          <Link key={c.id} href={`/collections/${c.slug}`} data-brand={brand?.themeKey} className={`house-index-card group ${i % 3 === 0 ? "md:col-span-2" : ""}`}>
            <div className={`house-index-card__media relative overflow-hidden rounded-[var(--r-md)] bg-surface ${i % 3 === 0 ? "aspect-[21/9]" : "aspect-[4/5]"}`}>{hero ? <Media storageKey={hero.storageKey} alt={hero.altText ?? c.title} className="transition-transform duration-[1200ms] group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted">Campaign artwork coming soon</div>}<span className="glass absolute bottom-4 right-4 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em]">Explore edit ↗</span></div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted">{brand?.name ?? "VÉRANE"}</p><h2 className="display mt-2 text-4xl md:text-5xl transition-colors group-hover:text-accent">{c.title}</h2>{c.description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{c.description}</p>}</Link>))}</div>}
    </div>
  );
}
