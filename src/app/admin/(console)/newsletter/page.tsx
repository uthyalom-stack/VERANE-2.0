import { adminCtx } from "@/lib/admin";
import { listSubscribers } from "@/domains/admin/ops";
import { PageHead, Table, Badge, when } from "@/components/admin/ui";
export default async function Newsletter() {
  const { db, actor } = await adminCtx(); const list = await listSubscribers(db, actor);
  return (<div><PageHead title="Newsletter" sub="Marketing consent only. Transactional email is separate." /><Table head={["Email", "Consented", "Status"]} rows={list.map((s) => [s.email, when(s.consentedAt), s.unsubscribedAt ? <Badge key="s" tone="bad">Unsubscribed</Badge> : <Badge key="s" tone="ok">Subscribed</Badge>])} empty="No subscribers yet." /></div>);
}
