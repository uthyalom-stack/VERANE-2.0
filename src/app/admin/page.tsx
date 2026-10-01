import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { logoutAction } from "@/app/actions/auth";
import { db } from "@/infrastructure/database/client";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { CatalogRepository } from "@/domains/catalog/catalog-repository";
import { CatalogService } from "@/domains/catalog/catalog-service";

export default async function AdminPage() {
  const authUser = await getCurrentUser();

  if (!authUser) {
    redirect("/login");
  }

  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  if (!authService.isAdministrator(authUser)) {
    redirect("/account");
  }

  const catalogRepo = new CatalogRepository(db);
  const catalogService = new CatalogService(catalogRepo, authService);

  const productsList = await catalogService.listProducts(authUser);
  const categoriesList = await catalogService.listCategories(authUser);
  const collectionsList = await catalogRepo.listCollections();

  return (
    <div className="max-w-4xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VÉRANE Admin Catalog Portal</h1>
          <p className="text-sm text-gray-600">
            User: {authUser.user.name} ({authUser.user.email})
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="bg-red-600 text-white text-sm py-1.5 px-3 rounded hover:bg-red-700 transition cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Assigned Administrative Roles & Scopes:</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {authUser.adminRoles?.map((r, i) => (
            <li key={i}>
              <span className="font-medium">{r.roleName}</span>
              {r.brandCode ? ` — Brand Scope: ${r.brandCode}` : " — Global Scope"}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-bold text-lg mb-1">Products ({productsList.length})</h3>
          <p className="text-sm text-gray-600 mb-3">Manage catalog items, variants, prices & media.</p>
          <span className="text-xs font-semibold px-2 py-1 bg-black text-white rounded">
            Products Active
          </span>
        </div>
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-bold text-lg mb-1">Categories ({categoriesList.length})</h3>
          <p className="text-sm text-gray-600 mb-3">Hierarchical navigation and taxonomy.</p>
          <span className="text-xs font-semibold px-2 py-1 bg-black text-white rounded">
            Categories Active
          </span>
        </div>
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-bold text-lg mb-1">Collections ({collectionsList.length})</h3>
          <p className="text-sm text-gray-600 mb-3">Editorial rails, campaigns and ordered drops.</p>
          <span className="text-xs font-semibold px-2 py-1 bg-black text-white rounded">
            Collections Active
          </span>
        </div>
      </div>
    </div>
  );
}
