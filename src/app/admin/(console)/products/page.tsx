import { adminCtx } from "@/lib/admin";
import { listProductsForAdmin } from "@/domains/catalog/admin";
import { brands } from "@/infrastructure/db/schema";
import { PageHead, Table, Badge, statusTone, A, when } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { can } from "@/domains/authorization";

export default async function Products() {
  const { db, actor } = await adminCtx();
  const [list, bs] = await Promise.all([listProductsForAdmin(db, actor, { limit: 200 }), db.select().from(brands)]); const bn = new Map(bs.map((b) => [b.id, b.name]));
  const canCreate = bs.some((b) => can(actor, "catalog.product.write", b.id));
  return (<div><PageHead title="Products" action={canCreate ? <ButtonLink href="/admin/products/new">New product</ButtonLink> : undefined} />
    <Table head={["Name", "Brand", "Price", "Status", "Updated"]} rows={list.map((p) => [<A key="n" href={`/admin/products/${p.id}`}>{p.name}</A>, bn.get(p.brandId), formatMoney(p.basePrice, p.currency), <Badge key="s" tone={statusTone(p.status)}>{p.status}</Badge>, when(p.updatedAt)])} empty="No products in your scope yet." /></div>);
}
