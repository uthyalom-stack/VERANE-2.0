import type { Metadata } from "next";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { getCartView } from "@/domains/cart";
import { peekCartId } from "@/lib/http/cart-cookie";
import { CartClient } from "./cart-client";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Bag", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const id = await peekCartId(); const e = getEnv();
  const view = id ? await getCartView(getDb(), id, { taxBps: e.TAX_BPS, taxInclusive: e.TAX_INCLUSIVE === "true" }) : null;
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:px-10">
      <div className="house-index-intro flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="house-kicker">Your edit</p><h1 className="display mt-4 text-6xl md:text-8xl">Your bag.</h1></div><p className="max-w-xs text-sm leading-relaxed text-muted">The pieces you chose, together in one place.</p></div>
      {!view || view.lines.length === 0
        ? <EmptyState title="Your bag is empty" action={<ButtonLink href="/shop">Shop the house</ButtonLink>}>Pieces you add will wait here.</EmptyState>
        : <CartClient view={view} />}
    </div>
  );
}
