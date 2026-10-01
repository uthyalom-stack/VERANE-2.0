import { Database } from "@/infrastructure/database/client";
import {
  roles,
  permissions,
  rolePermissions,
  adminRoles,
  brands,
  Role,
  Permission,
  NewRole,
  NewPermission,
  NewAdminRole,
} from "@/infrastructure/database/schema";
import { eq, inArray } from "drizzle-orm";
import { AdminRoleAssignment } from "./types";

export class RbacRepository {
  constructor(private db: Database) {}

  async findRoleByName(name: string): Promise<Role | undefined> {
    return this.db.select().from(roles).where(eq(roles.name, name)).get();
  }

  async findPermissionByName(name: string): Promise<Permission | undefined> {
    return this.db.select().from(permissions).where(eq(permissions.name, name)).get();
  }

  async createRole(data: NewRole): Promise<Role> {
    await this.db.insert(roles).values(data);
    const created = await this.db.select().from(roles).where(eq(roles.id, data.id)).get();
    if (!created) throw new Error("Failed to create role");
    return created;
  }

  async createPermission(data: NewPermission): Promise<Permission> {
    await this.db.insert(permissions).values(data);
    const created = await this.db.select().from(permissions).where(eq(permissions.id, data.id)).get();
    if (!created) throw new Error("Failed to create permission");
    return created;
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
  }

  async assignRoleToAdmin(data: NewAdminRole): Promise<void> {
    await this.db.insert(adminRoles).values(data);
  }

  async getAdminRoleAssignments(adminProfileId: string): Promise<AdminRoleAssignment[]> {
    const rows = await this.db
      .select({
        roleId: roles.id,
        roleName: roles.name,
        brandId: adminRoles.brandId,
        brandCode: brands.code,
      })
      .from(adminRoles)
      .innerJoin(roles, eq(adminRoles.roleId, roles.id))
      .leftJoin(brands, eq(adminRoles.brandId, brands.id))
      .where(eq(adminRoles.adminProfileId, adminProfileId));

    return rows.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      brandId: r.brandId ?? null,
      brandCode: r.brandCode ?? null,
    }));
  }

  async getPermissionsForRoles(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const rows = await this.db
      .select({
        roleId: rolePermissions.roleId,
        permissionName: permissions.name,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    const permissionsSet = new Set<string>();

    for (const row of rows) {
      permissionsSet.add(row.permissionName);
    }

    return Array.from(permissionsSet);
  }
}
