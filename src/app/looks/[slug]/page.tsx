import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/infrastructure/db/client";
import { getLook } from "@/domains/content/public";
import { getCurrentUser } from "@/lib/http/session";
import { isLookSaved } from "@/domains/account";
import { Media } from "@/components/ui/media";
import { ShopTheLook } from "./shop-the-look";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const l = await getLook(getDb(), (await params).slug); if (!l) return {};
  return { title: l.look.seoTitle ?? l.look.title, description: l.look.seoDescription ?? l.look.description ?? undefined, alternates: { canonical: `/looks/${l.look.slug}` } };
}
export default async function LookPage({ params }: P) {
  const db = getDb(); const l = await getLook(db, (await params).slug); if (!l) notFound();
  const u = await getCurrentUser(); const saved = u?.kind === "customer" ? await isLookSaved(db, u.id, l.look.id) : false;
  return (
    <div data-brand={l.brand.themeKey} className="bg-bg text-fg">
      <div className="house-look-detail mx-auto grid max-w-[1600px] gap-8 px-5 pb-16 pt-24 md:grid-cols-[1.05fr_.95fr] md:gap-14 md:px-10">
        <div className="house-look-detail__image aspect-[4/5] overflow-hidden rounded-[var(--r-md)] bg-surface md:sticky md:top-24 md:self-start">{l.image ? <Media storageKey={l.image.storageKey} alt={l.image.altText ?? l.look.title} priority /> : <div className="grid h-full place-items-center text-muted">Look imagery coming soon</div>}</div>
        <div className="house-look-detail__copy md:pt-8"><p className="house-kicker">Shop the look / {l.brand.name}</p><h1 className="display mt-4 text-5xl md:text-7xl">{l.look.title}</h1>
          {l.look.description && <p className="mt-5 max-w-lg leading-relaxed text-muted">{l.look.description}</p>}{l.look.stylingNotes && <p className="mt-6 rounded-r-[var(--r-md)] border-l-2 border-accent bg-surface px-5 py-4 text-sm leading-relaxed">{l.look.stylingNotes}</p>}
          <ShopTheLook lookId={l.look.id} saved={saved} signedIn={u?.kind === "customer"} items={l.items.map(({ item, card, variants }) => ({ productId: card.product.id, name: card.product.name, slug: card.product.slug, brandSlug: card.brand.slug, image: card.image?.key ?? null, note: item.stylingNote, preselected: item.variantId, variants }))} /></div>
      </div>
    </div>
  );
}
