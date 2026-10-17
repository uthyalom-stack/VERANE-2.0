import Link from "next/link";
import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { publiclyVisible } from "@/domains/catalog/public";
import { collaborationProductVariants, collaborationProducts, collaborationRequests, collaborations, brands, mediaAssets, productVariants, products } from "@/infrastructure/db/schema";
import { Media } from "@/components/ui/media";
import { getSiteConfig } from "@/domains/site-content";

export const dynamic = "force-dynamic";

export default async function CollaborationsPage() {
  const db = getDb();
  const siteConfig = await getSiteConfig(db);
  const now = new Date();
  const rows = await db.select().from(collaborations).where(or(
    eq(collaborations.status, "published"),
    and(eq(collaborations.status, "scheduled"), lte(collaborations.publishAt, now)),
  ));

  const cards = await Promise.all(rows.map(async (collab) => {
    const [request] = await db.select().from(collaborationRequests).where(and(
      eq(collaborationRequests.collaborationId, collab.id),
      eq(collaborationRequests.status, "accepted"),
    ));
    const [from] = request ? await db.select().from(brands).where(eq(brands.id, request.fromBrandId)) : [];
    const [to] = request ? await db.select().from(brands).where(eq(brands.id, request.toBrandId)) : [];
    const [cover] = collab.coverMediaId ? await db.select().from(mediaAssets).where(eq(mediaAssets.id, collab.coverMediaId)) : [];
    const publishedProducts = await db.select().from(collaborationProducts).where(and(
      eq(collaborationProducts.collaborationId, collab.id),
      eq(collaborationProducts.status, "published"),
    ));

    const validProducts = (await Promise.all(publishedProducts.map(async (item) => {
      const [a] = await db.select().from(products).where(and(eq(products.id, item.brandAProductId), publiclyVisible(now)));
      const [b] = await db.select().from(products).where(and(eq(products.id, item.brandBProductId), publiclyVisible(now)));
      if (!a || !b) return null;
      const pairs = await db.select().from(collaborationProductVariants).where(eq(collaborationProductVariants.collaborationProductId, item.id));
      for (const pair of pairs) {
        if (!pair.brandAVariantId || !pair.brandBVariantId) continue;
        const [av] = await db.select().from(productVariants).where(and(
          eq(productVariants.id, pair.brandAVariantId), eq(productVariants.productId, a.id), eq(productVariants.isActive, true),
        ));
        const [bv] = await db.select().from(productVariants).where(and(
          eq(productVariants.id, pair.brandBVariantId), eq(productVariants.productId, b.id), eq(productVariants.isActive, true),
        ));
        if (av && bv) return { item, a, b };
      }
      return null;
    }))).filter((value): value is NonNullable<typeof value> => value !== null);

    return { collab, from, to, validProducts, cover };
  }));

  const visible = cards.filter((card) => card.from && card.to && card.validProducts.length > 0);
  return <main className="mx-auto max-w-7xl px-5 pb-24 pt-28 md:px-10">
    <p className="house-kicker">Across the house</p>
    <h1 className="display mt-4 text-6xl md:text-8xl">Collaborations.</h1>
    <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">A meeting of perspectives from across the {siteConfig.settings.siteName} house.</p>
    {visible.length ? <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{visible.map(({ collab, from, to, validProducts, cover }) => {
      const first = validProducts[0]!;
      return <article key={collab.id} className="overflow-hidden rounded-[var(--r-md)] border border-line">
        {collab.coverMediaId ? <div className="aspect-[4/3] bg-surface">{cover ? <Media storageKey={cover.storageKey} alt={collab.title} /> : null}</div> : null}
        <div className="p-5">
          <p className="house-kicker">{from!.name} × {to!.name}</p>
          <h2 className="display mt-3 text-3xl">{collab.title}</h2>
          {collab.description ? <p className="mt-3 text-sm text-muted">{collab.description}</p> : null}
          <p className="mt-4 text-xs text-muted">{validProducts.length} collaboration {validProducts.length === 1 ? "product" : "products"}</p>
          <p className="mt-2 text-sm">{first.a.name} × {first.b.name}</p>
          <Link className="mt-5 inline-flex border-b border-current pb-1 text-sm" href={`/collaborations/${collab.slug}`}>Explore collaboration</Link>
        </div>
      </article>;
    })}</div> : <p className="mt-12 border-y border-line py-10 text-sm text-muted">New collaborations are in the works. Check back soon.</p>}
  </main>;
}
