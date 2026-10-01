import { AuthenticatedUser } from "./types";
import { RbacRepository } from "../rbac/rbac-repository";
import { BrandRepository } from "../brands/brand-repository";
import { ROLES, PermissionName } from "../rbac/types";

export class AuthorizationService {
  constructor(
    private rbacRepo: RbacRepository,
    private brandRepo: BrandRepository
  ) {}

  isAdministrator(userAuth: AuthenticatedUser): boolean {
    if (!userAuth.user.isActive) return false;
    if (!userAuth.adminProfile) return false;
    return (userAuth.adminRoles && userAuth.adminRoles.length > 0) ?? false;
  }

  isSuperAdmin(userAuth: AuthenticatedUser): boolean {
    if (!this.isAdministrator(userAuth)) return false;
    return userAuth.adminRoles?.some((r) => r.roleName === ROLES.SUPER_ADMIN) ?? false;
  }

  async hasPermission(userAuth: AuthenticatedUser, permission: PermissionName): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    const roleIds = userAuth.adminRoles?.map((r) => r.roleId) ?? [];
    if (roleIds.length === 0) return false;

    const permissions = await this.rbacRepo.getPermissionsForRoles(roleIds);
    return permissions.includes(permission);
  }

  async hasBrandAccess(userAuth: AuthenticatedUser, brandIdOrCode: string): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    // Resolve target brand code if brandIdOrCode is an ID
    let targetBrandCode = brandIdOrCode;
    let targetBrandId = brandIdOrCode;

    if (!brandIdOrCode.startsWith("brand_") && (brandIdOrCode === "UTHY_LUXURY" || brandIdOrCode === "ALOMZIEE_FOOTIES")) {
      targetBrandCode = brandIdOrCode;
    } else {
      const brand = await this.brandRepo.findById(brandIdOrCode);
      if (brand) {
        targetBrandCode = brand.code;
        targetBrandId = brand.id;
      }
    }

    return (
      userAuth.adminRoles?.some((r) => {
        if (r.roleName === ROLES.SUPER_ADMIN) return true;
        if (r.brandId && r.brandId === targetBrandId) return true;
        if (r.brandCode && r.brandCode === targetBrandCode) return true;
        return false;
      }) ?? false
    );
  }

  async hasBrandPermission(
    userAuth: AuthenticatedUser,
    permission: PermissionName,
    brandIdOrCode: string
  ): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    const hasBrand = await this.hasBrandAccess(userAuth, brandIdOrCode);
    if (!hasBrand) return false;

    return this.hasPermission(userAuth, permission);
  }
}
