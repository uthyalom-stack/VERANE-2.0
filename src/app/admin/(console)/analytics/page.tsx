import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { analyticsSummary } from "@/domains/admin/ops";
import { scopedBrandIds } from "@/domains/authorization";
import { brands, orders, orderItems } from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/money";
import { PageHead, Panel, Table } from "@/components/admin/ui";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default async function Analytics() {
  const { db, actor } = await adminCtx();
  const since = Date.now() - WINDOW_MS;
  const scope = scopedBrandIds(actor, "analytics.read");
  const canRead = scope === "all" || scope.length > 0;

  const [events, brandRows] = await Promise.all([
    analyticsSummary(db, actor, 30),
    db.select({ id: brands.id, name: brands.name }).from(brands),
  ]);

  const paidOrders = !canRead
    ? { count: 0, revenue: 0 }
    : scope === "all"
      ? (await db.select({
          count: sql<number>`count(*)`,
          revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
        }).from(orders).where(and(
          eq(orders.paymentStatus, "paid"),
          sql`${orders.createdAt} >= ${since}`,
        )))[0] ?? { count: 0, revenue: 0 }
      : (await db.select({
          count: sql<number>`count(distinct ${orders.id})`,
          revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(
          eq(orders.paymentStatus, "paid"),
          inArray(orderItems.brandId, scope),
          sql`${orders.createdAt} >= ${since}`,
        )))[0] ?? { count: 0, revenue: 0 };

  const statusRows = !canRead ? [] : scope === "all"
    ? await db.select({
        status: orders.status,
        count: sql<number>`count(*)`,
      }).from(orders).where(sql`${orders.createdAt} >= ${since}`).groupBy(orders.status).orderBy(desc(sql`count(*)`))
    : await db.select({
        status: orders.status,
        count: sql<number>`count(distinct ${orders.id})`,
      }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(
        inArray(orderItems.brandId, scope),
        sql`${orders.createdAt} >= ${since}`,
      )).groupBy(orders.status).orderBy(desc(sql`count(distinct ${orders.id})`));

  const topProducts = !canRead ? [] : scope === "all"
    ? await db.select({
        name: orderItems.productName,
        brandId: orderItems.brandId,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(
        eq(orders.paymentStatus, "paid"),
        sql`${orders.createdAt} >= ${since}`,
      )).groupBy(orderItems.productName, orderItems.brandId).orderBy(desc(sql`sum(${orderItems.lineTotal})`)).limit(10)
    : await db.select({
        name: orderItems.productName,
        brandId: orderItems.brandId,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(
        eq(orders.paymentStatus, "paid"),
        inArray(orderItems.brandId, scope),
        sql`${orders.createdAt} >= ${since}`,
      )).groupBy(orderItems.productName, orderItems.brandId).orderBy(desc(sql`sum(${orderItems.lineTotal})`)).limit(10);

  const brandNames = new Map(brandRows.map((b) => [b.id, b.name]));

  return (
    <div>
      <PageHead title="Analytics" sub="Real store activity for the last 30 days. Revenue includes paid orders only; brand-scoped views use that brand's item totals." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--r-md)] border border-line p-5">
          <p className="text-sm text-muted">Paid orders</p>
          <p className="display mt-2 text-5xl">{paidOrders.count}</p>
        </div>
        <div className="rounded-[var(--r-md)] border border-line p-5">
          <p className="text-sm text-muted">{scope === "all" ? "Paid revenue (orders)" : "Paid item revenue (brand)"}</p>
          <p className="display mt-2 text-4xl md:text-5xl">{formatMoney(paidOrders.revenue)}</p>
        </div>
      </div>
      <Panel title="Top-selling products">
        <Table head={["Product", "Brand", "Units sold", "Item revenue"]} rows={topProducts.map((p) => [
          p.name,
          brandNames.get(p.brandId) ?? "Unknown brand",
          p.units,
          formatMoney(p.revenue),
        ])} empty="No paid product sales recorded in this period." />
      </Panel>
      <Panel title="Orders by status">
        <Table head={["Status", "Orders"]} rows={statusRows.map((r) => [r.status.replaceAll("_", " "), r.count])} empty="No orders recorded in this period." />
      </Panel>
      <Panel title="Storefront activity">
        <p className="mb-4 text-sm text-muted">Privacy-preserving event counts. Events are best-effort and never block checkout.</p>
        <Table head={["Event", "Count"]} rows={events.map((r) => [r.name.replaceAll("_", " "), r.n])} empty="No events recorded yet." />
      </Panel>
    </div>
  );
}
