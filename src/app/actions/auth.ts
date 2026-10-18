"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { login, rateLimit, registerCustomer, requestPasswordReset, resetPassword, revokeSession, verifyEmail } from "@/domains/identity";
import { getEmailProvider } from "@/infrastructure/email";
import { templates } from "@/infrastructure/email/templates";
import { mergeGuestCart } from "@/domains/cart";
import { clientIp, safeNext } from "@/lib/http/origin";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/lib/http/session";
import { clearGuestCartCookie, guestCartHash } from "@/lib/http/cart-cookie";
import { fd, run, type ActionState } from "@/lib/http/action";
import { eq } from "drizzle-orm";
import { users } from "@/infrastructure/db/schema";

const pepper = () => getEnv().TOKEN_PEPPER;
import { headers } from "next/headers";
const ua = async () => (await headers()).get("user-agent") ?? undefined;

async function limit(bucket: string, max: number, windowMs: number) {
  const ip = await sha256Hex(await clientIp(), pepper());
  if (!(await rateLimit(getDb(), `${bucket}:${ip}`, max, windowMs))) throw new AppError("RATE_LIMITED", "Too many attempts. Try again later.");
}

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await limit("register", 10, 60 * 60_000);
    const raw = fd(form);
    const db = getDb(); const e = getEnv();
    let userId = ""; let token = "";
    try { ({ userId, verifyToken: token } = await registerCustomer(db, raw, pepper())); }
    catch (err) {
      // Same response whether or not the email already exists (no account enumeration).
      if (err instanceof AppError && err.code === "CONFLICT") return { ok: true, message: "Check your inbox to verify your email, then sign in." };
      throw err;
    }
    await getEmailProvider().send(templates.verifyEmail(String(raw.email).trim().toLowerCase(), `${e.APP_URL}/verify-email?token=${token}`)).catch((err) => console.error("[email] verify failed", err));
    const s = await login(db, { email: raw.email, password: raw.password }, pepper(), { ip: await clientIp(), userAgent: await ua() }, "customer");
    await setSessionCookie(s.token, s.expiresAt);
    redirect(safeNext(raw.next, "/account"));
  });
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const raw = fd(form); const db = getDb();
    const s = await login(db, raw, pepper(), { ip: await clientIp(), userAgent: await ua() }, "customer");
    await setSessionCookie(s.token, s.expiresAt);
    const [u] = await db.select().from(users).where(eq(users.email, String(raw.email).trim().toLowerCase()));
    const g = await guestCartHash();
    if (u && g) { await mergeGuestCart(db, g, u.id); await clearGuestCartCookie(); }
    redirect(safeNext(raw.next, "/account"));
  });
}

export async function adminLoginAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await login(getDb(), fd(form), pepper(), { ip: await clientIp(), userAgent: await ua() }, "admin");
    await setSessionCookie(s.token, s.expiresAt);
    redirect("/admin");
  });
}

export async function logoutAction(): Promise<void> {
  await run(async () => {
    const t = await readSessionToken();
    if (t) await revokeSession(getDb(), t, pepper());
    await clearSessionCookie();
  });
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await limit("forgot", 5, 60 * 60_000);
    const email = z.string().email().parse(fd(form).email);
    const r = await requestPasswordReset(getDb(), email, pepper());
    if (r) await getEmailProvider().send(templates.passwordReset(email.trim().toLowerCase(), `${getEnv().APP_URL}/reset-password?token=${r.token}`)).catch((e) => console.error("[email] reset failed", e));
    return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  });
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const { token, password, confirm } = fd(form);
    if (password !== confirm) return { ok: false, message: "Passwords don't match", fieldErrors: { confirm: ["Passwords don't match"] } };
    await resetPassword(getDb(), String(token), String(password), pepper());
    redirect("/login?reset=1");
  });
}

export async function verifyEmailAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => { await verifyEmail(getDb(), String(fd(form).token), pepper()); return { ok: true, message: "Email verified. Thank you." }; });
}
