import "server-only";
import { cookies } from "next/headers";
import { db } from "@/infrastructure/database/client";
import { IdentityRepository } from "@/domains/identity/identity-repository";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { AuthenticatedUser } from "@/domains/identity/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { PermissionName } from "@/domains/rbac/types";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) return null;

  const identityRepo = new IdentityRepository(db);
  const rbacRepo = new RbacRepository(db);

  const session = await identityRepo.findActiveSessionById(sessionToken);
  if (!session) return null;

  const user = await identityRepo.findUserById(session.userId);
  if (!user || !user.isActive) return null;

  const customerProfile = await identityRepo.getCustomerProfileByUserId(user.id);
  const adminProfile = await identityRepo.getAdminProfileByUserId(user.id);

  let adminRoles = undefined;
  if (adminProfile) {
    adminRoles = await rbacRepo.getAdminRoleAssignments(adminProfile.id);
  }

  return {
    user,
    customerProfile,
    adminProfile,
    adminRoles,
    session,
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const authUser = await getCurrentUser();
  if (!authUser) {
    throw new UnauthorizedError("Authentication required");
  }
  return authUser;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const authUser = await requireUser();
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  if (!authService.isAdministrator(authUser)) {
    throw new ForbiddenError("Administrative privileges required");
  }

  return authUser;
}

export async function requirePermission(permission: PermissionName): Promise<AuthenticatedUser> {
  const authUser = await requireAdmin();
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  const allowed = await authService.hasPermission(authUser, permission);
  if (!allowed) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }

  return authUser;
}

export async function requireBrandAccess(brandIdOrCode: string): Promise<AuthenticatedUser> {
  const authUser = await requireAdmin();
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  const allowed = await authService.hasBrandAccess(authUser, brandIdOrCode);
  if (!allowed) {
    throw new ForbiddenError(`Brand access denied for: ${brandIdOrCode}`);
  }

  return authUser;
}

export async function requireBrandPermission(params: {
  permission: PermissionName;
  brandId: string;
}): Promise<AuthenticatedUser> {
  const authUser = await requireAdmin();
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  const allowed = await authService.hasBrandPermission(authUser, params.permission, params.brandId);
  if (!allowed) {
    throw new ForbiddenError(`Brand permission denied (${params.permission}) for brand: ${params.brandId}`);
  }

  return authUser;
}
