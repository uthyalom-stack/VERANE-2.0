"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  if (usePathname().startsWith("/admin")) return null;
  return (
    <footer className="mt-32 border-t border-line">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-14 md:grid-cols-4 md:px-10">
        <div><p className="display text-3xl tracking-[0.2em]">VÉRANE</p><p className="mt-3 text-sm text-muted">Two Brands. One Expression.</p></div>
        <nav aria-label="Shop" className="flex flex-col gap-2 text-sm">{[["/shop", "Shop"], ["/collections", "Collections"], ["/looks", "Looks"], ["/outfit-builder", "Outfit Builder"], ["/journal", "Journal"]].map(([h, l]) => <Link key={h} href={h!} className="text-muted hover:text-fg">{l}</Link>)}</nav>
        <nav aria-label="Houses" className="flex flex-col gap-2 text-sm"><Link href="/brands/uthy-luxury" className="text-muted hover:text-fg">UTHY LUXURY</Link><Link href="/brands/alomziee-footies" className="text-muted hover:text-fg">ALOMZIEE FOOTIES</Link></nav>
        <nav aria-label="Help" className="flex flex-col gap-2 text-sm"><Link href="/account" className="text-muted hover:text-fg">Account</Link><Link href="/orders/lookup" className="text-muted hover:text-fg">Find an order</Link><Link href="/search" className="text-muted hover:text-fg">Search</Link></nav>
      </div>
      <p className="mx-auto max-w-[1600px] px-5 pb-10 text-sm text-muted md:px-10">© {new Date().getFullYear()} VÉRANE</p>
    </footer>
  );
}
