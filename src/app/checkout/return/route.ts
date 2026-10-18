import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { getPaymentProvider } from "@/infrastructure/payments";
import { finalizePayment } from "@/domains/orders";
import { trackServer } from "@/lib/http/track";
import { orders, paymentAttempts } from "@/infrastructure/db/schema";

export const dynamic = "force-dynamic";

/**
 * Payment return. The redirect is NOT proof of payment: we ignore any status in the query string and ask the provider
 * server-to-server (finalizePayment verifies amount/currency and is idempotent, so refreshing or racing the webhook is safe).
 */
export async function GET(req: NextRequest) {
  const base = getEnv().APP_URL;
  const ref = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref");
  if (!ref || ref.length > 100) return NextResponse.redirect(`${base}/cart`);
  const db = getDb();
  const outcome = await finalizePayment(db, getPaymentProvider(), ref, { onPaid: async (o) => { await trackServer({ name: "purchase", entityType: "order", entityId: o.orderId, brandId: o.brandIds.length === 1 ? o.brandIds[0]! : null, props: { total: o.total } }); } }).catch(() => "pending" as const);
  const [a] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.reference, ref));
  const [o] = a ? await db.select().from(orders).where(eq(orders.id, a.orderId)) : [];
  if (!o) return NextResponse.redirect(`${base}/cart`);
  const state = outcome === "paid" || outcome === "already_paid" ? "paid" : outcome === "failed" ? "failed" : outcome === "mismatch" ? "review" : "pending";
  return NextResponse.redirect(`${base}/orders/${o.orderNumber}?payment=${state}`);
}
