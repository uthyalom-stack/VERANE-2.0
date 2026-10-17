import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { campaigns } from "@/infrastructure/db/schema";
import { assertCan } from "@/domains/authorization";
import { requireAdmin } from "@/lib/http/session";
import { saveCampaignAction } from "@/app/actions/admin";
import { AdminActionForm, AdminField, AdminSelect } from "@/components/admin/action-form";

export default async function AdminCampaignDetailPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {actor}=await requireAdmin(); const db=getDb();
  const [campaign]=await db.select().from(campaigns).where(eq(campaigns.id,id)); if(!campaign) notFound();
  assertCan(actor,"content.write",campaign.brandId);
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href="/admin/content" className="text-sm text-neutral-500">← Editorial content</Link><h1 className="mt-3 text-3xl font-semibold">{campaign.title}</h1>
    <section className="mt-8 rounded-2xl border p-5"><AdminActionForm action={saveCampaignAction} submitLabel="Save campaign"><input type="hidden" name="id" value={id}/><input type="hidden" name="brandId" value={campaign.brandId??""}/><input type="hidden" name="heroMediaId" value={campaign.heroMediaId??""}/><input type="hidden" name="heroMobileMediaId" value={campaign.heroMobileMediaId??""}/><input type="hidden" name="posterMediaId" value={campaign.posterMediaId??""}/><input type="hidden" name="seoTitle" value={campaign.seoTitle??""}/><input type="hidden" name="seoDescription" value={campaign.seoDescription??""}/>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><AdminField label="Title" name="title" defaultValue={campaign.title} required/><AdminField label="Slug" name="slug" defaultValue={campaign.slug} required/><AdminField label="Subtitle" name="subtitle" defaultValue={campaign.subtitle??""}/><AdminField label="CTA label" name="ctaLabel" defaultValue={campaign.ctaLabel??""}/><AdminField label="CTA URL" name="ctaHref" defaultValue={campaign.ctaHref??""}/><AdminSelect label="Status" name="status" defaultValue={campaign.status} options={[{label:"Draft",value:"draft"},{label:"Scheduled",value:"scheduled"},{label:"Published",value:"published"},{label:"Archived",value:"archived"}]}/><AdminField label="Starts at" name="startsAt" type="datetime-local" defaultValue={campaign.startsAt?campaign.startsAt.toISOString().slice(0,16):""}/><AdminField label="Ends at" name="endsAt" type="datetime-local" defaultValue={campaign.endsAt?campaign.endsAt.toISOString().slice(0,16):""}/></div>
    </AdminActionForm></section>
  </main>;
}
