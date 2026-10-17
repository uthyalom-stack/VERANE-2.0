"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { requireAdmin } from "@/lib/http/session";
import { assertCan } from "@/domains/authorization";
import { writeAudit } from "@/domains/audit";
import { DEFAULT_SETTINGS, DEFAULT_NAVIGATION, DEFAULT_FOOTER_LINKS, getSiteConfig, getStaticContent, saveSiteRecord } from "@/domains/site-content";
import { mediaAssets } from "@/infrastructure/db/schema";
import { fd, run } from "@/lib/http/action";
const linksSchema = z.array(z.object({ label: z.string().trim().min(1).max(60), href: z.string().trim().min(1).max(300).refine(v => /^\/(?!\/)/.test(v) || /^https:\/\//.test(v), "Use an internal path or HTTPS URL") })).max(20);
const text = (v: string | undefined, max: number) => z.string().trim().max(max).parse(v ?? "");
const safeUrl = (v: string | undefined) => z.string().trim().max(300).refine(s => !s || /^https:\/\//i.test(s), "Use an HTTPS URL").parse(v ?? "");
function parseJson<T>(v: string | undefined, schema: z.ZodType<T>, fallback: T): T { if (!v?.trim()) return fallback; let parsed: unknown; try { parsed = JSON.parse(v); } catch { throw new Error("JSON is invalid. Check commas and quotation marks."); } return schema.parse(parsed); }
export async function saveSiteContentAction(form: FormData): Promise<void> {
 const result = await run(async () => {
  const { actor } = await requireAdmin(); assertCan(actor, "content.write", null);
  const db = getDb(), r = fd(form);
  const section = z.enum(["settings", "navigation", "footer", "about", "contact", "faq"]).parse(r.section);
  let slug: string = section, title: string = section, type: string = section; let data: Record<string, unknown>;
  if (section === "settings") {
   const old = (await getSiteConfig(db)).settings;
   const email = z.string().trim().max(160).refine(v => !v || z.string().email().safeParse(v).success, "Enter a valid email address").parse(r.contactEmail ?? "");
   const whatsapp = z.string().trim().max(100).refine(v => !v || /^https:\/\//i.test(v) || /^[+0-9() .-]+$/.test(v), "Use an HTTPS link or phone number").parse(r.whatsapp ?? "");
   const selectedMedia = { uthyHeroMediaId: null, alomzieHeroMediaId: null, logoMediaId: text(r.logoMediaId, 100) || null, faviconMediaId: text(r.faviconMediaId, 100) || null };
   const selectedBrandMedia = Object.fromEntries(Object.entries(r).filter(([key, value]) => key.startsWith("brandHeroMedia:") && typeof value === "string" && value.trim()).map(([key, value]) => [key.slice("brandHeroMedia:".length), value]));
   for (const id of [...Object.values(selectedBrandMedia), selectedMedia.logoMediaId, selectedMedia.faviconMediaId]) { if (typeof id !== "string" || !id) continue; const [asset] = await db.select({ id: mediaAssets.id, kind: mediaAssets.kind }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1); if (!asset || asset.kind !== "image") throw new Error("Select a valid image from the Media library."); }
   data = { ...old, ...selectedMedia, brandHeroMedia: selectedBrandMedia, siteName: text(r.siteName, 80) || DEFAULT_SETTINGS.siteName, tagline: text(r.tagline, 180), announcementEnabled: r.announcementEnabled === "on", announcementText: text(r.announcementText, 240), contactEmail: email, phone: text(r.phone, 60), whatsapp, instagram: safeUrl(r.instagram), facebook: safeUrl(r.facebook), x: safeUrl(r.x), youtube: safeUrl(r.youtube) };
   slug = "site-settings"; title = "Site settings"; type = "site_settings";
  } else if (section === "navigation") { data = { links: parseJson(r.links, linksSchema, DEFAULT_NAVIGATION) }; slug = "site-navigation"; title = "Site navigation"; type = "site_navigation";
  } else if (section === "footer") { data = { links: parseJson(r.links, linksSchema, DEFAULT_FOOTER_LINKS), note: text(r.note, 240) }; slug = "site-footer"; title = "Site footer"; type = "site_footer";
  } else {
   const old = await getStaticContent(db, section); data = { title: text(r.title, 120) || old.title, body: text(r.body, 8000) }; type = "static_content";
   if (section === "faq") data.faqs = z.array(z.object({ question: z.string().trim().min(1).max(240), answer: z.string().trim().min(1).max(2000) })).max(80).parse((r.faqs ?? "").split("\n").map(x => x.trim()).filter(Boolean).map(line => { const i = line.indexOf("|"); if (i < 1) throw new Error("Each FAQ line must use: question | answer"); return { question: line.slice(0, i).trim(), answer: line.slice(i + 1).trim() }; }));
  }
  const pageId = await saveSiteRecord(db, slug, title, type, data);
  await writeAudit(db, { actorUserId: actor.userId, action: "site_content.save", entityType: "site_content", entityId: slug, after: { section, pageId } });
  for (const p of ["/", "/about", "/contact", "/faq", "/admin/site-content", "/admin/analytics"]) revalidatePath(p);
  return { ok: true, message: "Saved" };
 });
 if (!result.ok) redirect("/admin/site-content?error=1");
 redirect("/admin/site-content?saved=1");
}
