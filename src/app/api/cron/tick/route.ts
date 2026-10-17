import { NextResponse } from "next/server";
import { and, lt } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { expireStaleOrders } from "@/domains/orders";
import { processEmailOutbox } from "@/domains/orders/outbox";
import { getSiteConfig } from "@/domains/site-content";
import { pollShipments } from "@/domains/orders/fulfilment";
import { getEmailProvider } from "@/infrastructure/email";
import { getShippingProvider } from "@/infrastructure/shipping";
import { oneTimeTokens, rateLimitHits, sessions } from "@/infrastructure/db/schema";

export const dynamic = "force-dynamic";

/** Invoked by the Worker's scheduled() handler (worker/index.ts) every 15 minutes with `Authorization: Bearer CRON_SECRET`. All jobs are idempotent. */
export async function POST(req: Request) {
  const env = getEnv();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!env.CRON_SECRET || !safeEqual(given, env.CRON_SECRET)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getDb(); const now = new Date(); const out: Record<string, unknown> = {};
  const siteConfig = await getSiteConfig(db);
  const step = async (name: string, fn: () => Promise<unknown>) => { try { out[name] = await fn(); } catch (e) { out[name] = `error: ${String(e).slice(0, 120)}`; } };
  await step("expiredOrders", () => expireStaleOrders(db, now));
  await step("emails", () => processEmailOutbox(db, getEmailProvider(), { appUrl: env.APP_URL, adminEmail: env.ADMIN_NOTIFY_EMAIL, siteName: siteConfig.settings.siteName }, now));
  await step("shipments", () => pollShipments(db, getShippingProvider()));
  await step("purge", async () => {
    const week = new Date(now.getTime() - 7 * 86400_000);
    await db.delete(sessions).where(lt(sessions.expiresAt, week));
    await db.delete(oneTimeTokens).where(and(lt(oneTimeTokens.expiresAt, week)));
    await db.delete(rateLimitHits).where(lt(rateLimitHits.at, new Date(now.getTime() - 86400_000)));
    return "ok";
  });
  return NextResponse.json({ ok: true, ...out });
}
