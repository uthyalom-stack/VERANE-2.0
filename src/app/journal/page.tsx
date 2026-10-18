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
    <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-28 md:px-10">
      <h1 className="display text-6xl md:text-9xl">Journal</h1>
      <nav aria-label="Filter journal" className="mt-6 flex flex-wrap gap-2 text-sm">{KINDS.map(([k, l]) => <Link key={k} href={k ? `/journal?kind=${k}` : "/journal"} aria-current={(kind ?? "") === k ? "true" : undefined} className="rounded-full border border-line px-4 py-2 aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg">{l}</Link>)}</nav>
      {!lead ? <EmptyState title="No stories yet">Published stories, films and lookbooks will appear here.</EmptyState> : <>
        <Link href={`/journal/${lead.article.slug}`} className="group mt-10 grid gap-6 md:grid-cols-[1.6fr_1fr]"><div className="aspect-[16/10] overflow-hidden rounded-[var(--r-md)] bg-surface">{lead.cover && <Media storageKey={lead.cover.storageKey} alt={lead.cover.altText ?? lead.article.title} priority className="transition-transform duration-[1200ms] group-hover:scale-105" />}</div>
          <div className="self-end"><p className="text-xs text-muted">{lead.article.kind.replace(/_/g, " ")}</p><h2 className="display text-4xl md:text-6xl">{lead.article.title}</h2>{lead.article.excerpt && <p className="mt-3 text-muted">{lead.article.excerpt}</p>}</div></Link>
        <div className="mt-16 grid gap-8 md:grid-cols-3">{rest.map(({ article, cover }) => <Link key={article.id} href={`/journal/${article.slug}`} className="group"><div className="aspect-[4/3] overflow-hidden rounded-[var(--r-md)] bg-surface">{cover && <Media storageKey={cover.storageKey} alt={cover.altText ?? article.title} className="transition-transform duration-[var(--dur-3)] group-hover:scale-105" />}</div><p className="mt-3 text-xs text-muted">{article.kind.replace(/_/g, " ")}</p><h3 className="text-2xl leading-tight">{article.title}</h3></Link>)}</div></>}
    </div>
  );
}
