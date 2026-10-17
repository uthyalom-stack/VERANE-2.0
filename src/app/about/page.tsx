import { getDb } from "@/infrastructure/db/client";
import { getStaticContent } from "@/domains/site-content";
export const dynamic = "force-dynamic";
export default async function AboutPage() {
 const page = await getStaticContent(getDb(), "about");
 return <article className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10"><p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted">The house</p><h1 className="display text-5xl md:text-7xl">{page.title}</h1><div className="mt-8 whitespace-pre-wrap text-base leading-8 text-muted">{page.body}</div></article>;
}