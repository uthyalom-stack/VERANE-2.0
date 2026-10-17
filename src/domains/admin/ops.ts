import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { adminProfiles, analyticsEvents, auditLogs, brands, customerProfiles, newsletterSubscriptions, orderItems, orders, roles, userRoles, users } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { hashPassword, randomToken } from "@/lib/crypto";
import { assertCan, scopedBrandIds, type Actor } from "@/domains/authorization";
import { ROLE_BRAND_CODE, ROLE_DEFINITIONS } from "@/domains/authorization/permissions";
import { revokeAllSessions } from "@/domains/identity";
import { writeAudit } from "@/domains/audit";
import type { Env } from "@/lib/env";

/* ---------- Users, roles, brand-scoped assignments (users.manage is global-only) ---------- */
export async function listAdminUsers(db: Db, actor: Actor) {
  assertCan(actor, "users.manage", null);
  const us = await db.select({ u: users, p: adminProfiles }).from(users).leftJoin(adminProfiles, eq(adminProfiles.userId, users.id)).where(eq(users.kind, "admin"));
  const grants = await db.select({ g: userRoles, r: roles }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId));
  const bs = new Map((await db.select().from(brands)).map((b) => [b.id, b.name]));
  return us.map(({ u, p }) => ({ id: u.id, email: u.email, name: p?.displayName ?? u.email, status: u.status, grants: grants.filter((x) => x.g.userId === u.id).map((x) => ({ id: x.g.id, role: x.r.code, brand: x.g.brandId ? bs.get(x.g.brandId) ?? x.g.brandId : "All brands" })) }));
}
export async function createAdminUser(db: Db, actor: Actor, raw: { email: string; name: string }) {
  assertCan(actor, "users.manage", null);
  const email = z.string().email().parse(raw.email).toLowerCase(); const name = z.string().trim().min(2).max(80).parse(raw.name);
  const tempPassword = randomToken(9); // shown once to the creating super admin; user must reset
  const id = crypto.randomUUID();
  try { await db.transaction(async (tx) => { await tx.insert(users).values({ id, email, name, isActive: true, passwordHash: await hashPassword(tempPassword), kind: "admin", emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }); await tx.insert(adminProfiles).values({ id: crypto.randomUUID(), userId: id, displayName: name, createdAt: new Date(), updatedAt: new Date() }); }); }
  catch (e) { if (String(e).includes("UNIQUE")) throw new AppError("CONFLICT", "That email is already registered"); throw e; }
  await writeAudit(db, { actorUserId: actor.userId, action: "user.create", entityType: "user", entityId: id, after: { email } });
  return { id, tempPassword };
}
/** A brand-scoped role can only be bound to ITS brand; SUPER_ADMIN is never brand-bound. Enforced here, not in the UI. */
export async function grantRole(db: Db, actor: Actor, userId: string, roleCode: string, brandId: string | null) {
  assertCan(actor, "users.manage", null);
  const def = ROLE_DEFINITIONS[roleCode]; if (!def) throw new AppError("VALIDATION", "Unknown role");
  const [role] = await db.select().from(roles).where(eq(roles.code, roleCode)); if (!role) throw new AppError("VALIDATION", "Unknown role");
  if (def.brandScoped) {
    if (!brandId) throw new AppError("VALIDATION", "Choose a brand for this role");
    const [b] = await db.select().from(brands).where(eq(brands.id, brandId));
    if (!b || b.code !== ROLE_BRAND_CODE[roleCode]) throw new AppError("VALIDATION", `${roleCode} can only be granted for its own brand`);
  } else if (brandId) throw new AppError("VALIDATION", "This role is global");
  await db.insert(userRoles).values({ userId, roleId: role.id, brandId, grantedBy: actor.userId }).onConflictDoNothing();
  await writeAudit(db, { actorUserId: actor.userId, action: "role.grant", entityType: "user", entityId: userId, brandId, after: { roleCode } });
}
export async function revokeGrant(db: Db, actor: Actor, grantId: string) {
  assertCan(actor, "users.manage", null);
  const [g] = await db.select().from(userRoles).where(eq(userRoles.id, grantId)); if (!g) return;
  if (g.userId === actor.userId) throw new AppError("CONFLICT", "You cannot revoke your own access");
  await db.delete(userRoles).where(eq(userRoles.id, grantId));
  await revokeAllSessions(db, g.userId); // permissions changed: force re-login
  await writeAudit(db, { actorUserId: actor.userId, action: "role.revoke", entityType: "user", entityId: g.userId, brandId: g.brandId });
}

/* ---------- Customers: only people who ordered this actor's brands ---------- */
export async function listCustomers(db: Db, actor: Actor, limit = 100) {
  const scope = scopedBrandIds(actor, "customers.read");
  if (scope !== "all" && scope.length === 0) return [];
  const ids = scope === "all" ? undefined : (await db.selectDistinct({ id: orderItems.orderId }).from(orderItems).where(inArray(orderItems.brandId, scope))).map((r) => r.id);
  if (ids && ids.length === 0) return [];
  const rows = await db.select({ email: orders.email, userId: orders.userId, n: sql<number>`count(*)`, spent: sql<number>`sum(${orders.total})`, last: sql<number>`max(${orders.createdAt})` }).from(orders)
    .where(ids ? inArray(orders.id, ids) : sql`1=1`).groupBy(orders.email).orderBy(desc(sql`max(${orders.createdAt})`)).limit(limit);
  const names = rows.some((r) => r.userId) ? await db.select().from(customerProfiles).where(inArray(customerProfiles.userId, rows.map((r) => r.userId).filter(Boolean) as string[])) : [];
  return rows.map((r) => ({ ...r, name: names.find((n) => n.userId === r.userId) ? `${names.find((n) => n.userId === r.userId)!.firstName} ${names.find((n) => n.userId === r.userId)!.lastName}` : null }));
}

/* ---------- Audit, newsletter, analytics, configuration ---------- */
export async function listAudit(db: Db, actor: Actor, limit = 100) { assertCan(actor, "audit.read", null); return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(Math.min(limit, 300)); }
export async function listSubscribers(db: Db, actor: Actor, limit = 200) {
  const scope = scopedBrandIds(actor, "newsletter.read");
  if (scope !== "all" && scope.length === 0) return [];
  const q = db.select().from(newsletterSubscriptions).orderBy(desc(newsletterSubscriptions.createdAt)).limit(limit);
  return scope === "all" ? q : q.where(inArray(newsletterSubscriptions.brandId, scope));
}
export async function analyticsSummary(db: Db, actor: Actor, days = 30, range?: { from: number; to: number }) {
  const scope = scopedBrandIds(actor, "analytics.read");
  if (scope !== "all" && scope.length === 0) return [];
  const from = range?.from ?? Date.now() - days * 86400_000;
  const to = range?.to ?? Date.now();
  const base = db.select({ name: analyticsEvents.name, n: sql<number>`count(*)` }).from(analyticsEvents).where(sql`${analyticsEvents.createdAt} >= ${from} AND ${analyticsEvents.createdAt} < ${to} ${scope === "all" ? sql`` : sql`AND ${analyticsEvents.brandId} IN (${sql.join(scope.map((s) => sql`${s}`), sql`, `)})`}`).groupBy(analyticsEvents.name);
  return base;
}
export function integrationStatus(env: Env, actor: Actor) {
  assertCan(actor, "config.read", null);
  const yes = (b: boolean) => (b ? "configured" : "missing");
  return [
    { name: "Primary database", driver: env.DATABASE_URL.startsWith("file:") ? "local file (dev)" : "remote libSQL", status: "configured" },
    { name: "Analytics store (Turso)", driver: env.ANALYTICS_DATABASE_URL ? "turso" : "primary DB mirror", status: env.ANALYTICS_DATABASE_URL ? "configured" : "optional" },
    { name: "Payments", driver: env.PAYMENT_DRIVER, status: env.PAYMENT_DRIVER === "paystack" ? yes(!!env.PAYSTACK_SECRET_KEY) : "MOCK — not real payments" },
    { name: "Shipping", driver: env.SHIPPING_DRIVER, status: env.SHIPPING_DRIVER === "shipbubble" ? yes(!!env.SHIPBUBBLE_API_KEY && !!env.SHIP_ORIGIN_ADDRESS) : "MOCK — not real rates" },
    { name: "Email", driver: env.EMAIL_DRIVER, status: env.EMAIL_DRIVER === "resend" ? yes(!!env.RESEND_API_KEY) : "CONSOLE — not delivered" },
    { name: "Media", driver: env.MEDIA_DRIVER, status: env.MEDIA_DRIVER === "r2" ? "R2 binding (verify in Cloudflare)" : "local disk (dev)" },
    { name: "AI Marketing workspace", driver: env.MARKETING_AI_URL ? env.MARKETING_AI_URL : "not connected", status: yes(!!env.MARKETING_AI_URL) },
    { name: "Cron secret", driver: "Bearer", status: yes(!!env.CRON_SECRET) },
  ];
}
