import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { brands, mediaAssets } from "@/infrastructure/db/schema";
import { scopedBrandIds } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { updateAltAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField } from "@/components/admin/action-form";

export default async function AdminMediaPage() {
  const {actor}=await requireAdmin(); const db=getDb(); const scope=scopedBrandIds(actor,"media.write");
  const rows=await db.select({media:mediaAssets,brandName:brands.name}).from(mediaAssets).leftJoin(brands,eq(brands.id,mediaAssets.brandId)).where(scope==="all"?undefined:inArray(mediaAssets.brandId,scope)).orderBy(desc(mediaAssets.createdAt)).limit(200);
  return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Link href="/admin" className="text-sm text-neutral-500">← Admin workspace</Link><h1 className="mt-3 text-3xl font-semibold">Media library</h1><p className="mt-2 text-sm text-neutral-600">This view reviews registered media assets and lets you improve alt text. Upload/delete workflows are not exposed here yet.</p>
    <section className="mt-8 overflow-hidden rounded-2xl border"><div className="border-b px-5 py-4 font-semibold">Assets ({rows.length})</div><div className="divide-y">{rows.map(({media:m,brandName})=><div key={m.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr]"><div><p className="font-medium">{m.storageKey}</p><p className="mt-1 text-xs text-neutral-500">{brandName??"House-wide"} · {m.kind} · {m.mimeType} · {m.byteSize.toLocaleString()} bytes{m.isPlaceholder?" · placeholder":""}</p><p className="mt-1 break-all text-xs text-neutral-400">{m.id}</p></div><AdminActionForm action={updateAltAction} submitLabel="Save alt text"><input type="hidden" name="id" value={m.id}/><AdminField label="Alt text" name="altText" defaultValue={m.altText??""}/></AdminActionForm></div>)}{rows.length===0?<p className="px-5 py-8 text-sm text-neutral-500">No media assets are available in your scope.</p>:null}</div></section>
  </main>;
}
