import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { adminCtx } from "@/lib/admin";
import { analyticsSummary } from "@/domains/admin/ops";
import { scopedBrandIds } from "@/domains/authorization";
import { brands, orders, orderItems } from "@/infrastructure/db/schema";
import { formatMoney } from "@/lib/money";
import { PageHead, Panel, Table } from "@/components/admin/ui";

export default async function Analytics({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { db, actor } = await adminCtx();
  const params = await searchParams;
  // eslint-disable-next-line react-hooks/purity -- server-rendered analytics intentionally uses the request-time date window
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const validDate = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T00:00:00.000Z").getTime()) && new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
  let from = validDate(params.from) ? params.from! : defaultFrom;
  let to = validDate(params.to) ? params.to! : today;
  if (from > to) { from = defaultFrom; to = today; }
  const since = Date.parse(from + "T00:00:00.000Z");
  const until = Date.parse(to + "T00:00:00.000Z") + 24 * 60 * 60 * 1000;
  const scope = scopedBrandIds(actor, "analytics.read");
  const canRead = scope === "all" || scope.length > 0;

  const [events, brandRows] = await Promise.all([
    analyticsSummary(db, actor, 30, { from: since, to: until }),
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
          sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`,
        )))[0] ?? { count: 0, revenue: 0 }
      : (await db.select({
          count: sql<number>`count(distinct ${orders.id})`,
          revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(
          eq(orders.paymentStatus, "paid"),
          inArray(orderItems.brandId, scope),
          sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`,
        )))[0] ?? { count: 0, revenue: 0 };

  const statusRows = !canRead ? [] : scope === "all"
    ? await db.select({
        status: orders.status,
        count: sql<number>`count(*)`,
      }).from(orders).where(sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`).groupBy(orders.status).orderBy(desc(sql`count(*)`))
    : await db.select({
        status: orders.status,
        count: sql<number>`count(distinct ${orders.id})`,
      }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(and(
        inArray(orderItems.brandId, scope),
        sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`,
      )).groupBy(orders.status).orderBy(desc(sql`count(distinct ${orders.id})`));

  const topProducts = !canRead ? [] : scope === "all"
    ? await db.select({
        name: orderItems.productName,
        brandId: orderItems.brandId,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(
        eq(orders.paymentStatus, "paid"),
        sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`,
      )).groupBy(orderItems.productName, orderItems.brandId).orderBy(desc(sql`sum(${orderItems.lineTotal})`)).limit(10)
    : await db.select({
        name: orderItems.productName,
        brandId: orderItems.brandId,
        units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`,
      }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(
        eq(orders.paymentStatus, "paid"),
        inArray(orderItems.brandId, scope),
        sql`${orders.createdAt} >= ${since} AND ${orders.createdAt} < ${until}`,
      )).groupBy(orderItems.productName, orderItems.brandId).orderBy(desc(sql`sum(${orderItems.lineTotal})`)).limit(10);

  const brandNames = new Map(brandRows.map((b) => [b.id, b.name]));

  return (
    <div>
      <PageHead title="Analytics" sub={`Real store activity from ${from} through ${to}. Revenue includes paid orders only; brand-scoped views use that brand's item totals.`} />
      <form method="get" className="mb-8 flex flex-wrap items-end gap-3 rounded-[var(--r-md)] border border-line p-4">
        <label className="grid gap-1 text-xs text-muted">From
          <input type="date" name="from" defaultValue={from} max={to} className="min-h-10 rounded border border-line bg-surface px-3 text-sm text-fg" />
        </label>
        <label className="grid gap-1 text-xs text-muted">To
          <input type="date" name="to" defaultValue={to} min={from} className="min-h-10 rounded border border-line bg-surface px-3 text-sm text-fg" />
        </label>
        <button type="submit" className="min-h-10 rounded border border-line px-4 text-sm hover:bg-surface">Apply dates</button>
        <a href="/admin/analytics" className="min-h-10 px-3 py-2 text-sm underline underline-offset-4">Reset</a>
      </form>
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
