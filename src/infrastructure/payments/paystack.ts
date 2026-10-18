import { AppError } from "@/lib/errors";
import { hmacHex, safeEqual } from "@/lib/crypto";
import type { InitInput, InitResult, PaymentProvider, VerifyResult, WebhookEvent } from "./types";

const BASE = "https://api.paystack.co";

/**
 * Real Paystack adapter (REST). Amounts are in the lowest currency unit (kobo) — identical to our minor units.
 * Webhooks: Paystack signs the raw body with HMAC-SHA512 using the secret key (header x-paystack-signature).
 * LIVE BEHAVIOUR UNVERIFIED: only exercised with a mocked fetch until credentials are supplied.
 */
export function createPaystackProvider(secretKey: string, fetchImpl: typeof fetch = fetch): PaymentProvider {
  if (!secretKey) throw new AppError("CONFIG", "PAYSTACK_SECRET_KEY is required for the paystack driver");
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetchImpl(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: Record<string, unknown> } | null;
    if (!res.ok || !json?.status || !json.data) throw new AppError("PROVIDER", "Payment provider error", { status: res.status, message: json?.message });
    return json.data;
  };
  return {
    name: "paystack",
    async initialize(i: InitInput): Promise<InitResult> {
      const d = await call("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: i.email, amount: i.amountMinor, currency: i.currency, reference: i.reference, callback_url: i.callbackUrl }) });
      return { authorizationUrl: String(d.authorization_url), reference: String(d.reference ?? i.reference) };
    },
    async verify(reference: string): Promise<VerifyResult> {
      const d = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
      const s = String(d.status);
      return { status: s === "success" ? "success" : s === "failed" ? "failed" : s === "abandoned" ? "abandoned" : "pending",
        amountMinor: Number(d.amount), currency: String(d.currency), reference: String(d.reference), providerTransactionId: d.id != null ? String(d.id) : null, raw: d };
    },
    async verifyWebhookSignature(rawBody, signature) {
      if (!signature) return false;
      return safeEqual(await hmacHex("SHA-512", secretKey, rawBody), signature.toLowerCase());
    },
    parseWebhook(rawBody): WebhookEvent | null {
      try {
        const j = JSON.parse(rawBody) as { event?: string; data?: { id?: number; reference?: string } };
        if (!j.event) return null;
        const ref = j.data?.reference ?? null;
        return { eventKey: `${j.event}:${j.data?.id ?? ref ?? "x"}`, type: j.event, reference: ref, raw: j as Record<string, unknown> };
      } catch { return null; }
    },
  };
}
