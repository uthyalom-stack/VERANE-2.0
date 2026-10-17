import Link from "next/link";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import type { CardData } from "@/domains/catalog/public";

export function ProductCard({ item }: { item: CardData }) {
  const { product: p, brand } = item;
  const onSale = p.compareAtPrice && p.compareAtPrice > p.basePrice;
  return (
    <article className="product-card group relative" data-brand={brand.themeKey}>
      <Link href={`/product/${p.slug}?brand=${brand.slug}`} className="block">
        <div className="product-card__media relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">
          {item.image ? <Media storageKey={item.image.key} alt={item.image.alt} sizes="(min-width:900px) 25vw, 78vw" className="product-card__image transition-transform duration-[var(--dur-3)] ease-[var(--ease)] group-hover:scale-[1.035]" /> : <div className="product-card__fallback relative grid h-full place-items-end overflow-hidden p-4 md:p-6"><span className="product-card__fallback-orb" aria-hidden="true" /><div className="relative z-10"><p className="text-[9px] uppercase tracking-[0.18em] text-muted">{brand.name}</p><p className="display mt-2 text-xl md:text-2xl">Image coming soon</p></div></div>}
          {item.hoverImage && <div className="absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-3)] group-hover:opacity-100 group-focus-within:opacity-100"><Media storageKey={item.hoverImage.key} alt={item.hoverImage.alt} className="transition-transform duration-[var(--dur-3)] ease-[var(--ease)] group-hover:scale-[1.035]" /></div>}
          {!item.inStock && <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-xs">Sold out</span>}
          <span aria-hidden="true" className="product-card__view absolute bottom-3 right-3 translate-y-2 rounded-full bg-[var(--bg)] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-[var(--fg)] opacity-0 transition-all duration-[var(--dur-2)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">View piece ↗</span>
        </div>
        <div className="product-card__details mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{brand.name}</p>
            <h3 className="mt-2 text-base leading-snug transition-colors duration-[var(--dur-2)] group-hover:text-[var(--accent)] md:text-lg">{p.name}</h3>
            {item.colors.length > 0 && <p className="mt-3 text-xs text-muted">{item.colors.length === 1 ? item.colors[0] : `${item.colors.length} colours`}</p>}
          </div>
          <p className="whitespace-nowrap text-sm">
            {onSale && <span className="mr-2 text-muted line-through">{formatMoney(p.compareAtPrice!, p.currency)}</span>}
            {formatMoney(p.basePrice, p.currency)}
          </p>
        </div>
      </Link>
    </article>
  );
}
