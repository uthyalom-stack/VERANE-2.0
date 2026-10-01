import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().default("file:local.db"),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().default("verane-media-dev"),
    R2_PUBLIC_URL: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.SESSION_SECRET || data.SESSION_SECRET.trim().length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SESSION_SECRET"],
          message: "SESSION_SECRET is required in production and must be at least 16 characters long.",
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    SESSION_SECRET:
      data.SESSION_SECRET ||
      (data.NODE_ENV !== "production"
        ? "development-only-verane-session-secret-32chars"
        : ""),
  }));

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_ENVIRONMENT: z.enum(["development", "preview", "production"]).default("development"),
});

export function parseServerEnv(env: Record<string, string | undefined>) {
  return serverEnvSchema.parse(env);
}

export function parseClientEnv(env: Record<string, string | undefined>) {
  return clientEnvSchema.parse(env);
}

export const serverEnv = parseServerEnv({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
});
