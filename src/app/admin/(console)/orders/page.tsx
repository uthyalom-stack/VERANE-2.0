import { adminCtx } from "@/lib/admin";
import { listOrdersForAdmin } from "@/domains/orders/queries";
import { PageHead, Table, Badge, statusTone, A, when } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";

export default async function Orders() {
  const { db, actor } = await adminCtx(); const list = await listOrdersForAdmin(db, actor);
  return (<div><PageHead title="Orders" sub="Brand admins see orders containing their brand's items." />
    <Table head={["Order", "Placed", "Customer", "Status", "Payment", "Total"]} rows={list.map((o) => [<A key="o" href={`/admin/orders/${o.id}`}>{o.orderNumber}</A>, when(o.createdAt), o.email, <Badge key="s" tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge>, <Badge key="p" tone={statusTone(o.paymentStatus)}>{o.paymentStatus}</Badge>, formatMoney(o.total, o.currency)])} empty="No orders yet." /></div>);
}
