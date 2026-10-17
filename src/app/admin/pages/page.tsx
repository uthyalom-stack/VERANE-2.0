import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pageBlocks, pages } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { savePageAction } from "@/app/actions/admin";
import { AdminActionForm, AdminSelect } from "@/components/admin/action-form";

export default async function AdminPagesPage() {
  const {actor}=await requireAdmin(); const db=getDb(); const scope=scopedBrandIds(actor,"content.write");
  const pageRows=await db.select().from(pages).where(scope==="all"?undefined:inArray(pages.brandId,scope)).orderBy(asc(pages.title)).limit(100);
  const ids=pageRows.map(p=>p.id); const blocks=ids.length?await db.select().from(pageBlocks).where(inArray(pageBlocks.pageId,ids)).orderBy(asc(pageBlocks.sortOrder)):[];
  const byPage=new Map<string,Array<{type:string;data:unknown}>>();
  for(const b of blocks){const list=byPage.get(b.pageId)??[];list.push({type:b.type,data:b.data});byPage.set(b.pageId,list);}
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin/content" className="text-sm text-neutral-500">← Editorial content</Link><h1 className="mt-3 text-3xl font-semibold">Page builder</h1><p className="mt-2 text-sm text-neutral-600">Edit the ordered block JSON for a page. The server validates every block before saving; invalid JSON or unsupported block data is rejected.</p>
    <div className="mt-8 space-y-5">{pageRows.map(p=><section key={p.id} className="rounded-2xl border p-5"><div className="mb-4"><h2 className="text-lg font-semibold">{p.title}</h2><p className="text-xs text-neutral-500">{p.kind} · {p.slug||"/"} · {p.status}</p></div><AdminActionForm action={savePageAction} submitLabel="Save page blocks"><input type="hidden" name="pageId" value={p.id}/><div className="grid gap-4 sm:grid-cols-[1fr_2fr]"><AdminSelect label="Publication status" name="status" defaultValue={p.status==="published"?"published":"draft"} options={[{label:"Draft",value:"draft"},{label:"Published",value:"published"}]}/><label className="block space-y-1.5 text-sm"><span className="font-medium">Blocks JSON</span><textarea name="blocks" rows={12} defaultValue={JSON.stringify(byPage.get(p.id)??[],null,2)} className="w-full rounded-xl border px-3 py-2.5 font-mono text-xs"/></label></div></AdminActionForm></section>)}</div>
    {pageRows.length===0?<p className="mt-8 rounded-xl border p-5 text-sm text-neutral-500">No pages are available in your brand scope.</p>:null}
  </main>;
}
