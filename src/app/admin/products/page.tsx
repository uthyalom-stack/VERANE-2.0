import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { db } from "@/infrastructure/database/client";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { CatalogRepository } from "@/domains/catalog/catalog-repository";
import { CatalogService } from "@/domains/catalog/catalog-service";

export default async function AdminProductsPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  if (!authService.isAdministrator(authUser)) redirect("/account");

  const catalogRepo = new CatalogRepository(db);
  const catalogService = new CatalogService(catalogRepo, authService);

  const products = await catalogService.listProducts(authUser);

  return (
    <div className="max-w-4xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← Back to Portal</Link>
          <h1 className="text-2xl font-bold">Catalog Products ({products.length})</h1>
        </div>
      </div>

      <div className="border rounded divide-y">
        {products.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No products found for your brand scope.</p>
        ) : (
          products.map((p) => (
            <div key={p.id} className="p-4 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-base">{p.name}</h3>
                <p className="text-xs text-gray-500">Slug: {p.slug} | Brand ID: {p.brandId} | Base Price: ₦{(p.basePriceCents / 100).toFixed(2)}</p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 border rounded bg-gray-100">{p.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
