import { adminCtx } from "@/lib/admin";
import { brands, categories } from "@/infrastructure/db/schema";
import { can } from "@/domains/authorization";
import { PageHead } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProduct() {
  const { db, actor } = await adminCtx();
  const bs = (await db.select().from(brands)).filter((b) => can(actor, "catalog.product.write", b.id));
  return (<div><PageHead title="New product" sub="Add variants, stock and media after the product is created." /><div className="max-w-2xl"><ProductForm brands={bs} categories={await db.select().from(categories)} selectedCategoryIds={[]} /></div></div>);
}
