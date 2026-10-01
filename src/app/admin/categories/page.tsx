import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { db } from "@/infrastructure/database/client";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { CatalogRepository } from "@/domains/catalog/catalog-repository";
import { CatalogService } from "@/domains/catalog/catalog-service";

export default async function AdminCategoriesPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  if (!authService.isAdministrator(authUser)) redirect("/account");

  const catalogRepo = new CatalogRepository(db);
  const catalogService = new CatalogService(catalogRepo, authService);

  const categories = await catalogService.listCategories(authUser);

  return (
    <div className="max-w-4xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← Back to Portal</Link>
          <h1 className="text-2xl font-bold">Catalog Categories ({categories.length})</h1>
        </div>
      </div>

      <div className="border rounded divide-y">
        {categories.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No categories found for your brand scope.</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-base">{c.name}</h3>
                <p className="text-xs text-gray-500">Slug: {c.slug} | Scope: {c.brandId ? `Brand (${c.brandId})` : "Global"}</p>
              </div>
              <span className={`text-xs font-mono px-2 py-0.5 border rounded ${c.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {c.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
