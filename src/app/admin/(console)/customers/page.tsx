import { adminCtx } from "@/lib/admin";
import { listCustomers } from "@/domains/admin/ops";
import { PageHead, Table, when } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
export default async function Customers() {
  const { db, actor } = await adminCtx(); const list = await listCustomers(db, actor);
  return (<div><PageHead title="Customers" sub="People who have placed orders in your scope." /><Table head={["Email", "Name", "Orders", "Spend", "Last order"]} rows={list.map((c) => [c.email, c.name ?? "Guest", c.n, formatMoney(c.spent), when(new Date(Number(c.last)))])} empty="No customers yet." /></div>);
}
