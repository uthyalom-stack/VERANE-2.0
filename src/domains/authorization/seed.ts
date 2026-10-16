import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { permissions, rolePermissions, roles } from "@/infrastructure/db/schema";
import { PERMISSIONS, ROLE_DEFINITIONS } from "./permissions";

/** Reconciliatory: safe to run on every deploy. Adds missing rows, removes role-permission links no longer defined. Never deletes roles/users. */
export async function reconcileRbac(db: Db): Promise<void> {
  // Backfill identifiers for rows created by the original RBAC schema before code-based upserts.
  const legacyRoles = await db.select().from(roles).where(isNull(roles.code));
  for (const role of legacyRoles) {
    const code = role.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (code) await db.update(roles).set({ code }).where(eq(roles.id, role.id));
  }
  const legacyPermissions = await db.select().from(permissions).where(isNull(permissions.code));
  for (const permission of legacyPermissions) {
    await db.update(permissions).set({ code: permission.name }).where(eq(permissions.id, permission.id));
  }

  for (const [code, description] of Object.entries(PERMISSIONS)) {
    const now = new Date();
    await db.insert(permissions).values({ name: code, code, description, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: permissions.code, set: { name: code, description, updatedAt: now } });
  }
  for (const [code, def] of Object.entries(ROLE_DEFINITIONS)) {
    const now = new Date();
    await db.insert(roles).values({ code, name: def.name, description: def.description, isSystem: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: roles.code, set: { name: def.name, description: def.description, updatedAt: now } });
    const [role] = await db.select().from(roles).where(eq(roles.code, code));
    if (!role) continue;
    const wanted = await db.select().from(permissions).where(inArray(permissions.code, def.permissions));
    const wantedIds = new Set(wanted.map((p) => p.id));
    const current = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    for (const p of wanted) {
      if (!current.some((c) => c.permissionId === p.id)) await db.insert(rolePermissions).values({ roleId: role.id, permissionId: p.id });
    }
    for (const c of current) {
      if (!wantedIds.has(c.permissionId)) {
        await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, role.id), eq(rolePermissions.permissionId, c.permissionId)));
      }
    }
  }
}
