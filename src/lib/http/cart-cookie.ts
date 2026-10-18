import { cookies } from "next/headers";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { getOrCreateCart, type CartOwner } from "@/domains/cart";
import { carts } from "@/infrastructure/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "./session";

const NAME = "vr_cart";
const secure = () => getEnv().APP_URL.startsWith("https://");

/** Read-only (safe in Server Components): returns the existing active cart id for this visitor, if any. */
export async function peekCartId(): Promise<string | null> {
  const db = getDb();
  const user = await getCurrentUser();
  if (user) { const [c] = await db.select().from(carts).where(and(eq(carts.userId, user.id), eq(carts.status, "active"))); return c?.id ?? null; }
  const token = (await cookies()).get(NAME)?.value;
  if (!token) return null;
  const [c] = await db.select().from(carts).where(and(eq(carts.guestTokenHash, await sha256Hex(token, getEnv().TOKEN_PEPPER)), eq(carts.status, "active")));
  return c?.id ?? null;
}

/** Mutating contexts only (server actions / route handlers): creates the cart and guest cookie on demand. */
export async function ensureCartId(): Promise<string> {
  const db = getDb();
  const user = await getCurrentUser();
  let owner: CartOwner;
  if (user) owner = { userId: user.id };
  else {
    const jar = await cookies();
    let token = jar.get(NAME)?.value;
    if (!token) { token = randomToken(24); jar.set(NAME, token, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 }); }
    owner = { guestTokenHash: await sha256Hex(token, getEnv().TOKEN_PEPPER) };
  }
  return (await getOrCreateCart(db, owner)).id;
}
export async function guestCartHash(): Promise<string | null> {
  const t = (await cookies()).get(NAME)?.value; return t ? sha256Hex(t, getEnv().TOKEN_PEPPER) : null;
}
export async function clearGuestCartCookie() { (await cookies()).delete(NAME); }
