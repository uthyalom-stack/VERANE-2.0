import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { customerProfiles, oneTimeTokens, rateLimitHits, sessions, users } from "@/infrastructure/db/schema";
import { AppError } from "@/lib/errors";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "@/lib/crypto";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

export const registerSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
export const loginSchema = z.object({ email: z.string().email().transform((s) => s.trim().toLowerCase()), password: z.string().min(1).max(200) });

export async function registerCustomer(db: Db, raw: unknown, pepper: string) {
  const input = registerSchema.parse(raw);
  const passwordHash = await hashPassword(input.password);
  try {
    const userId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: userId, email: input.email, name: `${input.firstName} ${input.lastName}`, isActive: true, passwordHash, kind: "customer", createdAt: new Date(), updatedAt: new Date() });
      await tx.insert(customerProfiles).values({ id: crypto.randomUUID(), userId, firstName: input.firstName, lastName: input.lastName, createdAt: new Date(), updatedAt: new Date() });
    });
    const verifyToken = await issueOneTimeToken(db, userId, "verify_email", 24 * 3600_000, pepper);
    return { userId, verifyToken };
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      // Do not reveal whether an email is registered: caller shows the same message either way.
      throw new AppError("CONFLICT", "If this email can be used, you'll receive a verification message.");
    }
    throw e;
  }
}

/** Sliding-window limiter backed by the DB (works on stateless Workers). Returns false when limited. */
export async function rateLimit(db: Db, bucket: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const since = now - windowMs;
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)` }).from(rateLimitHits)
    .where(and(eq(rateLimitHits.bucket, bucket), gt(rateLimitHits.at, new Date(since))));
  if (n >= max) return false;
  await db.insert(rateLimitHits).values({ bucket, at: new Date(now) });
  return true;
}

export async function login(db: Db, raw: unknown, pepper: string, meta: { ip?: string; userAgent?: string } = {}, kind?: "customer" | "admin") {
  const { email, password } = loginSchema.parse(raw);
  const ipKey = await sha256Hex(meta.ip ?? "unknown", pepper);
  const emailKey = await sha256Hex(email, pepper);
  if (!(await rateLimit(db, `login:ip:${ipKey}`, 20, 15 * 60_000)) || !(await rateLimit(db, `login:email:${emailKey}`, 10, 15 * 60_000))) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Try again later.");
  }
  const generic = new AppError("UNAUTHENTICATED", "Email or password is incorrect");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.status !== "active" || (kind && user.kind !== kind)) { await verifyPassword(password, "pbkdf2-sha256$100000$00$00"); throw generic; } // equalise timing
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppError("RATE_LIMITED", "Account temporarily locked. Try again later.");
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    await db.update(users).set({ failedLoginCount: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : null }).where(eq(users.id, user.id));
    throw generic;
  }
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  return createSession(db, user.id, pepper, meta);
}

export async function createSession(db: Db, userId: string, pepper: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomToken(32);
  const now = Date.now();
  await db.insert(sessions).values({
    id: crypto.randomUUID(), userId, tokenHash: await sha256Hex(token, pepper), expiresAt: new Date(now + SESSION_TTL_MS), lastUsedAt: new Date(now), lastSeenAt: new Date(now), createdAt: new Date(now),
    ipHash: meta.ip ? await sha256Hex(meta.ip, pepper) : null, userAgent: meta.userAgent?.slice(0, 200) ?? null,
  });
  return { token, expiresAt: new Date(now + SESSION_TTL_MS) };
}

export async function validateSession(db: Db, token: string | undefined, pepper: string, now = new Date()) {
  if (!token) return null;
  const tokenHash = await sha256Hex(token, pepper);
  const [row] = await db.select({ s: sessions, u: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.tokenHash, tokenHash));
  if (!row || row.s.revokedAt || row.s.expiresAt <= now || now.getTime() - row.s.lastSeenAt.getTime() > SESSION_IDLE_MS || row.u.status !== "active") return null;
  if (now.getTime() - row.s.lastSeenAt.getTime() > 5 * 60_000) await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.s.id));
  return { user: row.u, sessionId: row.s.id };
}

export async function revokeSession(db: Db, token: string, pepper: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, await sha256Hex(token, pepper)));
}
export async function revokeAllSessions(db: Db, userId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function issueOneTimeToken(db: Db, userId: string, purpose: "verify_email" | "reset_password", ttlMs: number, pepper: string) {
  const token = randomToken(32);
  await db.insert(oneTimeTokens).values({ userId, purpose, tokenHash: await sha256Hex(token, pepper), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consume(db: Db, token: string, purpose: "verify_email" | "reset_password", pepper: string) {
  const tokenHash = await sha256Hex(token, pepper);
  // single-statement claim: only one caller can flip consumedAt from NULL
  const claimed = await db.update(oneTimeTokens).set({ consumedAt: new Date() })
    .where(and(eq(oneTimeTokens.tokenHash, tokenHash), eq(oneTimeTokens.purpose, purpose), isNull(oneTimeTokens.consumedAt), gt(oneTimeTokens.expiresAt, new Date())))
    .returning();
  if (claimed.length === 0) throw new AppError("VALIDATION", "This link is invalid or has expired");
  return claimed[0]!;
}

export async function verifyEmail(db: Db, token: string, pepper: string) {
  const t = await consume(db, token, "verify_email", pepper);
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, t.userId));
}

export async function requestPasswordReset(db: Db, email: string, pepper: string): Promise<{ token: string; userId: string } | null> {
  const [u] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (!u || u.status !== "active") return null; // caller responds identically either way
  return { token: await issueOneTimeToken(db, u.id, "reset_password", 3600_000, pepper), userId: u.id };
}

export async function resetPassword(db: Db, token: string, newPassword: string, pepper: string) {
  if (newPassword.length < 10 || newPassword.length > 200) throw new AppError("VALIDATION", "Use at least 10 characters");
  const t = await consume(db, token, "reset_password", pepper);
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, t.userId));
  await revokeAllSessions(db, t.userId); // invalidate every existing session after a reset
}
