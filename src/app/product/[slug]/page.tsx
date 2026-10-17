import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { slugRedirects } from "@/infrastructure/db/schema";
import { getDb } from "@/infrastructure/db/client";
import { getPublishedProduct } from "@/domains/catalog/public";
import { looksForProduct, relatedProducts } from "@/domains/content/public";
import { isWished } from "@/domains/account";
import { getCurrentUser } from "@/lib/http/session";
import { Media } from "@/components/ui/media";
import { ProductCard } from "@/components/commerce/product-card";
import { PurchasePanel } from "@/components/commerce/purchase-panel";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { mediaUrl } from "@/infrastructure/storage";
import { getEnv } from "@/lib/env";
import { trackServer } from "@/lib/http/track";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ brand?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const [{ slug }, { brand }] = await Promise.all([params, searchParams]);
  const d = await getPublishedProduct(getDb(), brand ?? null, slug);
  if (!d) return {};
  const img = d.media.find((m) => m.m.kind === "image")?.m.storageKey;
  return {
    title: d.product.seoTitle ?? d.product.name, description: d.product.seoDescription ?? d.product.subtitle ?? undefined,
    alternates: { canonical: `/product/${d.product.slug}?brand=${d.brand.slug}` },
    openGraph: { title: d.product.name, type: "website", images: img ? [mediaUrl(img)] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: P) {
  const [{ slug }, { brand }] = await Promise.all([params, searchParams]);
  const db = getDb(); const d = await getPublishedProduct(db, brand ?? null, slug);
  if (!d) { const [r] = await db.select().from(slugRedirects).where(eq(slugRedirects.fromPath, `/product/${slug}`)); if (r) permanentRedirect(r.toPath); notFound(); } // renamed products keep working links
  const { product: p, brand: b, variants, media } = d;
  const user = await getCurrentUser(); const customer = user?.kind === "customer" ? user : null;
  const [wished, related, looks] = await Promise.all([isWished(db, customer?.id ?? null, p.id), relatedProducts(db, p), looksForProduct(db, p.id)]);
  void trackServer({ name: "product_view", brandId: p.brandId, entityType: "product", entityId: p.id });
  const base = getEnv().APP_URL;
  const inStock = variants.some((v) => v.available > 0 || v.allowBackorder);
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description ?? undefined, brand: { "@type": "Brand", name: b.name }, sku: variants[0]?.sku, image: media.filter((m) => m.m.kind === "image").map((m) => mediaUrl(m.m.storageKey)),
      offers: { "@type": "Offer", priceCurrency: p.currency, price: (p.basePrice / 100).toFixed(2), availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}/product/${p.slug}?brand=${b.slug}` } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Shop", item: `${base}/shop` }, { "@type": "ListItem", position: 2, name: b.name, item: `${base}/brands/${b.slug}` }, { "@type": "ListItem", position: 3, name: p.name }] },
  ];
  const details: Array<[string, string | null]> = [["Materials", p.materials], ["Fit", p.fit], ["Sizing", p.sizingInfo], ["Care", p.careInstructions], ["Delivery", p.deliveryInfo]];
  const gallery = media.length ? media.map((m) => ({ key: m.m.storageKey, alt: m.m.altText ?? p.name, kind: m.m.kind, poster: m.m.posterMediaId })) : [{ key: "placeholders/product-1.svg", alt: `${p.name} (placeholder)`, kind: "image" as const, poster: null }];
  return (
    <div data-brand={b.themeKey} className="bg-bg text-fg">
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j).replace(/</g, "\\u003c") }} />)}
      <div className="house-product-layout mx-auto grid max-w-[1600px] gap-8 px-5 pb-28 pt-24 md:grid-cols-[1.2fr_.8fr] md:gap-14 md:px-10 md:pb-16">
        <ProductGallery items={gallery.map((g) => ({ src: mediaUrl(g.key), alt: g.alt, kind: g.kind === "video" ? "video" : "image" }))} />
        <div className="house-product-panel md:sticky md:top-24 md:self-start">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted"><Link href="/shop" className="transition-colors hover:text-fg">Shop</Link><span aria-hidden="true">/</span><Link href={`/brands/${b.slug}`} className="transition-colors hover:text-fg">{b.name}</Link></nav>
          <p className="house-kicker mt-7">{b.name} / The piece</p>
          <h1 className="display mt-3 text-5xl md:text-6xl">{p.name}</h1>{p.subtitle && <p className="mt-4 max-w-lg leading-relaxed text-muted">{p.subtitle}</p>}
          <PurchasePanel productId={p.id} productName={p.name} currency={p.currency} signedIn={!!customer} wished={wished} variants={variants.map((v) => ({ id: v.id, size: v.size, colorName: v.colorName, colorHex: v.colorHex, unitPrice: v.unitPrice, available: v.available, allowBackorder: v.allowBackorder }))} />
          <div className="house-product-details mt-10 divide-y divide-line border-y border-line">{p.description && <p className="py-6 text-sm leading-relaxed">{p.description}</p>}
            {details.filter(([, v]) => v).map(([k, v]) => <details key={k} className="group py-4"><summary className="flex cursor-pointer list-none justify-between text-sm">{k}<span aria-hidden className="transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 text-sm text-muted">{v}</p></details>)}</div>
        </div>
      </div>
      {looks.length > 0 && <section className="mx-auto max-w-[1600px] px-5 py-16 md:px-10"><p className="house-kicker mb-3">Wear it your way</p><h2 className="display mb-8 text-4xl md:text-5xl">Complete the look</h2><div className="grid gap-6 sm:grid-cols-3">{looks.map(({ look, image }) => <Link key={look.id} href={`/looks/${look.slug}`} className="group"><div className="aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">{image && <Media storageKey={image.storageKey} alt={image.altText ?? look.title} className="transition-transform duration-[var(--dur-3)] group-hover:scale-105" />}</div><p className="mt-2 text-xl">{look.title}</p></Link>)}</div></section>}
      {related.length > 0 && <section className="mx-auto max-w-[1600px] px-5 py-16 md:px-10"><p className="house-kicker mb-3">More from the house</p><h2 className="display mb-8 text-4xl md:text-5xl">You may also like</h2><div className="rail">{related.map((c) => <ProductCard key={c.product.id} item={c} />)}</div></section>}
    </div>
  );
}
