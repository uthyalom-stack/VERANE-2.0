import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { listWishlist } from "@/domains/account";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { WishlistRow } from "./wishlist-row";
import { brands } from "@/infrastructure/db/schema";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };
export default async function Wishlist() {
  const u = await requireCustomer("/account/wishlist"); const db = getDb();
  const items = await listWishlist(db, u.id); const bs = new Map((await db.select().from(brands)).map((b) => [b.id, b.slug]));
  return (<div><h1 className="display text-6xl">Wishlist</h1>
    {items.length === 0 ? <EmptyState title="Nothing saved yet" action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}>Tap Save on any piece to keep it here.</EmptyState> :
      <ul className="mt-8 divide-y divide-line">{items.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div><Link href={`/product/${i.product.slug}?brand=${bs.get(i.product.brandId)}`} className="text-lg underline-offset-4 hover:underline">{i.product.name}</Link>
          <p className="mt-1 text-sm">{formatMoney(i.product.basePrice, i.product.currency)}{i.priceChange && <span className="ml-2 text-accent">{i.priceChange.now < i.priceChange.was ? "Price dropped" : "Price changed"} (was {formatMoney(i.priceChange.was, i.product.currency)})</span>}</p>
          {!i.available && <p className="mt-1 text-sm text-red-400">{i.visible ? "Currently sold out" : "No longer available"}</p>}</div>
        <WishlistRow productId={i.product.id} singleVariantId={i.singleVariantId} available={i.available} href={`/product/${i.product.slug}?brand=${bs.get(i.product.brandId)}`} /></li>)}</ul>}</div>);
}
