import { and, eq, inArray, sql } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { inventoryLevels, orderItems, orders, productVariants, products } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { analyticsSummary } from "@/domains/admin/ops";
import { PageHead, Panel, Table, A } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

export default async function Overview() {
  const { db, actor } = await adminCtx(); const since = new Date(Date.now() - 30 * 86400_000);
  const scope = scopedBrandIds(actor, "orders.read");
  const paid = scope === "all"
    ? (await db.select({ n: sql<number>`count(*)`, t: sql<number>`coalesce(sum(${orders.total}),0)` }).from(orders).where(and(eq(orders.paymentStatus, "paid"), sql`${orders.createdAt} >= ${since.getTime()}`)))[0]!
    : scope.length ? (await db.select({ n: sql<number>`count(distinct ${orders.id})`, t: sql<number>`coalesce(sum(${orderItems.lineTotal}),0)` }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(eq(orders.paymentStatus, "paid"), inArray(orderItems.brandId, scope), sql`${orders.createdAt} >= ${since.getTime()}`)))[0]! : { n: 0, t: 0 };
  const iscope = scopedBrandIds(actor, "inventory.read");
  const low = iscope === "all" || iscope.length ? await db.select({ sku: productVariants.sku, name: products.name, avail: sql<number>`${inventoryLevels.onHand} - ${inventoryLevels.reserved}`, th: inventoryLevels.lowStockThreshold, variantId: productVariants.id }).from(inventoryLevels).innerJoin(productVariants, eq(productVariants.id, inventoryLevels.variantId)).innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(sql`${inventoryLevels.onHand} - ${inventoryLevels.reserved} <= ${inventoryLevels.lowStockThreshold}`, eq(productVariants.isActive, true), iscope === "all" ? undefined : inArray(products.brandId, iscope))).limit(10) : [];
  const events = await analyticsSummary(db, actor);
  return (<div><PageHead title="Overview" sub="Last 30 days. Figures are computed from your orders; nothing is estimated." />
    <div className="mb-8 grid gap-4 sm:grid-cols-2"><div className="rounded-[var(--r-md)] border border-line p-5"><p className="text-sm text-muted">Paid orders</p><p className="display mt-2 text-5xl">{paid.n}</p></div><div className="rounded-[var(--r-md)] border border-line p-5"><p className="text-sm text-muted">Revenue</p><p className="display mt-2 text-5xl">{formatMoney(paid.t)}</p></div></div>
    <Panel title="Low stock"><Table head={["Product", "SKU", "Available", ""]} rows={low.map((l) => [l.name, l.sku, l.avail, <A key="a" href="/admin/inventory">Adjust</A>])} empty="No variants at or below their threshold." /></Panel>
    <Panel title="Storefront events"><Table head={["Event", "Count"]} rows={events.map((e) => [e.name, e.n])} empty="No events recorded yet." /></Panel></div>);
}
