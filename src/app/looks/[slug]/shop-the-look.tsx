"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import { addManyToBagAction } from "@/app/actions/content";
import { toggleSavedLookAction } from "@/app/actions/account";
import { BAG_CHANGED, BAG_OPEN } from "@/components/commerce/bag-drawer";

type V = { id: string; size: string | null; colorName: string | null; unitPrice: number; available: number; allowBackorder: boolean };
type Item = { productId: string; name: string; slug: string; brandSlug: string; image: string | null; note: string | null; preselected: string | null; variants: V[] };
const ok = (v: V) => v.available > 0 || v.allowBackorder;

/** Select available pieces + sizes, add them to the bag in one go. Server re-validates every variant. */
export function ShopTheLook({ lookId, items, saved, signedIn }: { lookId: string; items: Item[]; saved: boolean; signedIn: boolean }) {
  const [pick, setPick] = useState<Record<string, string | null>>(() => Object.fromEntries(items.map((i) => [i.productId, i.preselected && i.variants.find((v) => v.id === i.preselected && ok(v)) ? i.preselected : i.variants.filter(ok).length === 1 ? i.variants.find(ok)!.id : null])));
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.productId, i.variants.some(ok)])));
  const [msg, setMsg] = useState(""); const [isSaved, setSaved] = useState(saved); const [pending, start] = useTransition();
  const chosen = items.filter((i) => on[i.productId] && pick[i.productId]);
  const total = chosen.reduce((s, i) => s + (i.variants.find((v) => v.id === pick[i.productId])?.unitPrice ?? 0), 0);
  const missing = items.filter((i) => on[i.productId] && !pick[i.productId]);
  const add = () => start(async () => {
    const r = await addManyToBagAction(chosen.map((i) => pick[i.productId]!));
    setMsg(r.message ?? ""); if (r.data?.added) { window.dispatchEvent(new Event(BAG_CHANGED)); window.dispatchEvent(new Event(BAG_OPEN)); }
  });
  return (
    <div className="mt-8">
      <ul className="divide-y divide-line">{items.map((i) => { const avail = i.variants.some(ok); return (
        <li key={i.productId} className="flex gap-4 py-5">
          <input type="checkbox" aria-label={`Include ${i.name}`} className="mt-1 size-5 accent-[var(--accent)]" checked={!!on[i.productId]} disabled={!avail} onChange={(e) => setOn({ ...on, [i.productId]: e.target.checked })} />
          <div className="size-20 shrink-0 overflow-hidden rounded bg-surface">{i.image && <Media storageKey={i.image} alt="" />}</div>
          <div className="flex-1"><Link href={`/product/${i.slug}?brand=${i.brandSlug}`} className="underline-offset-4 hover:underline">{i.name}</Link>{i.note && <p className="text-xs text-muted">{i.note}</p>}
            {avail ? <label className="mt-2 block text-sm"><span className="sr-only">Size for {i.name}</span><select value={pick[i.productId] ?? ""} onChange={(e) => setPick({ ...pick, [i.productId]: e.target.value || null })} className="min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3">
              <option value="">Choose size{i.variants.some((v) => v.colorName) ? " / colour" : ""}</option>{i.variants.map((v) => <option key={v.id} value={v.id} disabled={!ok(v)}>{[v.colorName, v.size].filter(Boolean).join(" · ")} — {formatMoney(v.unitPrice)}{ok(v) ? "" : " (sold out)"}</option>)}</select></label>
              : <p className="mt-2 text-sm text-red-400">Sold out</p>}</div></li>); })}</ul>
      <div className="mt-6 flex items-center justify-between"><span className="text-sm text-muted">{chosen.length} selected</span><span className="text-xl">{formatMoney(total)}</span></div>
      <div className="mt-4 flex gap-3"><Button className="flex-1" onClick={add} disabled={pending || chosen.length === 0}>{missing.length ? `Choose sizes (${missing.length} left)` : "Add selected to bag"}</Button>
        <Button variant="outline" disabled={pending} aria-pressed={isSaved} onClick={() => start(async () => { if (!signedIn) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; } const r = await toggleSavedLookAction(lookId); if (r.ok) setSaved(!!r.data?.saved); })}>{isSaved ? "Saved" : "Save look"}</Button></div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-accent">{msg}</p>
    </div>
  );
}
