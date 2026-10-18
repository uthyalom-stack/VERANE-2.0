import Link from "next/link";
import { requireAdmin } from "@/lib/http/session";
import { logoutAction } from "@/app/actions/auth";
import type { Actor } from "@/domains/authorization";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const has = (a: Actor, p: string) => a.grants.some((g) => g.permissions.has(p));
const NAV: Array<[string, string, string]> = [
  ["/admin", "Overview", ""], ["/admin/products", "Products", "catalog.product.read"], ["/admin/categories", "Categories", "catalog.category.write"], ["/admin/collections", "Collections", "catalog.collection.write"],
  ["/admin/inventory", "Inventory", "inventory.read"], ["/admin/media", "Media", "media.write"], ["/admin/orders", "Orders", "orders.read"], ["/admin/customers", "Customers", "customers.read"],
  ["/admin/discounts", "Discounts", "discounts.write"], ["/admin/brands", "Brands", "brands.write"], ["/admin/looks", "Looks", "content.write"], ["/admin/campaigns", "Campaigns", "content.write"],
  ["/admin/journal", "Journal", "content.write"], ["/admin/pages", "Homepage", "content.write"], ["/admin/newsletter", "Newsletter", "newsletter.read"], ["/admin/analytics", "Analytics", "analytics.read"],
  ["/admin/users", "Users & roles", "users.manage"], ["/admin/audit", "Audit log", "audit.read"], ["/admin/config", "Configuration", "config.read"],
];
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, actor } = await requireAdmin();
  const scope = [...new Set(actor.grants.map((g) => g.roleCode))].join(", ");
  return (
    <div className="grid min-h-screen md:grid-cols-[230px_1fr]">
      <aside className="border-b border-line p-4 md:border-b-0 md:border-r">
        <Link href="/admin" className="display text-2xl tracking-[0.2em]">VÉRANE</Link><p className="mt-1 text-xs text-muted">Admin · {scope}</p>
        <nav aria-label="Admin" className="mt-6 flex gap-1 overflow-x-auto text-sm md:flex-col">{NAV.filter(([, , p]) => !p || has(actor, p)).map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded px-3 py-2 text-muted hover:bg-surface hover:text-fg">{l}</Link>)}</nav>
        <form action={logoutAction} className="mt-6"><p className="mb-2 truncate text-xs text-muted">{user.email}</p><button className="text-sm underline">Sign out</button></form>
        <Link href="/" className="mt-4 block text-xs text-muted underline">View storefront</Link>
      </aside>
      <div className="min-w-0 p-5 md:p-10">{children}</div>
    </div>
  );
}
