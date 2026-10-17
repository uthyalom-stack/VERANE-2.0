import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { getOrCreateBrandLanding } from "@/domains/admin/content";
import { brands, pageBlocks } from "@/infrastructure/db/schema";
import { BlockEditor } from "@/components/admin/block-editor";
import { BRAND_PAGE_BLOCKS } from "@/components/admin/block-defs";
import { A, PageHead, Panel } from "@/components/admin/ui";
import { savePageAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function BrandStorefrontEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, actor } = await adminCtx();
  const [brand] = await db.select().from(brands).where(eq(brands.id, id));
  if (!brand) notFound();
  const page = await getOrCreateBrandLanding(db, actor, brand.id);
  const blocks = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sortOrder));
  return <div>
    <PageHead title={`${brand.name} storefront`} sub="Build a brand-specific landing page with reusable product, collection, look, journal and campaign sections." action={<A href={`/brands/${brand.slug}`}>Preview storefront</A>} />
    <Panel title="Storefront sections">
      <p className="mb-4 text-sm text-muted">These sections appear on this brand&apos;s public page only. Product rails, collections, looks and journal stories are filtered to the selected brand. Save as draft while editing; publish when the page is ready.</p>
      <BlockEditor action={savePageAction} defs={BRAND_PAGE_BLOCKS} initial={blocks.map((b) => ({ type: b.type, data: b.data }))} hidden={{ pageId: page.id }} fieldName="blocks" statusField />
    </Panel>
  </div>;
}
