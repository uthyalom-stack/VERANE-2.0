import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { listArticles } from "@/domains/content/public";
import { Media } from "@/components/ui/media";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Journal", alternates: { canonical: "/journal" } };
export const dynamic = "force-dynamic";
const KINDS = [["", "All"], ["story", "Stories"], ["interview", "Interviews"], ["lookbook", "Lookbooks"], ["styling_guide", "Styling"], ["film", "Films"], ["brand_story", "Brands"], ["collaboration", "Collaborations"]];

export default async function Journal({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const kind = (await searchParams).kind; const list = await listArticles(getDb(), { kind });
  const [lead, ...rest] = list;
  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-28 md:px-10">
      <div className="house-index-intro flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="house-kicker">Culture, craft and perspective</p><h1 className="display mt-4 text-6xl md:text-9xl">Journal</h1></div><p className="max-w-sm text-sm leading-relaxed text-muted">Stories, styling notes, films and conversations from both creative worlds.</p></div>
      <nav aria-label="Filter journal" className="mt-8 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">{KINDS.map(([k, l]) => <Link key={k} href={k ? `/journal?kind=${k}` : "/journal"} aria-current={(kind ?? "") === k ? "true" : undefined} className="rounded-full border border-line px-4 py-2.5 transition-colors hover:border-accent aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{l}</Link>)}</nav>
      {!lead ? <EmptyState title="No stories yet">Published stories, films and lookbooks will appear here.</EmptyState> : <>
        <Link href={`/journal/${lead.article.slug}`} className="house-journal-lead group mt-12 grid gap-6 md:grid-cols-[1.55fr_1fr] md:gap-10"><div className="house-index-card__media relative aspect-[16/10] overflow-hidden rounded-[var(--r-md)] bg-surface">{lead.cover ? <Media storageKey={lead.cover.storageKey} alt={lead.cover.altText ?? lead.article.title} priority className="transition-transform duration-[1200ms] group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted">Editorial artwork coming soon</div>}<span className="glass absolute bottom-4 left-4 rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em]">Featured story ↗</span></div>
          <div className="self-end pb-2"><p className="house-kicker">{lead.article.kind.replace(/_/g, " ")}</p><h2 className="display mt-4 text-4xl md:text-6xl transition-colors group-hover:text-accent">{lead.article.title}</h2>{lead.article.excerpt && <p className="mt-4 text-sm leading-relaxed text-muted">{lead.article.excerpt}</p>}<span className="mt-7 inline-flex border-b border-line pb-2 text-xs uppercase tracking-[0.16em]">Read the story ↗</span></div></Link>
        <div className="mt-16 grid gap-x-6 gap-y-10 md:grid-cols-3">{rest.map(({ article, cover }) => <Link key={article.id} href={`/journal/${article.slug}`} className="house-index-card group"><div className="house-index-card__media relative aspect-[4/3] overflow-hidden rounded-[var(--r-md)] bg-surface">{cover ? <Media storageKey={cover.storageKey} alt={cover.altText ?? article.title} className="transition-transform duration-[var(--dur-3)] group-hover:scale-105" /> : <div className="grid h-full place-items-center text-muted">Editorial artwork coming soon</div>}</div><p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-muted">{article.kind.replace(/_/g, " ")}</p><h3 className="mt-2 text-2xl leading-tight transition-colors group-hover:text-accent">{article.title}</h3>{article.excerpt && <p className="mt-3 text-sm leading-relaxed text-muted">{article.excerpt}</p>}</Link>)}</div></>}
    </div>
  );
}
