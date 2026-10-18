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
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-8xl">Bag</h1>
      {!view || view.lines.length === 0
        ? <EmptyState title="Your bag is empty" action={<ButtonLink href="/shop">Shop the house</ButtonLink>}>Pieces you add will wait here.</EmptyState>
        : <CartClient view={view} />}
    </div>
  );
}
