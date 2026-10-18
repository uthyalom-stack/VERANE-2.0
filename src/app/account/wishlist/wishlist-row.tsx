"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addToBagAction } from "@/app/actions/cart";
import { toggleWishlistAction } from "@/app/actions/account";
import { BAG_CHANGED, BAG_OPEN } from "@/components/commerce/bag-drawer";

export function WishlistRow({ productId, singleVariantId, available, href }: { productId: string; singleVariantId: string | null; available: boolean; href: string }) {
  const router = useRouter(); const [pending, start] = useTransition(); const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      {available && (singleVariantId
        ? <Button disabled={pending} onClick={() => start(async () => { const r = await addToBagAction(singleVariantId, 1); setMsg(r.message ?? ""); if (r.ok) { window.dispatchEvent(new Event(BAG_CHANGED)); window.dispatchEvent(new Event(BAG_OPEN)); } })}>Move to bag</Button>
        : <Link href={href} className="min-h-11 rounded-[var(--r-sm)] border border-line px-5 py-3 text-sm">Choose size</Link>)}
      <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await toggleWishlistAction(productId, null); router.refresh(); })}>Remove</Button>
      <span role="status" className="sr-only">{msg}</span>
    </div>
  );
}
