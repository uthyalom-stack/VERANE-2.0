import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { listAudit } from "@/domains/admin/ops";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";

export default async function AdminAuditPage() {
  const {actor}=await requireAdmin(); assertCan(actor,"audit.read",null);
  const rows=await listAudit(getDb(),actor,200);
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Audit log</h1><p className="mt-2 text-sm text-neutral-600">Latest recorded administrative and commerce events. Sensitive payloads are intentionally not expanded here.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Recent events ({rows.length})</div><div className="divide-y">{rows.map(r=><div key={r.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_2fr]"><div><p className="font-medium">{r.action}</p><p className="mt-1 text-xs text-neutral-500">{r.entityType} · {r.entityId??"—"}</p></div><p className="break-all text-xs text-neutral-500">Actor: {r.actorUserId??"system"} · Brand: {r.brandId??"global"}</p><p className="text-sm text-neutral-500">{r.createdAt.toLocaleString()}</p></div>)}</div></section>
  </main>;
}
