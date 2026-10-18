import { adminCtx } from "@/lib/admin";
import { analyticsSummary } from "@/domains/admin/ops";
import { PageHead, Table } from "@/components/admin/ui";
export default async function Analytics() {
  const { db, actor } = await adminCtx(); const rows = await analyticsSummary(db, actor, 30);
  return (<div><PageHead title="Analytics" sub="Event counts, last 30 days. Events carry no personal data; failures to record never affect checkout." /><Table head={["Event", "Count"]} rows={rows.map((r) => [r.name, r.n])} empty="No events recorded yet." /></div>);
}
