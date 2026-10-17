"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { addToBagAction } from "@/app/actions/cart";
import { toggleWishlistAction } from "@/app/actions/account";
import { BAG_CHANGED, BAG_OPEN } from "./bag-drawer";
import { PRODUCT_VARIANT_CHANGED } from "./variant-events";

export type PanelVariant = { id: string; size: string | null; colorName: string | null; colorHex: string | null; unitPrice: number; available: number; allowBackorder: boolean };

/** Variant selection + add to bag + wishlist. Sticky on mobile. Price shown is informational; server re-prices. */
export function PurchasePanel({ productId, currency, variants, wished, signedIn, productName, customSizingEnabled = false, preOrderEnabled = false, fulfillmentTime = null }: { productId: string; currency: string; variants: PanelVariant[]; wished: boolean; signedIn: boolean; productName: string; customSizingEnabled?: boolean; preOrderEnabled?: boolean; fulfillmentTime?: string | null }) {
  const colors = useMemo(() => [...new Map(variants.filter((v) => v.colorName).map((v) => [v.colorName!, v.colorHex])).entries()], [variants]);
  const [color, setColor] = useState<string | null>(colors[0]?.[0] ?? null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [isWished, setWished] = useState(wished);
  const inColor = variants.filter((v) => !color || v.colorName === color);
  const sizes = [...new Set(inColor.map((v) => v.size).filter(Boolean))] as string[];
  const chosen = inColor.find((v) => (sizes.length ? v.size === size : true));
  useEffect(() => { window.dispatchEvent(new CustomEvent(PRODUCT_VARIANT_CHANGED, { detail: { variantId: chosen?.id ?? null } })); }, [chosen?.id]);
  const sellable = (v?: PanelVariant) => !!v && (v.available > 0 || v.allowBackorder || preOrderEnabled);
  const isPreOrder = !!chosen && preOrderEnabled && chosen.available <= 0 && !chosen.allowBackorder;
  const maxQty = chosen ? (chosen.allowBackorder || isPreOrder ? 10 : Math.max(1, Math.min(10, chosen.available))) : 1;
  const needSize = sizes.length > 0 && !size;

  const add = () => start(async () => {
    if (!chosen) { setMsg({ ok: false, text: "Choose a size first" }); return; }
    let normalizedMeasurements: Record<string, number> | undefined;
    if (customSizingEnabled) {
      const required = ["chest", "waist", "hips", "length"];
      if (required.some((key) => !measurements[key] || !Number.isFinite(Number(measurements[key])))) { setMsg({ ok: false, text: "Enter chest, waist, hips and length measurements in centimetres." }); return; }
      normalizedMeasurements = Object.fromEntries(Object.entries(measurements).filter(([, value]) => value.trim() !== "").map(([key, value]) => [key, Number(value)]));
    }
    const r = await addToBagAction(chosen.id, qty, normalizedMeasurements);
    setMsg({ ok: r.ok, text: r.message ?? (r.ok ? "Added to your bag" : "Could not add") });
    if (r.ok) { window.dispatchEvent(new Event(BAG_CHANGED)); window.dispatchEvent(new Event(BAG_OPEN)); }
  });
  const wish = () => start(async () => {
    if (!signedIn) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
    const r = await toggleWishlistAction(productId, chosen?.id ?? null);
    if (r.ok) setWished(!!r.data?.saved);
  });

  return (
    <div>
      <p className="mt-6 text-2xl" aria-live="polite">{formatMoney(chosen?.unitPrice ?? Math.min(...variants.map((v) => v.unitPrice)), currency)}</p>
      {colors.length > 0 && (
        <fieldset className="mt-8"><legend className="mb-2 text-sm"><span className="text-muted">Colour: </span>{color}</legend>
          <div className="flex gap-3">{colors.map(([name, hex]) => (
            <label key={name} className="relative"><input type="radio" name="color" className="peer sr-only" checked={color === name} onChange={() => { setColor(name); setSize(null); setMsg(null); }} />
              <span className="block size-11 rounded-full border border-line peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2" style={{ background: hex ?? "transparent" }} title={name} /><span className="sr-only">{name}</span></label>))}</div></fieldset>)}
      {sizes.length > 0 && (
        <fieldset className="mt-6"><legend className="mb-2 text-sm text-muted">Size</legend>
          <div className="flex flex-wrap gap-2">{sizes.map((s) => { const v = inColor.find((x) => x.size === s); const ok = sellable(v); return (
            <label key={s}><input type="radio" name="size" className="peer sr-only" disabled={!ok} checked={size === s} onChange={() => { setSize(s); setQty(1); setMsg(null); }} />
              <span className={`block min-h-11 min-w-11 cursor-pointer rounded-[var(--r-sm)] border border-line px-4 py-2.5 text-center text-sm peer-checked:bg-accent peer-checked:text-accent-fg peer-focus-visible:outline peer-focus-visible:outline-2 ${ok ? "" : "cursor-not-allowed text-muted line-through"}`}>{s}<span className="sr-only">{ok ? "" : ", sold out"}</span></span></label>); })}</div>
          {chosen && chosen.available > 0 && chosen.available <= 3 && !chosen.allowBackorder && <p className="mt-2 text-xs text-accent">Only {chosen.available} left</p>}</fieldset>)}
      {customSizingEnabled && <section className="mt-7 rounded-[var(--r-md)] border border-line p-4"><p className="text-sm font-medium">Made to your measurements</p><p className="mt-1 text-xs text-muted">Enter measurements in centimetres. Chest, waist, hips and length are required.</p><div className="mt-4 grid grid-cols-2 gap-3">{[["chest","Chest",true],["waist","Waist",true],["hips","Hips",true],["length","Length",true],["shoulder","Shoulder",false],["sleeve","Sleeve",false],["inseam","Inseam",false]].map(([key,label,required]) => <label key={String(key)} className="grid gap-1 text-xs"><span>{String(label)}{required ? " *" : " (optional)"}</span><input type="number" min={required ? 20 : 10} max={required ? 250 : 150} step="0.5" required={Boolean(required)} value={measurements[String(key)] ?? ""} onChange={(e) => setMeasurements((current) => ({ ...current, [String(key)]: e.target.value }))} className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm" /></label>)}</div></section>}
      {isPreOrder && <p className="mt-4 rounded-[var(--r-sm)] border border-line p-3 text-sm">Available to pre-order{fulfillmentTime ? " · Estimated lead time: " + fulfillmentTime : ""}. Payment is taken at checkout.</p>}
      <div className="mt-6 flex items-center gap-4"><span className="text-sm text-muted">Quantity</span>
        <div className="flex items-center rounded-full border border-line" role="group" aria-label="Quantity">
          <button type="button" className="min-h-11 min-w-11" aria-label="Decrease" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button><span className="min-w-8 text-center text-sm">{qty}</span>
          <button type="button" className="min-h-11 min-w-11" aria-label="Increase" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>+</button></div></div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line bg-bg/90 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button onClick={add} disabled={pending || (!!chosen && !sellable(chosen)) || variants.every((v) => !sellable(v))} className="flex-1">{variants.every((v) => !sellable(v)) ? "Sold out" : needSize ? "Select a size" : pending ? "Adding…" : isPreOrder ? "Pre-order" : "Add to bag"}</Button>
        <Button variant="outline" onClick={wish} disabled={pending} aria-pressed={isWished} aria-label={isWished ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}>{isWished ? "Saved" : "Save"}</Button>
      </div>
      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${msg?.ok ? "text-accent" : "text-red-400"}`}>{msg?.text}</p>
    </div>
  );
}
