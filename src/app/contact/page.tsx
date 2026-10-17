import { getDb } from "@/infrastructure/db/client";
import { getSiteConfig, getStaticContent } from "@/domains/site-content";
export const dynamic = "force-dynamic";
export default async function ContactPage() {
 const db=getDb(); const [page,config]=await Promise.all([getStaticContent(db,"contact"),getSiteConfig(db)]); const s=config.settings;
 const wa=s.whatsapp?(s.whatsapp.startsWith("http")?s.whatsapp:"https://wa.me/"+s.whatsapp.replace(/\D/g,"")):"";
 return <article className="mx-auto max-w-3xl px-5 pb-24 pt-32 md:px-10"><p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted">Get in touch</p><h1 className="display text-5xl md:text-7xl">{page.title}</h1><div className="mt-8 whitespace-pre-wrap text-base leading-8 text-muted">{page.body}</div><div className="mt-10 grid gap-4 border-t border-line pt-6 text-sm">
 {s.contactEmail&&<p>Email: <a className="underline" href={"mailto:"+s.contactEmail}>{s.contactEmail}</a></p>}
 {s.phone&&<p>Phone: <a className="underline" href={"tel:"+s.phone}>{s.phone}</a></p>}
 {wa&&<p><a className="underline" href={wa} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp</a></p>}
 {s.instagram&&<p><a className="underline" href={s.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></p>}
 {s.facebook&&<p><a className="underline" href={s.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></p>}
 {s.x&&<p><a className="underline" href={s.x} target="_blank" rel="noopener noreferrer">X</a></p>}
 {s.youtube&&<p><a className="underline" href={s.youtube} target="_blank" rel="noopener noreferrer">YouTube</a></p>}
 {!s.contactEmail&&!s.phone&&!s.whatsapp&&<p className="text-muted">Contact details have not been configured yet.</p>}
 </div></article>;
}