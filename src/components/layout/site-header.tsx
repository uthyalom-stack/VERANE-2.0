"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { BagDrawer } from "@/components/commerce/bag-drawer";

/** Every entry maps to a route that exists in this build. */
export const NAV = [
  { href: "/shop", label: "Shop" }, { href: "/collections", label: "Collections" }, { href: "/looks", label: "Looks" },
  { href: "/outfit-builder", label: "Outfit Builder" }, { href: "/journal", label: "Journal" },
  { href: "/brands/uthy-luxury", label: "UTHY LUXURY" }, { href: "/brands/alomziee-footies", label: "ALOMZIEE FOOTIES" },
] as const;

export function SiteHeader({ cartCount, signedIn }: { cartCount: number; signedIn: boolean }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false); const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overHero = (path === "/" || path.startsWith("/brands/")) && !scrolled;
  const hidden = path.startsWith("/admin");

  useEffect(() => { const f = () => setScrolled(window.scrollY > 40); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => {
    if (!open) return; document.body.style.overflow = "hidden"; closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, [open]);
  if (hidden) return null;

  const util = (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/search" className="min-h-11 px-3 py-3 text-muted hover:text-fg">Search</Link>
      <Link href={signedIn ? "/account" : "/login"} className="min-h-11 px-3 py-3 text-muted hover:text-fg">{signedIn ? "Account" : "Sign in"}</Link>
      {signedIn && <Link href="/account/wishlist" className="hidden min-h-11 px-3 py-3 text-muted hover:text-fg md:block">Wishlist</Link>}
      <BagDrawer initialCount={cartCount} />
    </div>
  );
  return (
    <header className={cn("house-site-header fixed inset-x-0 top-0 z-[var(--z-nav)] transition-[background,backdrop-filter] duration-[var(--dur-2)]", overHero ? "bg-transparent" : "glass border-x-0 border-t-0")}>
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-6 px-5 md:px-10">
        <Link href="/" className="house-wordmark display text-2xl tracking-[0.2em]" aria-label="VÉRANE home">VÉRANE</Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 xl:flex">{NAV.map((n) => <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined} className="text-sm text-muted transition-colors hover:text-fg aria-[current=page]:text-fg aria-[current=page]:underline aria-[current=page]:underline-offset-8">{n.label}</Link>)}</nav>
        <div className="flex items-center gap-2">{util}<button type="button" className="house-menu-button glass min-h-11 rounded-full px-5 text-xs uppercase tracking-[0.14em] xl:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>Menu</button></div>
      </div>
      {open && (
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="house-mobile-menu fixed inset-0 z-[var(--z-drawer)] flex flex-col overflow-y-auto bg-bg/95 px-6 pb-10 pt-4 backdrop-blur-xl">
          <div className="flex h-12 items-center justify-between"><span className="display text-2xl tracking-[0.2em]">VÉRANE</span><button ref={closeRef} type="button" className="glass min-h-11 rounded-full px-5 text-sm" onClick={() => setOpen(false)}>Close</button></div>
          <nav aria-label="Mobile" className="house-mobile-menu__nav mt-8 flex flex-1 flex-col justify-center gap-3">{[...NAV, { href: "/search", label: "Search" }, { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in" }].map((n) => <Link key={n.href + n.label} href={n.href} className="display text-4xl leading-none sm:text-5xl" onClick={() => setOpen(false)}>{n.label}</Link>)}</nav>
          <p className="text-sm text-muted">Two Brands. One Expression.</p></div>)}
    </header>
  );
}
