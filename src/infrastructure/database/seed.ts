import { Database } from "./client";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BRAND_CODES } from "@/domains/brands/types";
import { ROLES, PERMISSIONS } from "@/domains/rbac/types";
import { logger } from "@/lib/logger";

export async function seedDatabase(db: Database) {
  logger.info("Starting database seed...");

  const brandRepo = new BrandRepository(db);
  const rbacRepo = new RbacRepository(db);

  // 1. Seed Brands
  let uthyBrand = await brandRepo.findByCode(BRAND_CODES.UTHY_LUXURY);
  if (!uthyBrand) {
    uthyBrand = await brandRepo.create({
      id: "brand_uthy_luxury",
      name: "UTHY LUXURY",
      slug: "uthy-luxury",
      code: BRAND_CODES.UTHY_LUXURY,
      isActive: true,
    });
  }

  let alomzieeBrand = await brandRepo.findByCode(BRAND_CODES.ALOMZIEE_FOOTIES);
  if (!alomzieeBrand) {
    alomzieeBrand = await brandRepo.create({
      id: "brand_alomziee_footies",
      name: "ALOMZIEE FOOTIES",
      slug: "alomziee-footies",
      code: BRAND_CODES.ALOMZIEE_FOOTIES,
      isActive: true,
    });
  }

  // 2. Seed Roles
  let superAdminRole = await rbacRepo.findRoleByName(ROLES.SUPER_ADMIN);
  if (!superAdminRole) {
    superAdminRole = await rbacRepo.createRole({
      id: "role_super_admin",
      name: ROLES.SUPER_ADMIN,
      description: "Global Administrative Access Across All Brands",
    });
  }

  let uthyAdminRole = await rbacRepo.findRoleByName(ROLES.UTHY_ADMIN);
  if (!uthyAdminRole) {
    uthyAdminRole = await rbacRepo.createRole({
      id: "role_uthy_admin",
      name: ROLES.UTHY_ADMIN,
      description: "Brand Administrative Access for UTHY LUXURY",
    });
  }

  let alomzieeAdminRole = await rbacRepo.findRoleByName(ROLES.ALOMZIEE_ADMIN);
  if (!alomzieeAdminRole) {
    alomzieeAdminRole = await rbacRepo.createRole({
      id: "role_alomziee_admin",
      name: ROLES.ALOMZIEE_ADMIN,
      description: "Brand Administrative Access for ALOMZIEE FOOTIES",
    });
  }

  // 3. Seed Core Permissions
  const permissionEntries = Object.entries(PERMISSIONS);
  const createdPermissionsMap = new Map<string, string>();

  for (const [, permName] of permissionEntries) {
    let perm = await rbacRepo.findPermissionByName(permName);
    if (!perm) {
      perm = await rbacRepo.createPermission({
        id: `perm_${permName.replace(".", "_")}`,
        name: permName,
        description: `Permission for ${permName}`,
      });
    }
    createdPermissionsMap.set(permName, perm.id);
  }

  // Define permissions appropriate for brand administrators (operational permissions for products, inventory, orders, content, analytics)
  const brandAdminPermissions = [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_ARCHIVE,
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.CUSTOMERS_READ,
  ];

  // 4. Seed Role-Permissions (Idempotent)
  // SUPER_ADMIN gets ALL permissions
  for (const [, permId] of createdPermissionsMap.entries()) {
    await rbacRepo.assignPermissionToRole(superAdminRole.id, permId);
  }

  // UTHY_ADMIN and ALOMZIEE_ADMIN get operational brand permissions
  for (const permName of brandAdminPermissions) {
    const permId = createdPermissionsMap.get(permName);
    if (permId) {
      await rbacRepo.assignPermissionToRole(uthyAdminRole.id, permId);
      await rbacRepo.assignPermissionToRole(alomzieeAdminRole.id, permId);
    }
  }

  logger.info("Database seed completed successfully.");
}
