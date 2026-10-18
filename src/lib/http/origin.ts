import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * CSRF defence-in-depth for every state-changing server action / cookie-authenticated route handler:
 * (1) cookies are SameSite=Lax + HttpOnly, (2) Next verifies Origin vs Host for server actions, and
 * (3) we additionally require an Origin that matches the request host or APP_URL. Webhooks are NOT covered
 * (they authenticate by signature) and must not call this.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "Cross-site request blocked");
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { throw new AppError("FORBIDDEN", "Cross-site request blocked"); }
  const hosts = new Set([h.get("x-forwarded-host"), h.get("host"), new URL(getEnv().APP_URL).host].filter(Boolean) as string[]);
  if (!hosts.has(originHost)) throw new AppError("FORBIDDEN", "Cross-site request blocked");
}

export { safeNext } from "./safe-next";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
