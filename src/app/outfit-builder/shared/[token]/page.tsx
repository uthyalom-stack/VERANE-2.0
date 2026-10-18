import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/infrastructure/db/client";
import { loadOutfit, resolveOutfit, builderCatalog } from "@/domains/outfit";
import { Media } from "@/components/ui/media";
import { formatMoney } from "@/lib/money";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Shared outfit", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const db = getDb(); const o = await loadOutfit(db, { shareToken: (await params).token }); if (!o) notFound();
  const priced = await resolveOutfit(db, o.items.map((i) => ({ productId: i.productId, variantId: i.variantId, slot: i.slot, x: i.x, y: i.y, scale: i.scale, sortOrder: i.sortOrder }))).catch(() => null);
  const cat = new Map((await builderCatalog(db)).map((c) => [c.id, c]));
  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-28">
      <p className="text-sm text-muted">A shared outfit</p><h1 className="display text-5xl md:text-7xl">{o.outfit.name}</h1>
      {!priced ? <p className="mt-8 text-muted">Some pieces in this outfit are no longer available.</p> : <>
        <ul className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">{priced.lines.map((l) => { const c = cat.get(l.productId); return <li key={l.productId}><div className="aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface">{c?.image && <Media storageKey={c.image} alt={l.name} />}</div><p className="mt-2 text-sm">{l.name}</p><p className="text-xs text-muted">{formatMoney(l.unitPrice, l.currency)}{!l.available && " · sold out"}</p></li>; })}</ul>
        <p className="mt-8 text-2xl">Total {formatMoney(priced.total, priced.currency)}</p></>}
      <ButtonLink href="/outfit-builder" className="mt-8">Build your own</ButtonLink>
    </div>
  );
}
