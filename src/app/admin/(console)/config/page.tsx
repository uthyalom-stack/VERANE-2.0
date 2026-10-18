import { adminCtx } from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { integrationStatus } from "@/domains/admin/ops";
import { PageHead, Table, Badge } from "@/components/admin/ui";
export default async function Config() {
  const { actor } = await adminCtx(); const rows = integrationStatus(getEnv(), actor);
  return (<div><PageHead title="Configuration" sub="Which integrations are live. Secrets are never displayed." /><Table head={["Integration", "Driver", "Status"]} rows={rows.map((r) => [r.name, r.driver, <Badge key="s" tone={/MOCK|CONSOLE|missing/.test(r.status) ? "bad" : "ok"}>{r.status}</Badge>])} /></div>);
}
