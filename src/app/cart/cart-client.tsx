"use client";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { BagLines, Totals } from "@/components/commerce/bag-lines";
import { ButtonLink, Button } from "@/components/ui/button";
import { applyDiscountAction } from "@/app/actions/cart";
import type { CartView } from "@/domains/cart";
import type { ActionState } from "@/lib/http/action";

export function CartClient({ view }: { view: CartView }) {
  const router = useRouter();
  const [state, act, pending] = useActionState(async (s: ActionState, f: FormData) => { const r = await applyDiscountAction(s, f); router.refresh(); return r; }, { ok: false } as ActionState);
  return (
    <div className="mt-10 grid gap-12 md:grid-cols-[1.4fr_1fr]">
      <BagLines view={view} onChanged={() => router.refresh()} />
      <aside className="glass h-fit rounded-[var(--r-lg)] p-6 md:sticky md:top-24">
        <form action={act} className="mb-6 flex gap-2"><label htmlFor="code" className="sr-only">Discount code</label>
          <input id="code" name="code" placeholder="Discount code" className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm" /><Button type="submit" variant="outline" disabled={pending}>Apply</Button></form>
        <p role="status" aria-live="polite" className={`mb-4 min-h-5 text-sm ${state.ok ? "text-accent" : "text-red-400"}`}>{state.message ?? (view.discountError ? view.discountError : "")}</p>
        <Totals view={view} />
        <ButtonLink href="/checkout" aria-disabled={!view.canCheckout} className={`mt-6 w-full ${view.canCheckout ? "" : "pointer-events-none opacity-50"}`}>Continue to checkout</ButtonLink>
        {!view.canCheckout && <p className="mt-3 text-sm text-red-400">Fix the items marked above to continue.</p>}
      </aside>
    </div>
  );
}
