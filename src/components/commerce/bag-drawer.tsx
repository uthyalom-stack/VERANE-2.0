"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBagAction } from "@/app/actions/cart";
import { BagLines, Totals } from "./bag-lines";
import { ButtonLink } from "@/components/ui/button";
import type { CartView } from "@/domains/cart";

export const BAG_OPEN = "vr:bag-open";
export const BAG_CHANGED = "vr:bag-changed";

/** Slide-in glass drawer. Opens on `vr:bag-open`; keeps the header count in sync via `vr:bag-changed`. */
export function BagDrawer({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CartView | null | undefined>(undefined);
  const [count, setCount] = useState(initialCount);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const load = useCallback(async () => {
    const v = await getBagAction();
    setView(v); setCount(v ? v.lines.reduce((n, l) => n + l.quantity, 0) : 0);
  }, []);

  useEffect(() => {
    const o = () => { opener.current = document.activeElement; setOpen(true); void load(); };
    const c = () => void load();
    window.addEventListener(BAG_OPEN, o); window.addEventListener(BAG_CHANGED, c);
    return () => { window.removeEventListener(BAG_OPEN, o); window.removeEventListener(BAG_CHANGED, c); };
  }, [load]);
  useEffect(() => {
    if (!open) { (opener.current as HTMLElement | null)?.focus?.(); return; }
    document.body.style.overflow = "hidden"; closeRef.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); if (e.key === "Tab") trap(e); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", key); };
  }, [open]);
  const panel = useRef<HTMLDivElement>(null);
  function trap(e: KeyboardEvent) {
    const f = panel.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])");
    if (!f?.length) return; const first = f[0]!, last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <>
      <button type="button" className="min-h-11 px-2 text-sm" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(BAG_OPEN))}>Bag <span aria-label={`${count} items`}>({count})</span></button>
      <div className={`fixed inset-0 z-[var(--z-drawer)] transition-opacity duration-[var(--dur-2)] ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!open}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <div ref={panel} role="dialog" aria-modal="true" aria-label="Shopping bag" className={`glass absolute inset-y-0 right-0 flex w-full max-w-md flex-col rounded-none bg-bg/80 p-6 transition-transform duration-[var(--dur-3)] ease-[var(--ease)] ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between"><h2 className="display text-3xl">Your bag</h2><button ref={closeRef} type="button" className="glass min-h-11 rounded-full px-5 text-sm" onClick={() => setOpen(false)}>Close</button></div>
          <div className="mt-6 flex-1 overflow-y-auto">
            {view === undefined ? <div className="grid gap-4" aria-busy><div className="skeleton h-20 rounded" /><div className="skeleton h-20 rounded" /></div>
              : !view || view.lines.length === 0 ? <div role="status" className="py-16 text-center"><p className="display text-3xl">Your bag is empty</p><p className="mt-3 text-sm text-muted">Pieces you add will wait here.</p><ButtonLink href="/shop" className="mt-6" onClick={() => setOpen(false)}>Shop the house</ButtonLink></div>
              : <BagLines view={view} onChanged={() => { void load(); }} />}
          </div>
          {view && view.lines.length > 0 && (
            <div className="border-t border-line pt-5"><Totals view={view} />
              <div className="mt-5 grid gap-2"><ButtonLink href={view.canCheckout ? "/checkout" : "/cart"} onClick={() => setOpen(false)} className="w-full">{view.canCheckout ? "Checkout" : "Review bag"}</ButtonLink>
                <Link href="/cart" onClick={() => setOpen(false)} className="min-h-11 py-3 text-center text-sm underline">View full bag</Link></div></div>)}
        </div>
      </div>
    </>
  );
}
