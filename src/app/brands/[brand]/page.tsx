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
      <section className="relative isolate flex min-h-[88svh] items-end overflow-hidden">
        <Media storageKey={uthy ? "placeholders/uthy-hero.svg" : "placeholders/alomzie-hero.svg"} alt={`${b.name} campaign (placeholder)`} priority className="absolute inset-0 -z-10 opacity-75" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
        <div className={uthy ? "mx-auto w-full max-w-[1600px] px-5 pb-16 md:px-10" : "mx-auto w-full max-w-[1600px] px-5 pb-16 md:px-10 md:text-right"}>
          <h1 className={uthy ? "display text-[clamp(3rem,11vw,11rem)]" : "display text-[clamp(3rem,13vw,13rem)] uppercase leading-[.82]"}>{b.name}</h1>
          <p className={uthy ? "mt-6 text-lg text-muted" : "mt-6 text-xl font-medium text-accent md:ml-auto"}>{b.tagline}</p>
          <ButtonLink href={`/shop?brand=${b.slug}`} className="mt-8">Shop {b.name}</ButtonLink>
        </div>
      </section>
      <section className="mx-auto max-w-[1600px] px-5 py-24 md:px-10">
        <h2 className="display mb-10 text-4xl md:text-6xl">{uthy ? "The collection" : "Fresh drops"}</h2>
        {cards.length === 0 ? <EmptyState title="Nothing published yet">New pieces from {b.name} will appear here.</EmptyState> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{cards.map((c) => <ProductCard key={c.product.id} item={c} />)}</div>}
      </section>
    </div>
  );
}
