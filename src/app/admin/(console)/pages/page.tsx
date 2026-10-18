import { asc, eq } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { getOrCreateHome } from "@/domains/admin/content";
import { pageBlocks } from "@/infrastructure/db/schema";
import { PageHead, Panel, Badge, statusTone } from "@/components/admin/ui";
import { BlockEditor } from "@/components/admin/block-editor";
import { PAGE_BLOCKS } from "@/components/admin/block-defs";
import { savePageAction } from "@/app/actions/admin";
import { HomeBlocks } from "@/components/home/blocks";

/** Homepage layout is data. Editing never needs a deploy; preview below renders the saved blocks (even when still a draft). */
export default async function PagesAdmin() {
  const { db, actor } = await adminCtx();
  const page = await getOrCreateHome(db, actor);
  const blocks = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return (<div><PageHead title="Homepage" action={<Badge tone={statusTone(page.status)}>{page.status}</Badge>} sub="Arrange blocks, save a draft, preview below, then publish." />
    <Panel title="Blocks"><BlockEditor action={savePageAction} defs={PAGE_BLOCKS} fieldName="blocks" statusField hidden={{ pageId: page.id }} initial={blocks.map((b) => ({ type: b.type, data: b.data }))} /></Panel>
    <Panel title="Preview (saved blocks)"><div data-preview className="overflow-hidden rounded-[var(--r-md)] border border-line"><HomeBlocks db={db} blocks={blocks.filter((b) => b.isVisible).map((b) => ({ id: b.id, type: b.type, data: b.data }))} /></div></Panel></div>);
}
