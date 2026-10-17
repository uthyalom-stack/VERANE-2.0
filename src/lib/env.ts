import { z } from "zod";
import { AppError } from "./errors";

const schema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  MARKETING_AI_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().refine((value) => { const url = new URL(value); return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)); }, "Use HTTPS except for localhost development").optional()),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("file:./local.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  ANALYTICS_DATABASE_URL: z.string().optional(),
  ANALYTICS_DATABASE_AUTH_TOKEN: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  TOKEN_PEPPER: z.string().min(32),
  MEDIA_DRIVER: z.enum(["local", "r2"]).default("local"),
  MEDIA_PUBLIC_BASE_URL: z.string().default("http://localhost:3000/media"),
  PAYMENT_DRIVER: z.enum(["mock", "paystack"]).default("mock"),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  SHIPPING_DRIVER: z.enum(["mock", "shipbubble"]).default("mock"),
  SHIPBUBBLE_API_KEY: z.string().optional(),
  SHIPBUBBLE_BASE_URL: z.string().default("https://api.shipbubble.com/v1"),
  EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("VÉRANE <no-reply@example.com>"),
  ADMIN_NOTIFY_EMAIL: z.string().optional(),
  CRON_SECRET: z.string().min(24).optional(),
  TAX_BPS: z.coerce.number().int().min(0).max(5000).default(0),
  TAX_INCLUSIVE: z.enum(["true", "false"]).default("true"),
  SHIP_ORIGIN_NAME: z.string().optional(),
  SHIP_ORIGIN_PHONE: z.string().optional(),
  SHIP_ORIGIN_EMAIL: z.string().optional(),
  SHIP_ORIGIN_ADDRESS: z.string().optional(),
});
export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new AppError("CONFIG", `Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  const env = parsed.data;
  assertProductionIntegrations(env);
  if (source === process.env) cached = env;
  return env;
}

/** In production nothing may silently fall back to a mock. */
export function assertProductionIntegrations(env: Env): void {
  if (env.APP_ENV !== "production") return;
  const problems: string[] = [];
  if (env.PAYMENT_DRIVER !== "paystack" || !env.PAYSTACK_SECRET_KEY) problems.push("PAYMENT_DRIVER=paystack + PAYSTACK_SECRET_KEY");
  if (env.SHIPPING_DRIVER !== "shipbubble" || !env.SHIPBUBBLE_API_KEY) problems.push("SHIPPING_DRIVER=shipbubble + SHIPBUBBLE_API_KEY");
  if (!env.CRON_SECRET) problems.push("CRON_SECRET");
  if (env.SHIPPING_DRIVER === "shipbubble" && !(env.SHIP_ORIGIN_NAME && env.SHIP_ORIGIN_PHONE && env.SHIP_ORIGIN_EMAIL && env.SHIP_ORIGIN_ADDRESS)) problems.push("SHIP_ORIGIN_* sender details");
  if (env.EMAIL_DRIVER !== "resend" || !env.RESEND_API_KEY) problems.push("EMAIL_DRIVER=resend + RESEND_API_KEY");
  if (env.DATABASE_URL.startsWith("file:")) problems.push("a remote DATABASE_URL (libSQL)");
  if (!env.APP_URL.startsWith("https://")) problems.push("an https APP_URL");
  if (problems.length) throw new AppError("CONFIG", `Production requires: ${problems.join("; ")}`);
}
