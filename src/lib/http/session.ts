import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { validateSession } from "@/domains/identity";
import { loadActor, type Actor } from "@/domains/authorization";

const secure = () => getEnv().APP_URL.startsWith("https://");
export const sessionCookieName = () => (secure() ? "__Host-vr_session" : "vr_session");

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(sessionCookieName(), token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", expires });
}
export async function clearSessionCookie() { (await cookies()).delete(sessionCookieName()); }
export async function readSessionToken() { return (await cookies()).get(sessionCookieName())?.value; }

/** Per-request memoised current user (null when signed out). Never returns the password hash to callers. */
export const getCurrentUser = cache(async () => {
  const token = await readSessionToken();
  const s = await validateSession(getDb(), token, getEnv().TOKEN_PEPPER);
  if (!s) return null;
  const { passwordHash: _omit, ...safe } = s.user;
  return safe;
});

export async function requireCustomer(next = "/account") {
  const u = await getCurrentUser();
  if (!u || u.kind !== "customer") redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Admin boundary: admin-kind users only, with their RBAC grants loaded fresh from the DB each request. */
export async function requireAdmin(): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; actor: Actor }> {
  const u = await getCurrentUser();
  if (!u || u.kind !== "admin") redirect("/admin/login");
  const actor = await loadActor(getDb(), u.id);
  if (actor.grants.length === 0) redirect("/admin/login");
  return { user: u, actor };
}
