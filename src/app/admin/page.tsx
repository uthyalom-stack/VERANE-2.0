import Link from "next/link";
import { requireAdmin } from "@/lib/http/session";

const sections = [
  { href: "/admin/products", title: "Products", description: "Product details, pricing, variants, publication and media.", permission: "catalog.product.write" },
  { href: "/admin/categories", title: "Categories", description: "Organise products into clothing, footwear and accessory categories.", permission: "catalog.category.write" },
  { href: "/admin/collections", title: "Collections", description: "Curated drops, collection status and product ordering.", permission: "catalog.collection.write" },
  { href: "/admin/inventory", title: "Inventory", description: "Current stock, reserved units and stock adjustments.", permission: "inventory.adjust" },
  { href: "/admin/orders", title: "Orders", description: "Payment status, order history and fulfilment.", permission: "orders.manage" },
  { href: "/admin/customers", title: "Customers", description: "Customers who have purchased within your permitted brand scope.", permission: "customers.read" },
  { href: "/admin/users", title: "Admin users", description: "Create administrators and grant or revoke scoped roles.", permission: "users.manage" },
  { href: "/admin/brands", title: "Brands", description: "Update the two house brand profiles and active status.", permission: "brands.write" },
  { href: "/admin/media", title: "Media library", description: "Review media assets and update alt text.", permission: "media.write" },
  { href: "/admin/content", title: "Editorial content", description: "Campaigns, looks, journal stories and page blocks.", permission: "content.write" },
  { href: "/admin/discounts", title: "Discounts", description: "Manage discount codes and redemption rules.", permission: "discounts.manage" },
  { href: "/admin/analytics", title: "Analytics", description: "Review event totals for the permitted brand scope.", permission: "analytics.read" },
  { href: "/admin/newsletter", title: "Newsletter", description: "Review marketing subscribers within your brand scope.", permission: "newsletter.read" },
  { href: "/admin/audit", title: "Audit log", description: "Review recorded administrative and commerce changes.", permission: "audit.read" },
  { href: "/admin/settings", title: "Integrations & readiness", description: "Check configuration status without exposing credentials.", permission: "config.read" },
];

export default async function AdminPage() {
  const { user, actor } = await requireAdmin();
  const allowed = sections.filter((section) => actor.grants.some((grant) => grant.permissions.has(section.permission)));
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">VÉRANE / HOUSE OPERATIONS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin workspace</h1>
          <p className="mt-2 text-sm text-neutral-600">Signed in as {user.name} · {user.email}</p>
        </div>
        <Link href="/" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50">View storefront</Link>
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {allowed.map((section) => (
          <Link key={section.href} href={section.href} className="group rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <span aria-hidden="true" className="text-neutral-400 transition group-hover:translate-x-1">↗</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{section.description}</p>
          </Link>
        ))}
      </section>
      {allowed.length === 0 ? <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Your account has no active admin permissions. Ask a SUPER_ADMIN to review your role grants.</p> : null}
    </main>
  );
}
