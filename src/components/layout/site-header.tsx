"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { BagDrawer } from "@/components/commerce/bag-drawer";

/** The two brand houses and signature Outfit Builder stay first-class destinations. */
const DESKTOP_NAV = [
  { href: "/brands/uthy-luxury", label: "UTHY LUXURY" },
  { href: "/brands/alomziee-footies", label: "ALOMZIEE FOOTIES" },
  { href: "/outfit-builder", label: "Outfit Builder" },
  { href: "/shop", label: "Shop all" },
  { href: "/collaborations", label: "Collaborations" },
] as const;

const MOBILE_NAV = [
  { href: "/", label: "Home" },
  { href: "/brands/uthy-luxury", label: "UTHY LUXURY" },
  { href: "/brands/alomziee-footies", label: "ALOMZIEE FOOTIES" },
  { href: "/outfit-builder", label: "Outfit Builder" },
  { href: "/collaborations", label: "Collaborations" },
  { href: "/#newsletter", label: "Join VÉRANE" },
] as const;

export function SiteHeader({ cartCount, signedIn }: { cartCount: number; signedIn: boolean }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const overHero = (path === "/" || path.startsWith("/brands/")) && !scrolled;
  const hidden = path.startsWith("/admin");

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);


  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      openerRef.current?.focus?.();
      return;
    }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])");
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", key); };
  }, [open]);

  if (hidden) return null;

  const util = (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/search" className="house-header-utility min-h-11 px-2 py-3 text-muted hover:text-fg">Search</Link>
      <Link href={signedIn ? "/account" : "/login"} className="house-header-utility min-h-11 px-2 py-3 text-muted hover:text-fg">{signedIn ? "Account" : "Sign in"}</Link>
      {signedIn && <Link href="/account/wishlist" className="hidden min-h-11 px-2 py-3 text-muted hover:text-fg xl:block">Wishlist</Link>}
      <BagDrawer initialCount={cartCount} />
    </div>
  );

  return (
    <header className={cn("house-site-header fixed inset-x-0 top-0 z-[var(--z-nav)] transition-[background,backdrop-filter] duration-[var(--dur-2)]", overHero ? "bg-transparent" : "glass border-x-0 border-t-0")}>
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-5 md:gap-5 md:px-10">
        <Link href="/" className="house-wordmark display shrink-0 text-xl tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]" aria-label="VÉRANE home">VÉRANE</Link>
        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-4 lg:flex xl:gap-6">{DESKTOP_NAV.map((n) => <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(n.href + "/") ? "page" : undefined} className="whitespace-nowrap text-xs text-muted transition-colors hover:text-fg aria-[current=page]:text-fg aria-[current=page]:underline aria-[current=page]:underline-offset-8 xl:text-sm">{n.label}</Link>)}</nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">{util}<button type="button" className="house-menu-button glass min-h-11 rounded-full px-3 text-[10px] uppercase tracking-[0.14em] sm:px-5 sm:text-xs lg:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => { openerRef.current = document.activeElement as HTMLElement; setOpen(true); }}>Menu</button></div>
      </div>
      {open && (
        <div ref={panelRef} id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="house-mobile-menu fixed inset-0 z-[var(--z-drawer)] flex flex-col overflow-y-auto px-6 pb-8 pt-4 backdrop-blur-xl sm:px-8">
          <div className="flex h-12 items-center justify-between"><span className="display text-2xl tracking-[0.2em]">VÉRANE</span><button ref={closeRef} type="button" className="glass min-h-11 rounded-full px-5 text-sm" onClick={() => setOpen(false)}>Close</button></div>
          <nav aria-label="Mobile" className="house-mobile-menu__nav mt-8 flex flex-1 flex-col justify-center gap-4">{MOBILE_NAV.map((n, i) => <Link key={n.href} href={n.href} className={cn("display text-4xl leading-none sm:text-5xl", i === 5 && "house-mobile-menu__join")} onClick={() => setOpen(false)}>{n.label}<span aria-hidden="true" className="ml-3 text-base opacity-60">↗</span></Link>)}</nav>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-sm">
            <Link href="/search" className="text-muted hover:text-fg" onClick={() => setOpen(false)}>Search the house</Link>
            {signedIn ? <Link href="/account" className="text-muted hover:text-fg" onClick={() => setOpen(false)}>Your account</Link> : <Link href="/login" className="text-muted hover:text-fg" onClick={() => setOpen(false)}>Sign in</Link>}
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.22em] text-muted">Two Brands. One Expression.</p>
        </div>)}
    </header>
  );
}
