import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDb } from "@/infrastructure/db/client";
import { getEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/crypto";
import { rateLimit } from "@/domains/identity";
import { lookupOrderByEmail } from "@/domains/orders/queries";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Find your order", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Guest order lookup (GET form so it works without JS). Rate-limited; identical response for wrong number or wrong email. */
export default async function Lookup({ searchParams }: { searchParams: Promise<{ order?: string; email?: string }> }) {
  const { order, email } = await searchParams; let result: Awaited<ReturnType<typeof lookupOrderByEmail>> = null; let limited = false;
  if (order && email) {
    const h = await headers(); const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "unknown";
    limited = !(await rateLimit(getDb(), `lookup:${await sha256Hex(ip, getEnv().TOKEN_PEPPER)}`, 10, 15 * 60_000));
    if (!limited) result = await lookupOrderByEmail(getDb(), order.slice(0, 40), email.slice(0, 254));
  }
  return (
    <div className="mx-auto max-w-xl px-5 pb-10 pt-28">
      <h1 className="display text-6xl">Find your order</h1>
      <form className="mt-8 grid gap-4"><label className="grid gap-1.5 text-sm">Order number<input name="order" defaultValue={order} required placeholder="VR-20260101-ABC123" className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-4" /></label>
        <label className="grid gap-1.5 text-sm">Email used at checkout<input name="email" type="email" defaultValue={email} required className="min-h-12 rounded-[var(--r-sm)] border border-line bg-surface px-4" /></label><Button type="submit">Find order</Button></form>
      <div role="status" className="mt-8">{limited ? <p className="text-red-400">Too many attempts. Try again later.</p> : order && email && !result ? <p className="text-red-400">We couldn&apos;t find an order matching those details.</p>
        : result ? <div className="glass rounded-[var(--r-lg)] p-6"><p className="display text-3xl">{result.order.orderNumber}</p><p className="mt-2 text-muted">{result.order.status.replace(/_/g, " ")} · {formatMoney(result.order.total, result.order.currency)}</p>
          <ul className="mt-4 text-sm">{result.items.map((i) => <li key={i.id}>{i.productName} × {i.quantity}</li>)}</ul>{result.shipments[0]?.trackingUrl && <a className="mt-4 inline-block underline" href={result.shipments[0].trackingUrl}>Track delivery</a>}</div> : null}</div>
    </div>
  );
}
