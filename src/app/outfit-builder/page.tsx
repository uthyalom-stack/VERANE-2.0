import type { Metadata } from "next";
import { getDb } from "@/infrastructure/db/client";
import { builderCatalog, loadOutfit } from "@/domains/outfit";
import { getCurrentUser } from "@/lib/http/session";
import { OutfitBuilder, type BuilderItem } from "./builder";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Outfit Builder", alternates: { canonical: "/outfit-builder" } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ outfit?: string }> }) {
  const db = getDb(); const u = await getCurrentUser(); const sp = await searchParams;
  const catalog = await builderCatalog(db);
  const saved = u?.kind === "customer" && sp.outfit ? await loadOutfit(db, { id: sp.outfit, userId: u.id }) : null;
  const initial: BuilderItem[] = saved ? saved.items.map((i) => ({ productId: i.productId, variantId: i.variantId, slot: i.slot, x: i.x, y: i.y, scale: i.scale, sortOrder: i.sortOrder })) : [];
  return (
    <div className="house-outfit-page mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-outfit-intro relative isolate overflow-hidden rounded-[var(--r-lg)] border border-line px-6 py-9 md:px-10 md:py-12">
        <div className="house-builder__glow" aria-hidden="true" />
        <p className="house-kicker relative">Your style / Your composition</p>
        <div className="relative mt-4 grid gap-5 md:grid-cols-[1fr_.7fr] md:items-end">
          <h1 className="display max-w-[10ch] text-5xl md:text-8xl">Compose your own expression.</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">Bring pieces from both houses together. Arrange your look, choose available variants, and see the live total before adding it to your bag.</p>
        </div>
        <div className="glass relative mt-7 inline-flex items-center gap-3 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em]"><span className="size-1.5 rounded-full bg-accent" /> Drag. Compose. Make it yours.</div>
      </div>
      {catalog.length === 0 ? <EmptyState title="No pieces to build with yet" /> : <OutfitBuilder catalog={catalog} initial={initial} initialName={saved?.outfit.name ?? ""} outfitId={saved?.outfit.id ?? null} signedIn={u?.kind === "customer"} />}
    </div>
  );
}
