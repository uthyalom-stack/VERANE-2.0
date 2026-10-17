import Link from "next/link";
import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, collaborationProducts, collaborationRequests, collaborations, products } from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/money";
import { Media } from "@/components/ui/media";

export const dynamic = "force-dynamic";

export default async function CollaborationsPage() {
  const db = getDb(); const now = new Date();
  const rows = await db.select().from(collaborations).where(and(eq(collaborations.status, "published"), or(eq(collaborations.publishAt, null as never), lte(collaborations.publishAt, now))));
  const cards = await Promise.all(rows.map(async (collab) => {
    const [request] = await db.select().from(collaborationRequests).where(and(eq(collaborationRequests.collaborationId, collab.id), eq(collaborationRequests.status, "accepted")));
    const [brand] = collab.brandId ? await db.select().from(brands).where(eq(brands.id, collab.brandId)) : [];
    const productsRows = await db.select().from(collaborationProducts).where(and(eq(collaborationProducts.collaborationId, collab.id), eq(collaborationProducts.status, "published")));
    const first = productsRows[0];
    const [a] = first ? await db.select().from(products).where(eq(products.id, first.brandAProductId)) : [];
    const [b] = first ? await db.select().from(products).where(eq(products.id, first.brandBProductId)) : [];
    const [from] = request ? await db.select().from(brands).where(eq(brands.id, request.fromBrandId)) : [];
    const [to] = request ? await db.select().from(brands).where(eq(brands.id, request.toBrandId)) : [];
    return { collab, brand, from, to, productsRows, a, b };
  }));
  const visible = cards.filter((c) => c.productsRows.length > 0 && c.from && c.to);
  return <main className="mx-auto max-w-7xl px-5 pb-24 pt-28 md:px-10">
    <p className="house-kicker">Across the house</p><h1 className="display mt-4 text-6xl md:text-8xl">Collaborations.</h1>
    <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">A meeting of perspectives from across the VÉRANE house.</p>
    {visible.length ? <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{visible.map(({ collab, from, to, productsRows, a, b }) => <article key={collab.id} className="overflow-hidden rounded-[var(--r-md)] border border-line">
      {collab.coverMediaId ? <div className="aspect-[4/3] bg-surface"><Media mediaId={collab.coverMediaId} alt={collab.title} /></div> : null}
      <div className="p-5"><p className="house-kicker">{from!.name} × {to!.name}</p><h2 className="display mt-3 text-3xl">{collab.title}</h2>{collab.description ? <p className="mt-3 text-sm text-muted">{collab.description}</p> : null}<p className="mt-4 text-xs text-muted">{productsRows.length} collaboration {productsRows.length === 1 ? "product" : "products"}</p>
      {a && b ? <p className="mt-2 text-sm">{a.name} × {b.name}</p> : null}<Link className="mt-5 inline-flex border-b border-current pb-1 text-sm" href={`/collaborations/${collab.slug}`}>Explore collaboration</Link></div>
    </article>)}</div> : <p className="mt-12 border-y border-line py-10 text-sm text-muted">New collaborations are in the works. Check back soon.</p>}
  </main>;
}
