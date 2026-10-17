import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getCollection } from "@/domains/content/public";
import { brands } from "@/infrastructure/db/schema";
import { ProductCard } from "@/components/commerce/product-card";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty-state";
import { getSiteConfig } from "@/domains/site-content";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = await getCollection(getDb(), (await params).slug); if (!c) return {};
  return { title: c.collection.seoTitle ?? c.collection.title, description: c.collection.seoDescription ?? c.collection.description ?? undefined, alternates: { canonical: `/collections/${c.collection.slug}` } };
}
export default async function CollectionPage({ params }: P) {
  const db = getDb(); const [c, siteConfig] = await Promise.all([getCollection(db, (await params).slug), getSiteConfig(db)]); if (!c) notFound();
  const [b] = c.collection.brandId ? await db.select().from(brands).where(eq(brands.id, c.collection.brandId)) : [];
  return (
    <div data-brand={b?.themeKey} className="bg-bg text-fg">
      <section className="house-collection-hero relative isolate flex min-h-[72svh] items-end overflow-hidden">
        {c.hero && <Media storageKey={c.hero.storageKey} alt={c.hero.altText ?? c.collection.title} priority className="absolute inset-0 -z-10 opacity-80" />}<div className="house-collection-hero__wash absolute inset-0 -z-10" />
        <div className="mx-auto w-full max-w-[1600px] px-5 pb-10 md:px-10 md:pb-14"><div className="house-collection-hero__panel glass max-w-4xl rounded-[var(--r-lg)] p-6 md:p-10"><p className="house-kicker">{b?.name ?? siteConfig.settings.siteName} / Curated edit</p><h1 className="display mt-4 text-[clamp(3rem,10vw,9rem)]">{c.collection.title}</h1>{c.collection.description && <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted md:text-base">{c.collection.description}</p>}</div></div></section>
      <div className="mx-auto max-w-[1600px] px-5 py-16 md:px-10"><div className="house-section-heading mb-8 flex items-end justify-between gap-4"><div><p className="house-kicker">Inside the edit</p><h2 className="display mt-3 text-4xl md:text-5xl">Pieces to discover</h2></div><span className="text-xs uppercase tracking-[0.14em] text-muted">{c.cards.length} pieces</span></div>{c.cards.length === 0 ? <EmptyState title="No pieces available right now" /> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{c.cards.map((x) => <ProductCard key={x.product.id} item={x} />)}</div>}</div>
    </div>
  );
}
