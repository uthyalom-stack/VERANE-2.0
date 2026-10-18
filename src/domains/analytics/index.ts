import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "@/infrastructure/db/client";
import { analyticsEvents } from "@/infrastructure/db/schema";
import { sha256Hex } from "@/lib/crypto";
import type { Env } from "@/lib/env";

export type TrackInput = { name: "product_view" | "search" | "filter" | "add_to_cart" | "remove_from_cart" | "checkout_start" | "payment_complete" | "purchase" | "campaign_view"; brandId?: string | null; entityType?: string; entityId?: string; campaign?: string | null; props?: Record<string, string | number | boolean | null>; sessionKey?: string | null };
const PII_KEYS = /email|phone|name|address|token|password/i;

/**
 * Fire-and-forget. NEVER throws and never blocks checkout: failures are swallowed (and logged once). Payloads carry no PII:
 * the session is a salted hash and props containing PII-looking keys are dropped. Writes to Turso when configured, else the primary DB.
 */
export async function track(db: Db, env: Pick<Env, "ANALYTICS_DATABASE_URL" | "ANALYTICS_DATABASE_AUTH_TOKEN" | "TOKEN_PEPPER">, e: TrackInput): Promise<void> {
  try {
    const props = e.props ? Object.fromEntries(Object.entries(e.props).filter(([k]) => !PII_KEYS.test(k))) : null;
    const row = { name: e.name, sessionHash: e.sessionKey ? (await sha256Hex(e.sessionKey, env.TOKEN_PEPPER)).slice(0, 24) : null, brandId: e.brandId ?? null, entityType: e.entityType ?? null, entityId: e.entityId ?? null, campaign: e.campaign ?? null, propsJson: props };
    if (env.ANALYTICS_DATABASE_URL) await drizzle(createClient({ url: env.ANALYTICS_DATABASE_URL, authToken: env.ANALYTICS_DATABASE_AUTH_TOKEN || undefined }), { casing: "snake_case" }).insert(analyticsEvents).values(row);
    else await db.insert(analyticsEvents).values(row);
  } catch (err) { console.warn("[analytics] dropped event:", String(err).slice(0, 120)); }
}
