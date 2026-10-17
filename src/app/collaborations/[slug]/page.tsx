import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, collaborationProductVariants, collaborationProducts, collaborationRequests, collaborations, mediaAssets, products, productVariants } from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/money";
import { Media } from "@/components/ui/media";

export const dynamic = "force-dynamic";

export default async function CollaborationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const db = getDb(); const now = new Date();
  const [collab] = await db.select().from(collaborations).where(and(eq(collaborations.slug, slug), eq(collaborations.status, "published"), or(isNull(collaborations.publishAt), lte(collaborations.publishAt, now))));
  if (!collab) notFound();
  const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, collab.id), eq(collaborationRequests.status, "accepted")));
  if (!request) notFound();
  const [from] = await db.select().from(brands).where(eq(brands.id, request.fromBrandId));
  const [to] = await db.select().from(brands).where(eq(brands.id, request.toBrandId));
  if (!from || !to) notFound();
  const [cover] = collab.coverMediaId ? await db.select().from(mediaAssets).where(eq(mediaAssets.id, collab.coverMediaId)) : [];
  const items = await db.select().from(collaborationProducts).where(and(eq(collaborationProducts.collaborationId, collab.id), eq(collaborationProducts.status, "published")));
  const cards = await Promise.all(items.map(async (item) => {
    const [a] = await db.select().from(products).where(eq(products.id, item.brandAProductId));
    const [b] = await db.select().from(products).where(eq(products.id, item.brandBProductId));
    const variants = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, item.id));
    const [aVariant] = variants[0]?.brandAVariantId ? await db.select().from(productVariants).where(eq(productVariants.id, variants[0].brandAVariantId)) : [];
    const [bVariant] = variants[0]?.brandBVariantId ? await db.select().from(productVariants).where(eq(productVariants.id, variants[0].brandBVariantId)) : [];
    return { item, a, b, variants, aVariant, bVariant };
  }));
  const visible = cards.filter((x) => x.a?.status === "published" && x.b?.status === "published" && x.variants.length > 0);
  return <main className="mx-auto max-w-7xl px-5 pb-24 pt-28 md:px-10">
    <Link href="/collaborations" className="text-sm text-muted underline underline-offset-4">All collaborations</Link>
    <p className="house-kicker mt-8">{from.name} × {to.name}</p><h1 className="display mt-4 max-w-4xl text-6xl md:text-8xl">{collab.title}</h1>
    {collab.coverMediaId ? <div className="mt-8 max-w-5xl overflow-hidden rounded-[var(--r-md)] bg-surface">{cover ? <Media storageKey={cover.storageKey} alt={collab.title} /> : null}</div> : null}
    {collab.description ? <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted">{collab.description}</p> : null}
    <div className="mt-12 grid gap-6 md:grid-cols-2">{visible.map(({ item, a, b, variants, aVariant, bVariant }) => <article key={item.id} className="rounded-[var(--r-md)] border border-line p-6">
      <p className="house-kicker">Collaboration product</p><h2 className="display mt-3 text-3xl">{item.name}</h2>{item.description ? <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p> : null}
      <p className="mt-4 text-sm">Collaboration price reference: {formatMoney(item.price, "NGN")}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded border border-line p-4"><p className="text-xs text-muted">{from.name}</p><h3 className="mt-2 font-medium">{a!.name}</h3><p className="mt-2 text-xs text-muted">{aVariant ? [aVariant.colorName, aVariant.size].filter(Boolean).join(" · ") : "See available options"}</p><Link href={`/product/${a!.slug}`} className="mt-4 inline-flex border-b border-current pb-1 text-sm">Shop this piece</Link></div>
      <div className="rounded border border-line p-4"><p className="text-xs text-muted">{to.name}</p><h3 className="mt-2 font-medium">{b!.name}</h3><p className="mt-2 text-xs text-muted">{bVariant ? [bVariant.colorName, bVariant.size].filter(Boolean).join(" · ") : "See available options"}</p><Link href={`/product/${b!.slug}`} className="mt-4 inline-flex border-b border-current pb-1 text-sm">Shop this piece</Link></div></div>
      <p className="mt-5 text-xs leading-relaxed text-muted">{variants.length} paired variant {variants.length === 1 ? "configuration" : "configurations"} available. Each piece is purchased through its own brand product page and the standard secure checkout.</p>
    </article>)}</div>
    {!visible.length ? <p className="mt-12 text-sm text-muted">This collaboration has no products available at the moment.</p> : null}
  </main>;
}
