import { inArray, sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { scopedBrandIds, type Actor } from "@/domains/authorization";
import type { PermissionCode } from "@/domains/authorization/permissions";

/** WHERE fragment restricting a list query to brands the actor holds `perm` for. undefined = unrestricted (global grant). */
export function brandScopeWhere(actor: Actor, perm: PermissionCode, col: AnySQLiteColumn): SQL | undefined {
  const s = scopedBrandIds(actor, perm);
  if (s === "all") return undefined;
  return s.length === 0 ? sql`1 = 0` : inArray(col, s);
}
