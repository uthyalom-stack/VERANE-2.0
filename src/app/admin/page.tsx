import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { logoutAction } from "@/app/actions/auth";
import { db } from "@/infrastructure/database/client";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";

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

  return (
    <div className="max-w-3xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">VÉRANE Admin Portal</h1>
      <p className="mb-2"><strong>User:</strong> {authUser.user.name} ({authUser.user.email})</p>
      <p className="mb-4"><strong>Admin Profile ID:</strong> {authUser.adminProfile?.id}</p>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Assigned Roles & Scopes:</h2>
        <ul className="list-disc pl-5 space-y-1">
          {authUser.adminRoles?.map((r, i) => (
            <li key={i}>
              <span className="font-medium">{r.roleName}</span>
              {r.brandCode ? ` — Scope: ${r.brandCode}` : " — Global Scope"}
            </li>
          ))}
        </ul>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition cursor-pointer"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
