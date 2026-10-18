import Link from "next/link";
import { requireCustomer } from "@/lib/http/session";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
const LINKS = [["/account", "Profile"], ["/account/orders", "Orders"], ["/account/addresses", "Addresses"], ["/account/wishlist", "Wishlist"], ["/account/looks", "Saved Looks"], ["/account/outfits", "Saved outfits"]] as const;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const u = await requireCustomer();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-10 pt-28 md:grid-cols-[220px_1fr] md:px-10">
      <nav aria-label="Account" className="flex gap-4 overflow-x-auto md:flex-col md:gap-2">
        <p className="hidden text-sm text-muted md:block">{u.email}</p>
        {LINKS.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap py-2 text-sm text-muted hover:text-fg">{l}</Link>)}
        <form action={logoutAction}><button className="py-2 text-sm text-muted underline">Sign out</button></form>
      </nav>
      <div>{children}</div>
    </div>
  );
}
