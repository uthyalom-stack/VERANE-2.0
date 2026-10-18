import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/server";
import { pageBlocks, pages } from "@/infrastructure/db/schema";
import { HomeBlocks } from "@/components/home/blocks";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic"; // TODO(PROGRESS.md): switch to tag-based revalidation once CMS publish hooks exist

export default async function Home() {
  const db = getDb();
  const [page] = await db.select().from(pages).where(and(eq(pages.kind, "home"), eq(pages.status, "published"), isNull(pages.brandId)));
  const blocks = page ? await db.select().from(pageBlocks).where(and(eq(pageBlocks.pageId, page.id), eq(pageBlocks.isVisible, true))).orderBy(asc(pageBlocks.sortOrder)) : [];
  if (!page || blocks.length === 0) {
    return <div className="pt-32"><EmptyState title="The house is being prepared" action={<ButtonLink href="/shop">Browse the shop</ButtonLink>}>No homepage campaign has been published yet. Publish one from the admin content editor, or run the development seed.</EmptyState></div>;
  }
  return <HomeBlocks db={db} blocks={blocks.map((b) => ({ id: b.id, type: b.type, data: b.data }))} />;
}
