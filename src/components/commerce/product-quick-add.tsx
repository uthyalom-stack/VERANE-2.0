"use client";

import { useMemo, useState, useTransition } from "react";
import { addToBagAction } from "@/app/actions/cart";
import { BAG_CHANGED, BAG_OPEN } from "./bag-drawer";

export type QuickAddVariant = {
  id: string;
  size: string | null;
  colorName: string | null;
  colorHex: string | null;
  unitPrice: number;
  available: number;
  allowBackorder: boolean;
};

/** Small product-card variant picker. The server action remains the authority for stock and price. */
export function ProductQuickAdd({ productName, variants }: { productName: string; variants: QuickAddVariant[] }) {
  const sellable = (v: QuickAddVariant) => v.available > 0 || v.allowBackorder;
  const options = useMemo(() => variants.filter(sellable), [variants]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const current = options.find((v) => v.id === selected);
  const label = (v: QuickAddVariant) => [v.colorName, v.size].filter(Boolean).join(" · ") || "One size";

  const add = () => start(async () => {
    if (!current) { setMessage("Choose an available option first."); setOpen(true); return; }
    const result = await addToBagAction(current.id, 1);
    if (result.ok) {
      setMessage("Added to your bag.");
      setOpen(false);
      window.dispatchEvent(new Event(BAG_CHANGED));
      window.dispatchEvent(new Event(BAG_OPEN));
    } else {
      setMessage(result.message ?? "Could not add this piece.");
    }
  });

  if (!options.length) {
    return <span className="product-card__quick-add product-card__quick-add--disabled rounded-full px-4 py-3 text-[10px] uppercase tracking-[0.14em]">Sold out</span>;
  }

  return (
    <div className="product-card__quick-add-wrap" onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-expanded={open} aria-label={`Quick add ${productName}`} onClick={() => { setOpen((v) => !v); setMessage(""); }} className="product-card__quick-add rounded-full px-4 py-3 text-[10px] uppercase tracking-[0.14em]">
        {open ? "Close" : "Quick add"} <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="product-card__quick-panel glass absolute inset-x-2 bottom-14 z-20 rounded-[var(--r-md)] p-3 sm:inset-x-3 sm:p-4" role="group" aria-label={`Options for ${productName}`}>
          <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted">Choose an option</p>
          <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {variants.map((v) => {
              const available = sellable(v);
              return <button key={v.id} type="button" disabled={!available || pending} aria-pressed={selected === v.id} onClick={() => { setSelected(v.id); setMessage(""); }} className="min-h-9 rounded-full border border-line px-3 py-2 text-[11px] transition-colors hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through">{label(v)}</button>;
            })}
          </div>
          <button type="button" disabled={!current || pending} onClick={add} className="mt-3 min-h-11 w-full rounded-full bg-accent px-4 text-xs font-medium uppercase tracking-[0.14em] text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50">{pending ? "Adding…" : "Add to bag"}</button>
          {message && <p role="status" className="mt-2 text-xs text-muted">{message}</p>}
        </div>
      )}
      {message && !open && <span role="status" className="sr-only">{message}</span>}
    </div>
  );
}
