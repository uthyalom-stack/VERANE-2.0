"use client";
import { useEffect, useRef, useState } from "react";

type G = { src: string; alt: string; kind: "image" | "video" };
/** Grid gallery with a full-screen viewer (keyboard: Esc, arrows) and click-to-zoom. Videos use native controls + muted autoplay-free playback. */
export function ProductGallery({ items }: { items: G[] }) {
  const [open, setOpen] = useState<number | null>(null); const [zoom, setZoom] = useState(false); const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open === null) return; closeRef.current?.focus(); document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") setOpen((o) => (o === null ? o : (o + 1) % items.length)); if (e.key === "ArrowLeft") setOpen((o) => (o === null ? o : (o - 1 + items.length) % items.length)); };
    window.addEventListener("keydown", k); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [open, items.length]);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">{items.map((m, i) => (
        <div key={m.src + i} className={`relative aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface ${i === 0 ? "md:col-span-2" : ""}`}>
          {m.kind === "video" ? <video src={m.src} controls playsInline preload="metadata" className="h-full w-full object-cover" aria-label={m.alt} />
            : <button type="button" className="block h-full w-full cursor-zoom-in" onClick={() => { setOpen(i); setZoom(false); }} aria-label={`Open image ${i + 1} full screen: ${m.alt}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.src} alt={m.alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" /></button>}</div>))}</div>
      {open !== null && items[open]?.kind === "image" && (
        <div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-[var(--z-drawer)] grid place-items-center bg-black/90">
          <button ref={closeRef} onClick={() => setOpen(null)} className="glass absolute right-4 top-4 min-h-11 rounded-full px-5 text-sm">Close</button>
          <button onClick={() => setOpen((open - 1 + items.length) % items.length)} className="glass absolute left-4 top-1/2 min-h-11 rounded-full px-4" aria-label="Previous image">‹</button>
          <button onClick={() => setOpen((open + 1) % items.length)} className="glass absolute right-4 top-1/2 min-h-11 rounded-full px-4" aria-label="Next image">›</button>
          <div className="max-h-[92svh] max-w-[92vw] overflow-auto">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={items[open]!.src} alt={items[open]!.alt} onClick={() => setZoom(!zoom)} className={`mx-auto max-h-[92svh] ${zoom ? "max-h-none max-w-none cursor-zoom-out" : "cursor-zoom-in object-contain"}`} /></div>
        </div>)}
    </>
  );
}
