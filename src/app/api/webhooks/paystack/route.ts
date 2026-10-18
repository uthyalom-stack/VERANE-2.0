import { NextResponse } from "next/server";
import { getDb } from "@/infrastructure/db/client";
import { getPaymentProvider } from "@/infrastructure/payments";
import { handlePaymentWebhook } from "@/domains/orders";
import { trackServer } from "@/lib/http/track";

export const dynamic = "force-dynamic";

/** Authenticated by HMAC signature over the RAW body (no cookies, no CSRF). Always answers quickly; Paystack retries non-2xx. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 512_000) return NextResponse.json({ ok: false }, { status: 413 });
  const r = await handlePaymentWebhook(getDb(), getPaymentProvider(), raw, req.headers.get("x-paystack-signature"), { onPaid: async (o) => { await trackServer({ name: "purchase", entityType: "order", entityId: o.orderId, brandId: o.brandIds.length === 1 ? o.brandIds[0]! : null, props: { total: o.total } }); } });
  return NextResponse.json({ ok: r.status === 200, note: r.note }, { status: r.status });
}
