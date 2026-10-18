import { hmacHex, safeEqual } from "@/lib/crypto";
import type { PaymentProvider, VerifyResult } from "./types";

/** DEVELOPMENT/TEST ONLY. Not a real payment integration. `outcomes` lets tests script verify() results. */
export function createMockPaymentProvider(opts: { secret?: string; outcomes?: Map<string, Partial<VerifyResult>>; lookup?: (reference: string) => Promise<{ amountMinor: number; currency: string; state: "paid" | "failed" | "unpaid" } | null> } = {}): PaymentProvider & { paid: Map<string, { amountMinor: number; currency: string }> } {
  const secret = opts.secret ?? "mock-secret";
  const paid = new Map<string, { amountMinor: number; currency: string }>();
  return {
    name: "mock", paid,
    async initialize(i) { paid.set(i.reference, { amountMinor: i.amountMinor, currency: i.currency }); return { authorizationUrl: `/checkout/mock-pay?reference=${encodeURIComponent(i.reference)}`, reference: i.reference }; },
    async verify(reference) {
      if (opts.lookup) {
        const l = await opts.lookup(reference);
        const status = !l ? "failed" : l.state === "paid" ? "success" : l.state === "failed" ? "failed" : "pending";
        return { status, amountMinor: l?.amountMinor ?? 0, currency: l?.currency ?? "NGN", reference, providerTransactionId: `mock_${reference}`, raw: { mock: true } } as VerifyResult;
      }
      const base = paid.get(reference);
      const o = opts.outcomes?.get(reference) ?? {};
      return { status: "success", amountMinor: base?.amountMinor ?? 0, currency: base?.currency ?? "NGN", reference, providerTransactionId: `mock_${reference}`, raw: { mock: true }, ...o } as VerifyResult;
    },
    async verifyWebhookSignature(raw, sig) { return !!sig && safeEqual(await hmacHex("SHA-512", secret, raw), sig.toLowerCase()); },
    parseWebhook(raw) { try { const j = JSON.parse(raw); return { eventKey: `${j.event}:${j.data?.id ?? j.data?.reference}`, type: j.event, reference: j.data?.reference ?? null, raw: j }; } catch { return null; } },
  };
}
