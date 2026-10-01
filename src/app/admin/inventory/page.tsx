import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { db } from "@/infrastructure/database/client";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";

export default async function AdminInventoryPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  if (!authService.isAdministrator(authUser)) redirect("/account");

  return (
    <div className="max-w-4xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-xs text-blue-600 hover:underline">← Back to Portal</Link>
          <h1 className="text-2xl font-bold">Catalog Inventory Management</h1>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Inventory management controls atomic stock adjustments, reservations, and auditable inventory transactions.
      </p>
    </div>
  );
}
