import Link from "next/link";
import { getDb } from "@/infrastructure/db/client";
import { brands } from "@/infrastructure/db/schema";
import { listSubscribers } from "@/domains/admin/ops";
import { requireAdmin } from "@/lib/http/session";

export default async function AdminNewsletterPage() {
  const {actor}=await requireAdmin(); const rows=await listSubscribers(getDb(),actor,300); const brandRows=await getDb().select().from(brands);
  const names=new Map(brandRows.map(b=>[b.id,b.name]));
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Newsletter subscribers</h1><p className="mt-2 text-sm text-neutral-600">Consent records only. This page does not send campaigns or export data.</p><section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Subscribers ({rows.length})</div><div className="divide-y">{rows.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-medium">{r.email}</p><p className="mt-1 text-xs text-neutral-500">{names.get(r.brandId??"")??"House-wide"} · consent: {r.consent?"yes":"no"}</p></div><span className="text-xs text-neutral-500">{r.createdAt.toLocaleDateString()}</span></div>)}</div></section></main>;
}
