"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteLink, SiteSettings } from "@/domains/site-content";

export function SiteFooter({ siteName = "VÉRANE", tagline = "Two Brands. One Expression.", footerLinks = [], footerNote = "", settings }: { siteName?: string; tagline?: string; footerLinks?: SiteLink[]; footerNote?: string; settings?: SiteSettings }) {
  if (usePathname().startsWith("/admin")) return null;
  return (
    <footer className="mt-32 border-t border-line">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-14 md:grid-cols-2 md:px-10">
        <div><p className="display text-3xl tracking-[0.2em]">{siteName}</p><p className="mt-3 text-sm text-muted">{tagline}</p></div>
        <nav aria-label="Site links" className="flex flex-col gap-2 text-sm">{footerLinks.map((item) => <Link key={item.href + item.label} href={item.href} className="text-muted hover:text-fg">{item.label}</Link>)}</nav>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-wrap gap-4 px-5 pb-10 text-sm text-muted md:px-10"><p>{(footerNote || "© VÉRANE").replace("©", "© " + new Date().getFullYear()).replace("©  ©", "©")}</p>{settings?.contactEmail && <a className="underline underline-offset-4" href={"mailto:" + settings.contactEmail}>{settings.contactEmail}</a>}{settings?.phone && <a className="underline underline-offset-4" href={"tel:" + settings.phone}>{settings.phone}</a>}{settings?.instagram && <a className="underline underline-offset-4" href={settings.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}{settings?.facebook && <a className="underline underline-offset-4" href={settings.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}{settings?.x && <a className="underline underline-offset-4" href={settings.x} target="_blank" rel="noopener noreferrer">X</a>}{settings?.youtube && <a className="underline underline-offset-4" href={settings.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>}</div>
    </footer>
  );
}
