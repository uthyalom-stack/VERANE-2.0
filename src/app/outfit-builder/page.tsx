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
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-24 md:px-10">
      <h1 className="display text-5xl md:text-8xl">Outfit Builder</h1>
      <p className="mt-3 max-w-xl text-muted">Choose pieces, set sizes, and see the total. Prices and stock always come from the shop, never from this page.</p>
      {catalog.length === 0 ? <EmptyState title="No pieces to build with yet" /> : <OutfitBuilder catalog={catalog} initial={initial} initialName={saved?.outfit.name ?? ""} outfitId={saved?.outfit.id ?? null} signedIn={u?.kind === "customer"} />}
    </div>
  );
}
