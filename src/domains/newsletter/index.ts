import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/infrastructure/db/client";
import { newsletterSubscriptions } from "@/infrastructure/db/schema";
import { hmacHex, safeEqual, sha256Hex } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export const unsubToken = (email: string, pepper: string) => hmacHex("SHA-256", pepper, `unsub:${email.trim().toLowerCase()}`);

/** Marketing consent only. Never gates or replaces transactional email. Idempotent; re-subscribing clears a prior unsubscribe. */
export async function subscribe(db: Db, raw: { email: string; consent: boolean; brandId?: string | null }, pepper: string) {
  const email = z.string().email().max(254).parse(raw.email).trim().toLowerCase();
  if (!raw.consent) throw new AppError("VALIDATION", "Please tick the box to confirm you'd like to receive our emails");
  const brandId = raw.brandId ?? null;
  const [ex] = await db.select().from(newsletterSubscriptions).where(and(eq(newsletterSubscriptions.email, email), brandId ? eq(newsletterSubscriptions.brandId, brandId) : isNull(newsletterSubscriptions.brandId)));
  const hash = await sha256Hex(await unsubToken(email, pepper));
  if (ex) await db.update(newsletterSubscriptions).set({ unsubscribedAt: null, consentedAt: new Date() }).where(eq(newsletterSubscriptions.id, ex.id));
  else await db.insert(newsletterSubscriptions).values({ email, brandId, consentedAt: new Date(), unsubscribeTokenHash: hash });
}
export async function unsubscribe(db: Db, email: string, token: string, pepper: string) {
  const e = email.trim().toLowerCase();
  if (!safeEqual(await unsubToken(e, pepper), token)) throw new AppError("VALIDATION", "This unsubscribe link is invalid");
  await db.update(newsletterSubscriptions).set({ unsubscribedAt: new Date() }).where(and(eq(newsletterSubscriptions.email, e), or(isNull(newsletterSubscriptions.unsubscribedAt), eq(newsletterSubscriptions.email, e))));
}
