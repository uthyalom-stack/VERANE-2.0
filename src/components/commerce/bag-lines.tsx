"use client";
import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { updateBagAction } from "@/app/actions/cart";
import type { CartView } from "@/domains/cart";
import { Media } from "@/components/ui/media";

/** Quantity/remove controls. Prices shown are display-only; the server recomputes everything at checkout. */
export function BagLines({ view, onChanged }: { view: CartView; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const change = (variantId: string, q: number) => start(async () => { const r = await updateBagAction(variantId, q); setErr(r.ok ? null : r.message ?? "Could not update"); onChanged(); });
  return (
    <div aria-busy={pending}>
      <ul className="divide-y divide-line">
        {view.lines.map((l) => (
          <li key={l.variantId} className="house-bag-line py-5">
            <div className="flex gap-4 sm:gap-5">
              <div className="house-bag-line__image relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[var(--r-sm)] bg-surface sm:w-32">{l.imageKey ? <Media storageKey={l.imageKey} alt={l.name} /> : <div className="grid h-full place-items-center px-2 text-center text-[10px] text-muted">{l.brandName}</div>}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{l.brandName}</p><p className="mt-2 leading-snug">{l.name}</p><p className="mt-1 text-xs text-muted">{[l.colorName, l.size && `Size ${l.size}`].filter(Boolean).join(" · ")}</p>
                  {l.isPreOrder && <p className="mt-2 text-xs text-accent">Pre-order{l.fulfillmentTime ? ` · estimated lead time: ${l.fulfillmentTime}` : " · made available after production"}</p>}
                  {l.customMeasurements && <p className="mt-2 text-xs text-muted">Custom measurements (cm): {Object.entries(l.customMeasurements).map(([key, value]) => `${key} ${value}`).join(" · ")}</p>}</div><p className="whitespace-nowrap text-sm">{formatMoney(l.lineTotal, view.currency)}</p></div>
                {l.issue && <p role="alert" className="mt-2 text-sm text-red-400">{l.issue}. Reduce the quantity or remove it to continue.</p>}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center rounded-full border border-line" role="group" aria-label={`Quantity for ${l.name}`}>
                <button type="button" className="min-h-11 min-w-11" aria-label="Decrease quantity" onClick={() => change(l.variantId, l.quantity - 1)}>−</button>
                <span className="min-w-8 text-center text-sm" aria-live="polite">{l.quantity}</span>
                <button type="button" className="min-h-11 min-w-11" aria-label="Increase quantity" onClick={() => change(l.variantId, l.quantity + 1)}>+</button>
              </div>
              <button type="button" className="min-h-11 text-sm text-muted underline" onClick={() => change(l.variantId, 0)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-3 text-sm text-red-400">{err}</p>}
    </div>
  );
}

export function Totals({ view }: { view: CartView }) {
  const p = view.pricing; const c = view.currency;
  const row = (k: string, v: string, strong = false) => <div className={`flex justify-between ${strong ? "mt-3 border-t border-line pt-3 text-lg" : "text-sm"}`}><dt className={strong ? "" : "text-muted"}>{k}</dt><dd>{v}</dd></div>;
  return (
    <dl className="grid gap-2">
      {row("Subtotal", formatMoney(p.subtotal, c))}
      {p.discountTotal > 0 && row("Discount", `− ${formatMoney(p.discountTotal, c)}`)}
      {row("Delivery", p.shippingTotal ? formatMoney(p.shippingTotal, c) : "Calculated at checkout")}
      {p.taxTotal > 0 && row("Tax", formatMoney(p.taxTotal, c))}
      {row("Total", formatMoney(p.total, c), true)}
    </dl>
  );
}
