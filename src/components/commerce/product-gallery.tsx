"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_VARIANT_CHANGED, type ProductVariantChange } from "./variant-events";

type G = { src: string; alt: string; kind: "image" | "video"; variantId?: string | null };
/** Variant-aware gallery with a full-screen viewer (keyboard: Esc, arrows) and click-to-zoom. */
export function ProductGallery({ items }: { items: G[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const visibleItems = useMemo(() => {
    const general = items.filter((item) => !item.variantId);
    const variant = variantId ? items.filter((item) => item.variantId === variantId) : [];
    if (variant.length) return [...variant, ...general];
    return general.length ? general : items;
  }, [items, variantId]);

  useEffect(() => {
    const onVariant = (event: Event) => {
      const detail = (event as CustomEvent<ProductVariantChange>).detail;
      setVariantId(detail?.variantId ?? null);
      setOpen(null);
      setZoom(false);
    };
    window.addEventListener(PRODUCT_VARIANT_CHANGED, onVariant);
    return () => window.removeEventListener(PRODUCT_VARIANT_CHANGED, onVariant);
  }, []);

  useEffect(() => {
    if (open === null) return;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % visibleItems.length));
      if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + visibleItems.length) % visibleItems.length));
    };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [open, visibleItems]);

  return (
    <>
      <div className="house-product-gallery grid gap-3 md:grid-cols-2">{visibleItems.map((m, i) => (
        <div key={m.src + (m.variantId ?? "general") + i} className={`relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface ${i === 0 ? "md:col-span-2" : ""}`}>
          {m.kind === "video" ? <video src={m.src} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={m.alt} />
            : <button type="button" className="block h-full w-full cursor-zoom-in" onClick={() => { setOpen(i); setZoom(false); }} aria-label={`Open image ${i + 1} full screen: ${m.alt}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.src} alt={m.alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" /></button>}</div>))}</div>
      {open !== null && visibleItems[open]?.kind === "image" && (
        <div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-[var(--z-drawer)] grid place-items-center bg-black/90">
          <button ref={closeRef} onClick={() => setOpen(null)} className="glass absolute right-4 top-4 min-h-11 rounded-full px-5 text-sm">Close</button>
          <button onClick={() => setOpen((open - 1 + visibleItems.length) % visibleItems.length)} className="glass absolute left-4 top-1/2 min-h-11 rounded-full px-4" aria-label="Previous image">‹</button>
          <button onClick={() => setOpen((open + 1) % visibleItems.length)} className="glass absolute right-4 top-1/2 min-h-11 rounded-full px-4" aria-label="Next image">›</button>
          <div className="max-h-[92svh] max-w-[92vw] overflow-auto">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={visibleItems[open]!.src} alt={visibleItems[open]!.alt} onClick={() => setZoom(!zoom)} className={`mx-auto max-h-[92svh] ${zoom ? "max-h-none max-w-none cursor-zoom-out" : "cursor-zoom-in object-contain"}`} /></div>
        </div>)}
    </>
  );
}
