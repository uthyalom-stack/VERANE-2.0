import Link from "next/link";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import type { CardData } from "@/domains/catalog/public";

export function ProductCard({ item }: { item: CardData }) {
  const { product: p, brand } = item;
  const onSale = p.compareAtPrice && p.compareAtPrice > p.basePrice;
  return (
    <article className="group relative" data-brand={brand.themeKey}>
      <Link href={`/product/${p.slug}?brand=${brand.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">
          {item.image ? <Media storageKey={item.image.key} alt={item.image.alt} sizes="(min-width:900px) 25vw, 78vw" /> : <div className="grid h-full place-items-center text-sm text-muted">Image coming soon</div>}
          {item.hoverImage && <div className="absolute inset-0 opacity-0 transition-opacity duration-[var(--dur-3)] group-hover:opacity-100 group-focus-within:opacity-100"><Media storageKey={item.hoverImage.key} alt={item.hoverImage.alt} /></div>}
          {!item.inStock && <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-xs">Sold out</span>}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{brand.name}</p>
            <h3 className="mt-1 text-lg leading-tight">{p.name}</h3>
            {item.colors.length > 0 && <p className="mt-1 text-xs text-muted">{item.colors.length === 1 ? item.colors[0] : `${item.colors.length} colours`}</p>}
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
