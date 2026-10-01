import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { IdentityRepository } from "../src/domains/identity/identity-repository";
import { RbacRepository } from "../src/domains/rbac/rbac-repository";
import { BrandRepository } from "../src/domains/brands/brand-repository";
import { AuthorizationService } from "../src/domains/identity/authorization-service";
import { seedDatabase } from "../src/infrastructure/database/seed";
import { BRAND_CODES } from "../src/domains/brands/types";
import { ROLES, PERMISSIONS } from "../src/domains/rbac/types";
import { hashPassword } from "../src/lib/auth/password";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Brand Authorization & RBAC Scoping", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const identityRepo = new IdentityRepository(db);
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);

  beforeEach(async () => {
    const client = (db as unknown as SqliteSessionClient).session.client;
    await client.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS customer_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS admin_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, revoked_at INTEGER);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL, permission_id TEXT NOT NULL, PRIMARY KEY (role_id, permission_id));`);
    await client.execute(`CREATE TABLE IF NOT EXISTS admin_roles (id TEXT PRIMARY KEY, admin_profile_id TEXT NOT NULL, role_id TEXT NOT NULL, brand_id TEXT, created_at INTEGER NOT NULL);`);

    await seedDatabase(db);
  });

  it("should deny normal customer from performing admin or brand actions", async () => {
    const passwordHash = await hashPassword("Pass123!");
    const user = await identityRepo.createUser({
      id: "cust_1",
      email: "cust@verane.com",
      name: "Customer One",
      passwordHash,
      isActive: true,
    });
    await identityRepo.createCustomerProfile(user.id);
    const session = await identityRepo.createSession(user.id);

    const authUser = {
      user,
      customerProfile: await identityRepo.getCustomerProfileByUserId(user.id),
      session,
    };

    expect(authService.isAdministrator(authUser)).toBe(false);
    expect(await authService.hasPermission(authUser, PERMISSIONS.PRODUCTS_READ)).toBe(false);
    expect(await authService.hasBrandAccess(authUser, BRAND_CODES.UTHY_LUXURY)).toBe(false);
  });

  it("should allow SUPER_ADMIN global access across all brands", async () => {
    const passwordHash = await hashPassword("Pass123!");
    const user = await identityRepo.createUser({
      id: "super_1",
      email: "super@verane.com",
      name: "Super Admin",
      passwordHash,
      isActive: true,
    });
    const adminProfileId = await identityRepo.createAdminProfile(user.id);
    const superRole = await rbacRepo.findRoleByName(ROLES.SUPER_ADMIN);

    await rbacRepo.assignRoleToAdmin({
      id: "ar_super",
      adminProfileId,
      roleId: superRole!.id,
      brandId: null, // Global scope
    });

    const session = await identityRepo.createSession(user.id);
    const authUser = {
      user,
      adminProfile: await identityRepo.getAdminProfileByUserId(user.id),
      adminRoles: await rbacRepo.getAdminRoleAssignments(adminProfileId),
      session,
    };

    expect(authService.isAdministrator(authUser)).toBe(true);
    expect(authService.isSuperAdmin(authUser)).toBe(true);
    expect(await authService.hasBrandAccess(authUser, BRAND_CODES.UTHY_LUXURY)).toBe(true);
    expect(await authService.hasBrandAccess(authUser, BRAND_CODES.ALOMZIEE_FOOTIES)).toBe(true);
    expect(await authService.hasBrandPermission(authUser, PERMISSIONS.PRODUCTS_UPDATE, BRAND_CODES.UTHY_LUXURY)).toBe(true);
  });

  it("should enforce brand isolation between UTHY_ADMIN and ALOMZIEE_ADMIN", async () => {
    const passwordHash = await hashPassword("Pass123!");

    // UTHY Admin setup
    const uthyUser = await identityRepo.createUser({
      id: "uthy_admin_1",
      email: "uthy@verane.com",
      name: "Uthy Admin",
      passwordHash,
      isActive: true,
    });
    const uthyAdminProfileId = await identityRepo.createAdminProfile(uthyUser.id);
    const uthyRole = await rbacRepo.findRoleByName(ROLES.UTHY_ADMIN);
    const uthyBrand = await brandRepo.findByCode(BRAND_CODES.UTHY_LUXURY);

    await rbacRepo.assignRoleToAdmin({
      id: "ar_uthy",
      adminProfileId: uthyAdminProfileId,
      roleId: uthyRole!.id,
      brandId: uthyBrand!.id,
    });

    const uthySession = await identityRepo.createSession(uthyUser.id);
    const uthyAuthUser = {
      user: uthyUser,
      adminProfile: await identityRepo.getAdminProfileByUserId(uthyUser.id),
      adminRoles: await rbacRepo.getAdminRoleAssignments(uthyAdminProfileId),
      session: uthySession,
    };

    // Verify UTHY Admin permissions
    expect(await authService.hasBrandAccess(uthyAuthUser, BRAND_CODES.UTHY_LUXURY)).toBe(true);
    expect(await authService.hasBrandPermission(uthyAuthUser, PERMISSIONS.PRODUCTS_READ, BRAND_CODES.UTHY_LUXURY)).toBe(true);

    // CROSS-BRAND DENIAL
    expect(await authService.hasBrandAccess(uthyAuthUser, BRAND_CODES.ALOMZIEE_FOOTIES)).toBe(false);
    expect(await authService.hasBrandPermission(uthyAuthUser, PERMISSIONS.PRODUCTS_READ, BRAND_CODES.ALOMZIEE_FOOTIES)).toBe(false);
  });
});
