import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { analyticsSummary } from "@/domains/admin/ops";
import { requireAdmin } from "@/lib/http/session";

export default async function AdminAnalyticsPage() {
  const {actor}=await requireAdmin(); const rows=await analyticsSummary(getDb(),actor,30);
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Analytics</h1><p className="mt-2 text-sm text-neutral-600">Event totals for the last 30 days, restricted to the brands you are authorised to view.</p><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(r=><div key={r.name} className="rounded-2xl border p-5"><p className="text-sm text-neutral-500">{r.name}</p><p className="mt-2 text-3xl font-semibold">{Number(r.n).toLocaleString()}</p></div>)}</section>{rows.length===0?<p className="mt-8 rounded-xl border p-5 text-sm text-neutral-500">No analytics events are available in this scope yet.</p>:null}</main>;
}
