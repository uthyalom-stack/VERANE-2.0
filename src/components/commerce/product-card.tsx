import Link from "next/link";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import type { CardData } from "@/domains/catalog/public";
import { ProductQuickAdd } from "./product-quick-add";

export function ProductCard({ item }: { item: CardData }) {
  const { product: p, brand } = item;
  const onSale = p.compareAtPrice && p.compareAtPrice > p.basePrice;
  const productHref = `/product/${p.slug}?brand=${brand.slug}`;
  return (
    <article className="product-card group relative min-w-0" data-brand={brand.themeKey}>
      <div className="product-card__media relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">
        <Link href={productHref} className="absolute inset-0 z-0 block" aria-label={`View ${p.name}`}>
          {item.image ? <Media storageKey={item.image.key} alt={item.image.alt} sizes="(min-width:1200px) 22vw, (min-width:900px) 30vw, 48vw" className="product-card__image transition-transform duration-[var(--dur-3)] ease-[var(--ease)] group-hover:scale-[1.035]" /> : <div className="product-card__fallback relative grid h-full place-items-end overflow-hidden p-4 md:p-6"><span className="product-card__fallback-orb" aria-hidden="true" /><div className="relative z-10"><p className="text-[9px] uppercase tracking-[0.18em] text-muted">{brand.name}</p><p className="display mt-2 text-xl md:text-2xl">Image coming soon</p></div></div>}
        </Link>
        {item.hoverImage && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-[var(--dur-3)] group-hover:opacity-100 group-focus-within:opacity-100"><Media storageKey={item.hoverImage.key} alt="" sizes="(min-width:1200px) 22vw, (min-width:900px) 30vw, 48vw" className="transition-transform duration-[var(--dur-3)] ease-[var(--ease)] group-hover:scale-[1.035]" /></div>}
        {!item.inStock && <span className="glass pointer-events-none absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.12em]">Sold out</span>}
        {onSale && <span className="product-card__sale pointer-events-none absolute right-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.12em]">Special price</span>}
        <ProductQuickAdd productName={p.name} variants={item.variants} />
      </div>
      <Link href={productHref} className="product-card__details mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{brand.name}</p>
          <h3 className="mt-2 text-base leading-snug transition-colors duration-[var(--dur-2)] group-hover:text-[var(--accent)] md:text-lg">{p.name}</h3>
          {item.colorSwatches.length > 0 && <div className="mt-3 flex items-center gap-2.5">
            <ul aria-label="Available colours" className="flex items-center -space-x-1.5">{item.colorSwatches.slice(0, 5).map((c) => <li key={c.name} title={c.name} className="product-card__swatch"><span style={{ backgroundColor: c.hex ?? "var(--surface)" }} /><span className="sr-only">{c.name}</span></li>)}</ul>
            <span className="text-xs text-muted">{item.colorSwatches.length === 1 ? item.colorSwatches[0]!.name : `${item.colorSwatches.length} colours`}{item.colorSwatches.length > 5 ? ` +${item.colorSwatches.length - 5}` : ""}</span>
          </div>}
        </div>
        <div className="shrink-0 text-right text-sm">
          {onSale && <span className="mb-1 block text-xs text-muted line-through">{formatMoney(p.compareAtPrice!, p.currency)}</span>}
          <span>{formatMoney(p.basePrice, p.currency)}</span>
        </div>
      </Link>
    </article>
  );
}
