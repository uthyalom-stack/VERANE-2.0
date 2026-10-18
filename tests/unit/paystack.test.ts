import { describe, expect, it } from "vitest";
import { createPaystackProvider } from "@/infrastructure/payments/paystack";
import { hmacHex } from "@/lib/crypto";

const ok = (data: unknown) => new Response(JSON.stringify({ status: true, message: "ok", data }), { status: 200 });

describe("paystack adapter (mocked fetch — live API unverified)", () => {
  it("initialises with kobo amount, currency and reference; sends bearer auth", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const p = createPaystackProvider("sk_test_x", (async (url: string, init: RequestInit) => { seen = { url, init }; return ok({ authorization_url: "https://checkout.paystack.com/abc", reference: "r1" }); }) as never);
    const r = await p.initialize({ reference: "r1", amountMinor: 125000, currency: "NGN", email: "a@b.co", callbackUrl: "https://x.test/cb" });
    expect(r.authorizationUrl).toContain("paystack"); expect(seen!.url).toContain("/transaction/initialize");
    expect(JSON.parse(String(seen!.init.body))).toMatchObject({ amount: 125000, currency: "NGN", reference: "r1" });
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
  });
  it("maps verify responses and treats provider errors as PROVIDER errors", async () => {
    const good = createPaystackProvider("sk", (async () => ok({ status: "success", amount: 5000, currency: "NGN", reference: "r2", id: 7 })) as never);
    expect(await good.verify("r2")).toMatchObject({ status: "success", amountMinor: 5000, providerTransactionId: "7" });
    const bad = createPaystackProvider("sk", (async () => new Response("{}", { status: 500 })) as never);
    await expect(bad.verify("r3")).rejects.toMatchObject({ code: "PROVIDER" });
  });
  it("verifies HMAC-SHA512 webhook signatures over the raw body", async () => {
    const p = createPaystackProvider("sk_live_secret");
    const body = '{"event":"charge.success","data":{"id":1,"reference":"r"}}';
    expect(await p.verifyWebhookSignature(body, await hmacHex("SHA-512", "sk_live_secret", body))).toBe(true);
    expect(await p.verifyWebhookSignature(body + " ", await hmacHex("SHA-512", "sk_live_secret", body))).toBe(false);
    expect(await p.verifyWebhookSignature(body, null)).toBe(false);
  });
});
