"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { paymentAttempts } from "@/infrastructure/db/schema";
import { assertSameOrigin } from "@/lib/http/origin";

/** DEVELOPMENT ONLY. Records the simulated outcome; the order is still only finalised by the verified return/webhook path. */
export async function mockPayAction(reference: string, outcome: "paid" | "failed") {
  const env = getEnv();
  if (env.APP_ENV === "production" || env.PAYMENT_DRIVER !== "mock") throw new Error("Not available");
  await assertSameOrigin();
  await getDb().update(paymentAttempts).set({ rawResponseJson: { mockState: outcome } }).where(eq(paymentAttempts.reference, reference));
  redirect(`/checkout/return?reference=${encodeURIComponent(reference)}`);
}
