import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createPaystackProvider } from "./paystack";
import { createMockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { paymentAttempts } from "@/infrastructure/db/schema";

export function getPaymentProvider(): PaymentProvider {
  const env = getEnv();
  if (env.PAYMENT_DRIVER === "paystack") return createPaystackProvider(env.PAYSTACK_SECRET_KEY ?? "");
  if (env.APP_ENV === "production") throw new AppError("CONFIG", "Mock payments are not allowed in production");
  return createMockPaymentProvider({
    secret: "mock-secret",
    // Dev-only: "paid" state is recorded on the attempt by /checkout/mock-pay (never by the browser redirect itself).
    lookup: async (reference) => {
      const [a] = await getDb().select().from(paymentAttempts).where(eq(paymentAttempts.reference, reference));
      if (!a) return null;
      const raw = (a.rawResponseJson ?? {}) as { mockState?: string };
      return { amountMinor: a.amount, currency: a.currency, state: raw.mockState === "paid" ? "paid" : raw.mockState === "failed" ? "failed" : "unpaid" };
    },
  });
}
export type { PaymentProvider } from "./types";
