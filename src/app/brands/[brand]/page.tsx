import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/server";
import { brands } from "@/infrastructure/db/schema";
import { listShopProducts, toCardData } from "@/domains/catalog/public";
import { ProductCard } from "@/components/commerce/product-card";
import { Media } from "@/components/ui/media";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { brand: slug } = await params;
  const [b] = await getDb().select().from(brands).where(eq(brands.slug, slug));
  return b ? { title: b.name, description: b.description ?? undefined, alternates: { canonical: `/brands/${b.slug}` } } : {};
}

export default async function BrandPage({ params }: P) {
  const { brand: slug } = await params;
  const db = getDb();
  const [b] = await db.select().from(brands).where(eq(brands.slug, slug));
  if (!b || !b.isActive) notFound();
  const { items } = await listShopProducts(db, { brand: b.slug, pageSize: 12 });
  const cards = await toCardData(db, items);
  const uthy = b.themeKey === "uthy";
  return (
    <div data-brand={b.themeKey} className="bg-bg text-fg">
      <section className={`house-brand-hero relative isolate flex min-h-[88svh] items-end overflow-hidden ${uthy ? "house-brand-hero--uthy" : "house-brand-hero--alo"}`}>
        <Media storageKey={uthy ? "placeholders/uthy-hero.svg" : "placeholders/alomzie-hero.svg"} alt={`${b.name} campaign artwork (placeholder)`} priority className="absolute inset-0 -z-10 opacity-75" />
        <div className="house-brand-hero__wash absolute inset-0 -z-10" />
        <div className="mx-auto w-full max-w-[1600px] px-5 pb-12 pt-32 md:px-10 md:pb-16">
          <div className={`house-brand-hero__panel glass max-w-4xl rounded-[var(--r-lg)] p-6 md:p-10 ${uthy ? "" : "md:ml-auto md:text-right"}`}>
            <p className="house-kicker">{uthy ? "The art of restraint / 01" : "Unapologetic expression / 02"}</p>
            <h1 className={uthy ? "display mt-5 text-[clamp(3rem,11vw,9rem)]" : "display mt-5 text-[clamp(3rem,13vw,10rem)] uppercase leading-[.82]"}>{b.name}</h1>
            <p className={uthy ? "mt-6 text-lg text-muted" : "mt-6 text-xl font-medium text-accent"}>{b.tagline}</p>
            {b.description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">{b.description}</p>}
            <ButtonLink href={`/shop?brand=${b.slug}`} className="mt-8">Explore the collection <span aria-hidden="true">↗</span></ButtonLink>
          </div>
        </div>
      </section>
      <section className="house-brand-manifesto mx-auto grid max-w-[1600px] gap-5 px-5 py-14 md:grid-cols-[1fr_auto] md:items-end md:px-10 md:py-20">
        <div><p className="house-kicker">A VÉRANE house / {uthy ? "One" : "Two"}</p><h2 className="display mt-4 max-w-[14ch] text-4xl md:text-6xl">{uthy ? "Less noise. More presence." : "Made to be noticed."}</h2></div>
        <p className="max-w-md text-sm leading-relaxed text-muted">{uthy ? "A considered point of view, built around shape, texture and quiet confidence." : "A bolder point of view, built for contrast, movement and unapologetic self-expression."}</p>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 pb-24 pt-8 md:px-10">
        <div className="house-section-heading mb-10 flex items-end justify-between gap-4"><div><p className="house-kicker">{uthy ? "Quietly considered" : "New energy"}</p><h2 className="display mt-3 text-4xl md:text-6xl">{uthy ? "The collection" : "Fresh drops"}</h2></div><span className="glass rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.15em]">{b.name}</span></div>
        {cards.length === 0 ? <EmptyState title="Nothing published yet">New pieces from {b.name} will appear here.</EmptyState> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{cards.map((c) => <ProductCard key={c.product.id} item={c} />)}</div>}
      </section>
    </div>
  );
}
