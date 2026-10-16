import { eq } from "drizzle-orm";
import type { Db } from "@/infrastructure/db/client";
import { permissions, rolePermissions, roles, userRoles } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { GLOBAL_ONLY, type PermissionCode } from "./permissions";

export type Grant = { roleCode: string; brandId: string | null; permissions: ReadonlySet<string> };
export type Actor = { userId: string; grants: readonly Grant[] };

export async function loadActor(db: Db, userId: string): Promise<Actor> {
  const rows = await db
    .select({ roleCode: roles.code, brandId: userRoles.brandId, perm: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  const map = new Map<string, { roleCode: string; brandId: string | null; permissions: Set<string> }>();
  for (const r of rows) {
    if (!r.roleCode || !r.perm) continue; // legacy rows are backfilled by reconcileRbac
    const key = `${r.roleCode}|${r.brandId ?? ""}`;
    const g = map.get(key) ?? { roleCode: r.roleCode, brandId: r.brandId, permissions: new Set<string>() };
    g.permissions.add(r.perm);
    map.set(key, g);
  }
  return { userId, grants: [...map.values()] };
}

/**
 * Core rule. `brandId`:
 *  - string      -> resource belongs to that brand: needs a global grant OR a grant bound to exactly that brand.
 *  - null        -> house-wide resource: only a global grant qualifies.
 * Brand identity must come from the DATABASE row, never from client input.
 */
export function can(actor: Actor, permission: PermissionCode, brandId: string | null): boolean {
  const globalOnly = GLOBAL_ONLY.includes(permission);
  return actor.grants.some((g) => {
    if (!g.permissions.has(permission)) return false;
    if (g.brandId === null) return true;
    if (globalOnly) return false;
    return brandId !== null && g.brandId === brandId;
  });
}

export function assertCan(actor: Actor | null | undefined, permission: PermissionCode, brandId: string | null): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Sign in required");
  if (!can(actor, permission, brandId)) throw new AppError("FORBIDDEN", "You do not have access to this resource");
}

/** For list/read queries: 'all' for global grants, otherwise the brand ids the actor may see. */
export function scopedBrandIds(actor: Actor, permission: PermissionCode): "all" | string[] {
  const out = new Set<string>();
  for (const g of actor.grants) {
    if (!g.permissions.has(permission)) continue;
    if (g.brandId === null) return "all";
    out.add(g.brandId);
  }
  return [...out];
}
