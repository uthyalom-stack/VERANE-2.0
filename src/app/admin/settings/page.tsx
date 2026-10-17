import Link from "next/link";
import { getEnv } from "@/lib/env";
import { integrationStatus } from "@/domains/admin/ops";
import { requireAdmin } from "@/lib/http/session";

export default async function AdminSettingsPage() {
  const {actor}=await requireAdmin(); const rows=integrationStatus(getEnv(),actor);
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Integration readiness</h1><p className="mt-2 text-sm text-neutral-600">Read-only diagnostics. Secret values are never displayed here. Confirm these settings against the production deployment environment before launch.</p><section className="mt-8 overflow-hidden rounded-2xl border"><div className="divide-y">{rows.map(r=><div key={r.name} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr]"><div className="font-medium">{r.name}</div><div className="text-sm text-neutral-600">{r.driver}</div><div><span className={r.status==="configured"?"rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800":r.status==="optional"?"rounded-full bg-neutral-100 px-3 py-1 text-xs":"rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900"}>{r.status}</span></div></div>)}</div></section></main>;
}
