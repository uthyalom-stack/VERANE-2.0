import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createResendProvider } from "./resend";
import { createConsoleProvider } from "./console";
import type { EmailProvider } from "./types";

let dev: EmailProvider | undefined;
export function getEmailProvider(): EmailProvider {
  const env = getEnv();
  if (env.EMAIL_DRIVER === "resend") return createResendProvider(env.RESEND_API_KEY ?? "", env.EMAIL_FROM);
  if (env.APP_ENV === "production") throw new AppError("CONFIG", "Console email is not allowed in production");
  return (dev ??= createConsoleProvider());
}
export type { EmailProvider, EmailMessage } from "./types";
