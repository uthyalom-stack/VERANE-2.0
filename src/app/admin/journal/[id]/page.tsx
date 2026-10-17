import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { journalArticles } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveArticleAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminJournalDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {actor}=await requireAdmin(); const db=getDb();
  const [article]=await db.select().from(journalArticles).where(eq(journalArticles.id,id)); if(!article) notFound();
  assertCan(actor,"content.write",article.brandId);
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin/content" className="text-sm text-neutral-500">← Editorial content</Link><h1 className="mt-3 text-3xl font-semibold">{article.title}</h1><p className="mt-2 text-sm text-neutral-600">Structured body content is JSON and is revalidated by the server on save.</p>
    <section className="mt-8 rounded-2xl border p-5"><AdminActionForm action={saveArticleAction} submitLabel="Save journal story"><input type="hidden" name="id" value={id}/><input type="hidden" name="brandId" value={article.brandId??""}/><input type="hidden" name="coverMediaId" value={article.coverMediaId??""}/><input type="hidden" name="videoMediaId" value={article.videoMediaId??""}/><input type="hidden" name="seoTitle" value={article.seoTitle??""}/><input type="hidden" name="seoDescription" value={article.seoDescription??""}/>
      <div className="grid gap-4 sm:grid-cols-2"><AdminField label="Title" name="title" defaultValue={article.title} required/><AdminField label="Slug" name="slug" defaultValue={article.slug} required/><AdminSelect label="Story type" name="kind" defaultValue={article.kind} options={[{label:"Story",value:"story"},{label:"Interview",value:"interview"},{label:"Lookbook",value:"lookbook"},{label:"Styling guide",value:"styling_guide"},{label:"Film",value:"film"},{label:"Brand story",value:"brand_story"},{label:"Collaboration",value:"collaboration"}]}/><AdminField label="Author" name="authorName" defaultValue={article.authorName??""}/><AdminSelect label="Status" name="status" defaultValue={article.status} options={[{label:"Draft",value:"draft"},{label:"Scheduled",value:"scheduled"},{label:"Published",value:"published"},{label:"Archived",value:"archived"}]}/><AdminField label="Publish date" name="publishAt" type="datetime-local" defaultValue={article.publishAt?article.publishAt.toISOString().slice(0,16):""}/></div>
      <label className="mt-4 block space-y-1.5 text-sm"><span className="font-medium">Excerpt</span><textarea name="excerpt" defaultValue={article.excerpt??""} rows={3} className="w-full rounded-xl border px-3 py-2.5"/></label>
      <label className="mt-4 block space-y-1.5 text-sm"><span className="font-medium">Body blocks JSON</span><textarea name="body" defaultValue={JSON.stringify(article.body??[],null,2)} rows={16} className="w-full rounded-xl border px-3 py-2.5 font-mono text-xs"/></label>
    </AdminActionForm></section>
  </main>;
}
