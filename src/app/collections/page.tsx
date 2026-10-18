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
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-9xl">Collections</h1>
      {list.length === 0 ? <EmptyState title="Collections are coming">Published collections will appear here.</EmptyState> :
        <div className="mt-12 grid gap-8 md:grid-cols-2">{list.map(({ collection: c, hero, brand }, i) => (
          <Link key={c.id} href={`/collections/${c.slug}`} data-brand={brand?.themeKey} className={`group ${i % 3 === 0 ? "md:col-span-2" : ""}`}>
            <div className={`overflow-hidden rounded-[var(--r-md)] bg-surface ${i % 3 === 0 ? "aspect-[21/9]" : "aspect-[4/5]"}`}>{hero ? <Media storageKey={hero.storageKey} alt={hero.altText ?? c.title} className="transition-transform duration-[1200ms] group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted">Imagery coming soon</div>}</div>
            <p className="mt-3 text-xs text-muted">{brand?.name ?? "VÉRANE"}</p><h2 className="display text-4xl md:text-5xl">{c.title}</h2></Link>))}</div>}
    </div>
  );
}
