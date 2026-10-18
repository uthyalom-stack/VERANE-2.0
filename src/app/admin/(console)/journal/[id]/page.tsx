import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { journalArticles } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { PageHead, Panel, toLocalInput } from "@/components/admin/ui";
import { BlockEditor } from "@/components/admin/block-editor";
import { ARTICLE_BLOCKS } from "@/components/admin/block-defs";
import { saveArticleAction } from "@/app/actions/admin";

const KINDS: Array<[string, string]> = [["story", "Story"], ["interview", "Interview"], ["lookbook", "Lookbook"], ["styling_guide", "Styling guide"], ["film", "Film"], ["brand_story", "Brand story"], ["collaboration", "Collaboration"]];
const inp = "min-h-11 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-sm";
const Row = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <div className="grid gap-1"><label htmlFor={id} className="text-xs text-muted">{label}</label>{children}</div>;

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { db, actor } = await adminCtx();
  const [a] = await db.select().from(journalArticles).where(eq(journalArticles.id, id)); if (!a || !can(actor, "content.write", a.brandId)) notFound();
  const media = await listMedia(db, actor);
  const mediaOpts = (kind?: string) => [<option key="" value="">— none —</option>, ...media.filter((m) => !kind || m.kind === kind).map((m) => <option key={m.id} value={m.id}>{`${m.kind}: ${m.altText ?? m.id.slice(0, 8)}`}</option>)];
  const body = ((a.body ?? []) as Array<Record<string, unknown>>).map(({ type, ...data }) => ({ type: String(type), data }));
  const extra = (
    <div className="grid gap-4 md:grid-cols-2">
      <Row id="title" label="Title"><input id="title" name="title" required defaultValue={a.title} className={inp} /></Row><Row id="slug" label="Slug"><input id="slug" name="slug" defaultValue={a.slug} className={inp} /></Row>
      <Row id="kind" label="Kind"><select id="kind" name="kind" defaultValue={a.kind} className={inp}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row><Row id="authorName" label="Author"><input id="authorName" name="authorName" defaultValue={a.authorName ?? ""} className={inp} /></Row>
      <div className="md:col-span-2"><Row id="excerpt" label="Excerpt"><textarea id="excerpt" name="excerpt" rows={3} defaultValue={a.excerpt ?? ""} className="rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-sm" /></Row></div>
      <Row id="coverMediaId" label="Cover image"><select id="coverMediaId" name="coverMediaId" defaultValue={a.coverMediaId ?? ""} className={inp}>{mediaOpts("image")}</select></Row><Row id="videoMediaId" label="Film (video)"><select id="videoMediaId" name="videoMediaId" defaultValue={a.videoMediaId ?? ""} className={inp}>{mediaOpts("video")}</select></Row>
      <Row id="status" label="Status"><select id="status" name="status" defaultValue={a.status} className={inp}>{["draft", "scheduled", "published", "archived"].map((s) => <option key={s}>{s}</option>)}</select></Row><Row id="publishAt" label="Publish at"><input id="publishAt" name="publishAt" type="datetime-local" defaultValue={toLocalInput(a.publishAt)} className={inp} /></Row>
      <Row id="seoTitle" label="SEO title"><input id="seoTitle" name="seoTitle" defaultValue={a.seoTitle ?? ""} className={inp} /></Row><Row id="seoDescription" label="SEO description"><input id="seoDescription" name="seoDescription" defaultValue={a.seoDescription ?? ""} className={inp} /></Row>
    </div>);
  return (<div><PageHead title={a.title} sub="Articles can embed products, Looks and collections." />
    <Panel><BlockEditor flat action={saveArticleAction} defs={ARTICLE_BLOCKS} initial={body} hidden={{ id: a.id, brandId: a.brandId ?? "" }} fieldName="body" extra={extra} /></Panel></div>);
}
