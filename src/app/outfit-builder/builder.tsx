"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import { addManyToBagAction, priceOutfitAction, saveOutfitAction, shareOutfitAction } from "@/app/actions/content";
import { BAG_CHANGED, BAG_OPEN } from "@/components/commerce/bag-drawer";

type Slot = "top" | "bottom" | "outerwear" | "dress" | "footwear" | "accessory";
export type BuilderItem = { productId: string; variantId: string | null; slot: Slot; x: number; y: number; scale: number; sortOrder: number };
type CatalogItem = { id: string; name: string; brand: string; brandSlug: string; price: number; currency: string; image: string | null; slots: Slot[]; defaultSlot: Slot; variants: Array<{ id: string; size: string | null; colorName: string | null; available: boolean }> };
type Priced = { lines: Array<{ productId: string; unitPrice: number; available: boolean; needsVariant: boolean }>; total: number; currency: string; allAvailable: boolean };

const DEFAULT_POS: Record<Slot, [number, number, number]> = { top: [500, 300, 1000], bottom: [500, 620, 1000], outerwear: [500, 330, 1150], dress: [500, 470, 1300], footwear: [500, 860, 650], accessory: [800, 200, 520] };
const SINGLE: Slot[] = ["top", "bottom", "outerwear", "dress", "footwear"];
const TABS: Array<["all" | Slot, string]> = [["all", "All"], ["top", "Tops"], ["bottom", "Bottoms"], ["outerwear", "Outerwear"], ["dress", "Dresses"], ["footwear", "Footwear"], ["accessory", "Accessories"]];

export function OutfitBuilder({ catalog, initial, initialName, outfitId, signedIn }: { catalog: CatalogItem[]; initial: BuilderItem[]; initialName: string; outfitId: string | null; signedIn: boolean }) {
  const [items, setItems] = useState<BuilderItem[]>(initial);
  const [tab, setTab] = useState<"all" | Slot>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState(initialName || "My outfit");
  const [priced, setPriced] = useState<Priced | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(outfitId);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stage = useRef<HTMLDivElement>(null); const drag = useRef<string | null>(null);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  // authoritative pricing from the server (debounced)
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(async () => { const r = await priceOutfitAction(items.map(({ productId, variantId, slot, x, y, scale, sortOrder }) => ({ productId, variantId, slot, x, y, scale, sortOrder }))); if (r.ok) setPriced(r.data as Priced); else setMsg({ ok: false, t: r.message ?? "Could not price outfit" }); }, 300);
    return () => clearTimeout(t);
  }, [items]);

  const add = (c: CatalogItem) => {
    const slot = tab !== "all" && c.slots.includes(tab) ? tab : c.defaultSlot; const [x, y, scale] = DEFAULT_POS[slot];
    setItems((cur) => {
      const kept = SINGLE.includes(slot) ? cur.filter((i) => i.slot !== slot) : cur.filter((i) => i.productId !== c.id).slice(-5);
      const filtered = slot === "dress" ? kept.filter((i) => i.slot !== "top" && i.slot !== "bottom") : kept.filter((i) => !(["top", "bottom"].includes(slot) && i.slot === "dress"));
      const only = c.variants.filter((v) => v.available);
      return [...filtered, { productId: c.id, variantId: only.length === 1 && c.variants.length === 1 ? only[0]!.id : null, slot, x, y, scale, sortOrder: filtered.length }];
    });
    setSel(c.id); setMsg(null);
  };
  const patch = (id: string, p: Partial<BuilderItem>) => setItems((cur) => cur.map((i) => (i.productId === id ? { ...i, ...p } : i)));
  const remove = (id: string) => { setItems((cur) => cur.filter((i) => i.productId !== id)); setSel(null); };
  const move = (id: string, dir: -1 | 1) => setItems((cur) => { const i = cur.findIndex((x) => x.productId === id); const j = i + dir; if (j < 0 || j >= cur.length) return cur; const n = [...cur]; [n[i], n[j]] = [n[j]!, n[i]!]; return n.map((x, k) => ({ ...x, sortOrder: k })); });

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current || !stage.current) return; const r = stage.current.getBoundingClientRect();
    patch(drag.current, { x: Math.round(Math.min(1000, Math.max(0, ((e.clientX - r.left) / r.width) * 1000))), y: Math.round(Math.min(1000, Math.max(0, ((e.clientY - r.top) / r.height) * 1000))) });
  }, []);
  const onKey = (e: React.KeyboardEvent, id: string, it: BuilderItem) => { const d = e.shiftKey ? 50 : 15; const m: Record<string, Partial<BuilderItem>> = { ArrowLeft: { x: Math.max(0, it.x - d) }, ArrowRight: { x: Math.min(1000, it.x + d) }, ArrowUp: { y: Math.max(0, it.y - d) }, ArrowDown: { y: Math.min(1000, it.y + d) } }; if (m[e.key]) { e.preventDefault(); patch(id, m[e.key]!); } if (e.key === "Delete" || e.key === "Backspace") remove(id); };

  const currentPriced = items.length > 0 ? priced : null;
  const complete = items.length > 0 && items.every((i) => i.variantId) && !!currentPriced?.allAvailable;
  const body = () => items.map((i, n) => ({ productId: i.productId, variantId: i.variantId, slot: i.slot, x: i.x, y: i.y, scale: i.scale, sortOrder: n }));
  const save = () => start(async () => {
    if (!signedIn) { window.location.href = "/login?next=/outfit-builder"; return; }
    const r = await saveOutfitAction({ name, items: body() }, savedId ?? undefined); setMsg({ ok: r.ok, t: r.message ?? "" }); if (r.ok && r.data) setSavedId(r.data.id);
  });
  const share = () => start(async () => { if (!savedId) return; const r = await shareOutfitAction(savedId, true); if (r.ok && r.data?.url) { setShareUrl(r.data.url); try { await navigator.clipboard.writeText(r.data.url); setMsg({ ok: true, t: "Link copied" }); } catch { setMsg({ ok: true, t: "Share link ready below" }); } } });
  const bag = () => start(async () => { const r = await addManyToBagAction(items.map((i) => i.variantId!).filter(Boolean)); setMsg({ ok: !!r.data?.added, t: r.message ?? "" }); if (r.data?.added) { window.dispatchEvent(new Event(BAG_CHANGED)); window.dispatchEvent(new Event(BAG_OPEN)); } });

  const shown = catalog.filter((c) => tab === "all" || c.slots.includes(tab));
  return (
    <div className="house-outfit-builder mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr_1fr]">
      <section aria-label="Choose pieces" className="house-outfit-catalog min-w-0"><div className="mb-3 flex items-center justify-between"><p className="house-kicker">01 / Select pieces</p><span className="text-[10px] text-muted">{catalog.length} available</span></div><div role="tablist" aria-label="Piece type" className="flex gap-2 overflow-x-auto pb-3">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="whitespace-nowrap rounded-full border border-line px-4 py-2 text-xs transition-colors hover:border-accent aria-selected:border-accent aria-selected:bg-accent aria-selected:text-accent-fg">{l}</button>)}</div>
        <ul className="house-outfit-pieces grid max-h-[70svh] grid-cols-2 gap-3 overflow-y-auto pr-1">{shown.map((c) => { const inUse = items.some((i) => i.productId === c.id); return <li key={c.id}><button onClick={() => add(c)} aria-pressed={inUse} className="w-full text-left"><div className={`aspect-[4/5] overflow-hidden rounded-[var(--r-sm)] bg-surface ${inUse ? "ring-2 ring-accent" : ""}`}>{c.image && <Media storageKey={c.image} alt="" />}</div><p className="mt-1.5 text-xs text-muted">{c.brand}</p><p className="text-sm leading-tight">{c.name}</p><p className="text-xs">{formatMoney(c.price, c.currency)}</p></button></li>; })}{shown.length === 0 && <li className="col-span-2 py-10 text-center text-sm text-muted">Nothing in this category yet.</li>}</ul></section>
      <section aria-label="Outfit canvas" className="house-outfit-stage-wrap min-w-0"><p className="house-kicker mb-3">02 / Arrange the look</p>
        <div ref={stage} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)} className="house-outfit-stage relative aspect-[3/4] touch-none overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface">
          {items.length === 0 && <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted">Pick a piece to begin. Drag to arrange, or use the arrow keys on a selected piece.</p>}
          {items.map((i, n) => { const c = byId.get(i.productId); if (!c?.image) return null; return (
            <div key={i.productId} role="button" tabIndex={0} aria-label={`${c.name}. Arrow keys move it.`} aria-pressed={sel === i.productId} onClick={() => setSel(i.productId)} onKeyDown={(e) => onKey(e, i.productId, i)} onPointerDown={(e) => { drag.current = i.productId; setSel(i.productId); (e.target as Element).setPointerCapture?.(e.pointerId); }}
              className={`absolute cursor-grab select-none ${sel === i.productId ? "outline outline-2 outline-accent" : ""}`} style={{ left: `${i.x / 10}%`, top: `${i.y / 10}%`, width: `${(i.scale / 1000) * 42}%`, transform: "translate(-50%,-50%)", zIndex: n }}><Media storageKey={c.image} alt="" className="pointer-events-none h-auto w-full" /></div>); })}
        </div>
        {sel && items.find((i) => i.productId === sel) && (() => { const it = items.find((i) => i.productId === sel)!; return <div className="glass mt-3 flex flex-wrap items-center gap-3 rounded-[var(--r-md)] p-3 text-sm"><label className="flex items-center gap-2">Scale<input type="range" min={300} max={2000} step={25} value={it.scale} onChange={(e) => patch(sel, { scale: Number(e.target.value) })} aria-label="Scale" /></label><Button variant="ghost" onClick={() => move(sel, -1)}>Send back</Button><Button variant="ghost" onClick={() => move(sel, 1)}>Bring forward</Button><Button variant="ghost" onClick={() => remove(sel)}>Remove</Button></div>; })()}
      </section>
      <section aria-label="Your outfit" className="house-outfit-summary grid h-fit gap-5"><p className="house-kicker">03 / Review your look</p>
        <div className="grid gap-1.5"><label htmlFor="oname" className="text-sm">Outfit name</label><input id="oname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-4" /></div>
        <ul className="divide-y divide-line">{items.map((i) => { const c = byId.get(i.productId)!; const line = currentPriced?.lines.find((l) => l.productId === i.productId); return (
          <li key={i.productId} className="py-3 text-sm"><div className="flex justify-between gap-3"><span>{c.name}<span className="block text-xs text-muted">{i.slot}</span></span><span>{line ? formatMoney(line.unitPrice, c.currency) : "…"}</span></div>
            {c.variants.length > 0 && <label className="mt-2 block"><span className="sr-only">Variant for {c.name}</span><select value={i.variantId ?? ""} onChange={(e) => patch(i.productId, { variantId: e.target.value || null })} className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3"><option value="">Choose size / colour</option>{c.variants.map((v) => <option key={v.id} value={v.id} disabled={!v.available}>{[v.colorName, v.size].filter(Boolean).join(" · ")}{v.available ? "" : " (sold out)"}</option>)}</select></label>}
            {line && !line.available && <p className="mt-1 text-red-400">Currently unavailable</p>}</li>); })}</ul>
        <p className="flex justify-between text-xl" aria-live="polite"><span>Total</span><span>{currentPriced ? formatMoney(currentPriced.total, currentPriced.currency) : "—"}</span></p>
        <div className="grid gap-2"><Button onClick={bag} disabled={pending || !complete}>{items.some((i) => !i.variantId) ? "Choose every size to add to bag" : "Add outfit to bag"}</Button>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={save} disabled={pending || items.length === 0}>{signedIn ? (savedId ? "Update saved outfit" : "Save outfit") : "Sign in to save"}</Button><Button variant="outline" onClick={share} disabled={pending || !savedId}>Share</Button></div></div>
        {shareUrl && <p className="break-all text-xs text-muted">{shareUrl}</p>}
        <p role="status" aria-live="polite" className={`min-h-5 text-sm ${msg?.ok ? "text-accent" : "text-red-400"}`}>{msg?.t}</p>
      </section>
    </div>
  );
}
