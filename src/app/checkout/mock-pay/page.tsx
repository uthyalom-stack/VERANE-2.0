import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { paymentAttempts } from "@/infrastructure/db/schema";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { mockPayAction } from "@/app/actions/mock-pay";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function MockPay({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const env = getEnv();
  if (env.APP_ENV === "production" || env.PAYMENT_DRIVER !== "mock") notFound();
  const ref = (await searchParams).reference ?? "";
  const [a] = await getDb().select().from(paymentAttempts).where(eq(paymentAttempts.reference, ref));
  if (!a) notFound();
  return (
    <div className="mx-auto max-w-lg px-5 pb-20 pt-32">
      <p className="glass mb-8 rounded-[var(--r-md)] p-4 text-sm">Development payment simulator. This is not a real payment and is disabled in production.</p>
      <h1 className="display text-5xl">Pay {formatMoney(a.amount, a.currency)}</h1>
      <p className="mt-3 text-sm text-muted">Reference {a.reference}</p>
      <div className="mt-8 flex gap-3">
        <form action={mockPayAction.bind(null, ref, "paid")}><Button type="submit">Simulate successful payment</Button></form>
        <form action={mockPayAction.bind(null, ref, "failed")}><Button type="submit" variant="outline">Simulate failure</Button></form>
      </div>
    </div>
  );
}
