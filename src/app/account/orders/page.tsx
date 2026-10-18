import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { requireCustomer } from "@/lib/http/session";
import { listOrdersForUser } from "@/domains/orders/queries";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };
export default async function Orders() {
  const u = await requireCustomer("/account/orders"); const list = await listOrdersForUser(getDb(), u.id);
  return (<div><h1 className="display text-6xl">Orders</h1>
    {list.length === 0 ? <EmptyState title="No orders yet" action={<ButtonLink href="/shop">Start shopping</ButtonLink>} /> :
      <ul className="mt-8 divide-y divide-line">{list.map((o) => <li key={o.id}><Link href={`/orders/${o.orderNumber}`} className="flex justify-between gap-4 py-5 hover:bg-surface"><span>{o.orderNumber}<span className="block text-sm text-muted">{o.createdAt.toLocaleDateString("en-NG")} · {o.status.replace(/_/g, " ")}</span></span><span>{formatMoney(o.total, o.currency)}</span></Link></li>)}</ul>}</div>);
}
