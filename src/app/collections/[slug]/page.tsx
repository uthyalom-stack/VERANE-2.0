import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getCollection } from "@/domains/content/public";
import { brands } from "@/infrastructure/db/schema";
import { ProductCard } from "@/components/commerce/product-card";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = await getCollection(getDb(), (await params).slug); if (!c) return {};
  return { title: c.collection.seoTitle ?? c.collection.title, description: c.collection.seoDescription ?? c.collection.description ?? undefined, alternates: { canonical: `/collections/${c.collection.slug}` } };
}
export default async function CollectionPage({ params }: P) {
  const db = getDb(); const c = await getCollection(db, (await params).slug); if (!c) notFound();
  const [b] = c.collection.brandId ? await db.select().from(brands).where(eq(brands.id, c.collection.brandId)) : [];
  return (
    <div data-brand={b?.themeKey} className="bg-bg text-fg">
      <section className="relative isolate flex min-h-[70svh] items-end overflow-hidden">
        {c.hero && <Media storageKey={c.hero.storageKey} alt={c.hero.altText ?? c.collection.title} priority className="absolute inset-0 -z-10 opacity-70" />}<div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg to-transparent" />
        <div className="mx-auto w-full max-w-[1600px] px-5 pb-14 md:px-10"><p className="text-sm text-muted">{b?.name ?? "VÉRANE"}</p><h1 className="display text-[clamp(3rem,10vw,10rem)]">{c.collection.title}</h1>{c.collection.description && <p className="mt-4 max-w-xl text-muted">{c.collection.description}</p>}</div></section>
      <div className="mx-auto max-w-[1600px] px-5 py-20 md:px-10">{c.cards.length === 0 ? <EmptyState title="No pieces available right now" /> : <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{c.cards.map((x) => <ProductCard key={x.product.id} item={x} />)}</div>}</div>
    </div>
  );
}
