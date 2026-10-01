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

  /**
   * Evaluate global permission authority (SUPER_ADMIN or global admin roles).
   */
  async hasPermission(userAuth: AuthenticatedUser, permission: PermissionName): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    // Filter roles that are globally assigned (brandId is null)
    const globalRoleIds = userAuth.adminRoles
      ?.filter((r) => r.brandId === null && r.brandCode === null)
      .map((r) => r.roleId) ?? [];

    if (globalRoleIds.length === 0) return false;

    const permissions = await this.rbacRepo.getPermissionsForRoles(globalRoleIds);
    return permissions.includes(permission);
  }

  /**
   * Evaluate if admin has general access to a target brand.
   */
  async hasBrandAccess(userAuth: AuthenticatedUser, brandIdOrCode: string): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    let targetBrandCode = brandIdOrCode;
    let targetBrandId = brandIdOrCode;

    if (brandIdOrCode !== "UTHY_LUXURY" && brandIdOrCode !== "ALOMZIEE_FOOTIES") {
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

  /**
   * Evaluate a brand-scoped permission request.
   * Isolates role evaluation strictly to role assignments matching target brand or global SUPER_ADMIN.
   */
  async hasBrandPermission(
    userAuth: AuthenticatedUser,
    permission: PermissionName,
    brandIdOrCode: string
  ): Promise<boolean> {
    if (!this.isAdministrator(userAuth)) return false;
    if (this.isSuperAdmin(userAuth)) return true;

    let targetBrandCode = brandIdOrCode;
    let targetBrandId = brandIdOrCode;

    if (brandIdOrCode !== "UTHY_LUXURY" && brandIdOrCode !== "ALOMZIEE_FOOTIES") {
      const brand = await this.brandRepo.findById(brandIdOrCode);
      if (brand) {
        targetBrandCode = brand.code;
        targetBrandId = brand.id;
      }
    }

    // Filter role assignments applicable to the target brand ONLY
    const applicableRoleIds = userAuth.adminRoles
      ?.filter((r) => {
        if (r.roleName === ROLES.SUPER_ADMIN) return true;
        if (r.brandId && r.brandId === targetBrandId) return true;
        if (r.brandCode && r.brandCode === targetBrandCode) return true;
        return false;
      })
      .map((r) => r.roleId) ?? [];

    if (applicableRoleIds.length === 0) return false;

    const permissions = await this.rbacRepo.getPermissionsForRoles(applicableRoleIds);
    return permissions.includes(permission);
  }
}
