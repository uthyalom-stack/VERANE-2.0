import { adminCtx } from "@/lib/admin";
import { brands, categories } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { listMedia } from "@/domains/media";
import { PageHead } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProduct() {
  const { db, actor } = await adminCtx();
  const [brandRows, categoryRows, media] = await Promise.all([db.select().from(brands), db.select().from(categories), listMedia(db, actor)]);
  const bs = brandRows.filter((b) => can(actor, "catalog.product.write", b.id));
  const mediaOptions: Array<[string, string]> = media.filter((m) => m.kind === "image").map((m) => [m.id, `${m.altText ?? m.storageKey}`]);
  return (<div><PageHead title="New product" sub="Add variants, stock and media after the product is created." /><div className="max-w-2xl"><ProductForm brands={bs} categories={categoryRows} selectedCategoryIds={[]} mediaOptions={mediaOptions} /></div></div>);
}
