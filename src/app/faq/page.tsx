import { getDb } from "@/infrastructure/db/client";
import { getStaticContent } from "@/domains/site-content";
export const dynamic = "force-dynamic";
export default async function FaqPage() {
  const page = await getStaticContent(getDb(), "faq");
  return <article className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10"><p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted">Help</p><h1 className="display text-5xl md:text-7xl">{page.title}</h1><div className="mt-8 whitespace-pre-wrap text-base leading-8 text-muted">{page.body}</div><div className="mt-10 divide-y divide-line border-y border-line">{(page.faqs ?? []).map((item, i) => <details key={item.question + i} className="py-5"><summary className="cursor-pointer text-lg">{item.question}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{item.answer}</p></details>)}</div></article>;
}