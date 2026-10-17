import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/infrastructure/db/client";
import { trackingCampaigns, trackingCampaignVisits } from "@/infrastructure/db/schema";

export const dynamic = "force-dynamic";

/** Social short-link redirect. Only active campaign slugs resolve, and destinations are on-site paths. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const [campaign] = await db.select().from(trackingCampaigns).where(eq(trackingCampaigns.slug, slug)).limit(1);
  if (!campaign || !campaign.isActive) return NextResponse.redirect(new URL("/", request.url), 302);

  const existingVisitor = request.cookies.get("vr_visitor")?.value;
  const visitorHash = existingVisitor && /^[a-f0-9-]{36}$/i.test(existingVisitor) ? existingVisitor : crypto.randomUUID();
  const referrer = request.headers.get("referer");
  let referrerHost: string | null = null;
  if (referrer) {
    try { referrerHost = new URL(referrer).host.slice(0, 255); } catch { referrerHost = null; }
  }
  await db.insert(trackingCampaignVisits).values({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    brandId: campaign.brandId,
    visitorHash,
    destination: campaign.destination,
    referrerHost,
  });
  const response = NextResponse.redirect(new URL(campaign.destination, request.url), 302);
  response.cookies.set("vr_visitor", visitorHash, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  response.cookies.set("vr_campaign", campaign.id, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
