import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { permissions, rolePermissions, roles } from "@/infrastructure/db/schema";
import { PERMISSIONS, ROLE_DEFINITIONS } from "./permissions";

/** Reconciliatory: safe to run on every deploy. Adds missing rows, removes role-permission links no longer defined. Never deletes roles/users. */
export async function reconcileRbac(db: Db): Promise<void> {
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await db.insert(permissions).values({ code, description }).onConflictDoUpdate({ target: permissions.code, set: { description } });
  }
  for (const [code, def] of Object.entries(ROLE_DEFINITIONS)) {
    await db.insert(roles).values({ code, name: def.name, description: def.description, isSystem: true })
      .onConflictDoUpdate({ target: roles.code, set: { name: def.name, description: def.description } });
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
