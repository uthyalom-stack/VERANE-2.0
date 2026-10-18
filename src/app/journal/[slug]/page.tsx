import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/infrastructure/db/client";
import { getArticle } from "@/domains/content/public";
import { mediaUrl } from "@/infrastructure/storage";
import { Media } from "@/components/ui/media";
import { ProductCard } from "@/components/commerce/product-card";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await getArticle(getDb(), (await params).slug); if (!a) return {};
  return { title: a.article.seoTitle ?? a.article.title, description: a.article.seoDescription ?? a.article.excerpt ?? undefined, alternates: { canonical: `/journal/${a.article.slug}` }, openGraph: { type: "article", title: a.article.title } };
}
export default async function ArticlePage({ params }: P) {
  const a = await getArticle(getDb(), (await params).slug); if (!a) notFound();
  const cover = a.article.coverMediaId ? a.media.get(a.article.coverMediaId) : null; const video = a.article.videoMediaId ? a.media.get(a.article.videoMediaId) : null;
  return (
    <article className="pb-10 pt-24">
      <header className="mx-auto max-w-4xl px-5 text-center"><p className="text-sm text-muted">{a.article.kind.replace(/_/g, " ")}{a.article.authorName && ` · ${a.article.authorName}`}</p><h1 className="display mt-3 text-5xl md:text-8xl">{a.article.title}</h1>{a.article.excerpt && <p className="mx-auto mt-5 text-lg text-muted">{a.article.excerpt}</p>}</header>
      <div className="mx-auto mt-12 max-w-[1400px] px-5 md:px-10">
        {video ? <video controls playsInline preload="metadata" poster={cover ? mediaUrl(cover.storageKey) : undefined} className="aspect-video w-full rounded-[var(--r-md)] bg-surface"><source src={mediaUrl(video.storageKey)} type={video.mimeType} /><track kind="captions" /></video>
          : cover && <div className="aspect-[16/8] overflow-hidden rounded-[var(--r-md)]"><Media storageKey={cover.storageKey} alt={cover.altText ?? a.article.title} priority /></div>}</div>
      <div className="mx-auto mt-14 grid max-w-2xl gap-6 px-5 text-lg leading-relaxed">
        {a.blocks.map((b, i) => {
          if (b.type === "paragraph") return <p key={i}>{b.text}</p>;
          if (b.type === "heading") return <h2 key={i} className="display mt-8 text-4xl">{b.text}</h2>;
          if (b.type === "quote") return <blockquote key={i} className="display my-6 border-l-2 border-accent pl-6 text-3xl">{b.text}{b.cite && <footer className="mt-2 font-[family-name:var(--body)] text-sm text-muted">{b.cite}</footer>}</blockquote>;
          if (b.type === "image" && b.mediaId) { const m = a.media.get(b.mediaId); return m ? <figure key={i} className="-mx-5 md:-mx-24"><Media storageKey={m.storageKey} alt={b.alt ?? m.altText ?? ""} className="rounded-[var(--r-md)]" /></figure> : null; }
          if (b.type === "product_embed") { const c = a.embeds.find((x) => x.product.id === b.refId); return c ? <div key={i} className="max-w-xs"><ProductCard item={c} /></div> : null; }
          if (b.type === "look_embed") { const l = a.embeddedLooks.find((x) => x.look.slug === b.slug); return l ? <Link key={i} href={`/looks/${l.look.slug}`} className="glass rounded-[var(--r-md)] p-5 no-underline">Shop the Look — <span className="display text-2xl">{l.look.title}</span></Link> : null; }
          if (b.type === "collection_embed") { const c = a.embeddedCollections.find((x) => x.collection.slug === b.slug); return c ? <Link key={i} href={`/collections/${c.collection.slug}`} className="glass rounded-[var(--r-md)] p-5 no-underline">Explore the collection — <span className="display text-2xl">{c.collection.title}</span></Link> : null; }
          return null; })}
      </div>
    </article>
  );
}
