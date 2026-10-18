import { describe, expect, it } from "vitest";
import { createShipbubbleProvider } from "@/infrastructure/shipping/shipbubble";
import { createMockShippingProvider } from "@/infrastructure/shipping/mock";
import { createResendProvider } from "@/infrastructure/email/resend";
import { templates } from "@/infrastructure/email/templates";
import { createMockPaymentProvider } from "@/infrastructure/payments/mock";
import { hmacHex } from "@/lib/crypto";

const j = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const origin = { name: "VERANE", phone: "0800", email: "o@v.test", address: "1 Marina, Lagos" };
const dest = { recipientName: "Ada", phone: "0801", email: "a@b.co", line1: "5 Allen", city: "Ikeja", state: "Lagos", country: "NG" };

describe("shipbubble adapter (mock fetch; live API unverified)", () => {
  it("validates both addresses, fetches rates and maps options with request token", async () => {
    const calls: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push(url.split("/v1")[1]!);
      if (url.endsWith("/address/validate")) return j({ status: "success", data: { address_code: 123 } });
      if (url.endsWith("/fetch_rates")) return j({ status: "success", data: { request_token: "tok", couriers: [{ courier_id: "c1", service_code: "s1", courier_name: "Kwik", service_type: "Standard", total: 2500, delivery_eta: "2 days" }, { courier_id: "bad", service_code: "x", courier_name: "Bad", total: "NaN" }] } });
      throw new Error("unexpected " + url);
    }) as never;
    const p = createShipbubbleProvider({ apiKey: "k", baseUrl: "https://api.shipbubble.com/v1", origin }, f);
    const rates = await p.getRates(dest, [{ name: "Coat", quantity: 1, unitPriceMinor: 1000000 }]);
    expect(rates).toHaveLength(1); expect(rates[0]).toMatchObject({ id: "c1:s1", amountMinor: 250000, currency: "NGN", meta: { requestToken: "tok" } });
    expect(calls).toEqual(["/shipping/address/validate", "/shipping/address/validate", "/shipping/fetch_rates"]);
  });
  it("retries 5xx then fails with PROVIDER; refuses to create a shipment without a quote", async () => {
    let n = 0; const p = createShipbubbleProvider({ apiKey: "k", baseUrl: "https://x/v1", origin }, (async () => { n++; return j({}, 503); }) as never);
    await expect(p.getRates(dest, [])).rejects.toMatchObject({ code: "PROVIDER" }); expect(n).toBeGreaterThanOrEqual(3); // each of the 2 parallel validate calls retries up to 3 times; Promise.all rejects on the first
    await expect(p.createShipment({ orderNumber: "VR-1", dest, items: [], option: { id: "a", name: "n", carrier: "c", amountMinor: 1, currency: "NGN", etaText: null } })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("mock provider is deterministic and the real provider requires a key", async () => {
    const m = createMockShippingProvider(); expect((await m.getRates(dest, []))[0]!.amountMinor).toBe(250000); expect((await m.getRates({ ...dest, state: "Kano" }, []))[0]!.amountMinor).toBe(450000);
    expect(() => createShipbubbleProvider({ apiKey: "", baseUrl: "", origin })).toThrow();
  });
});
describe("resend adapter + templates", () => {
  it("posts to Resend with bearer auth and surfaces provider errors", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const ok = createResendProvider("re_x", "V <a@b.co>", (async (url: string, init: RequestInit) => { seen = { url, init }; return j({ id: "m1" }); }) as never);
    expect(await ok.send({ to: "a@b.co", subject: "s", html: "<p>x</p>", text: "x" })).toEqual({ id: "m1" });
    expect(seen!.url).toBe("https://api.resend.com/emails"); expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
    const bad = createResendProvider("re_x", "V <a@b.co>", (async () => j({ message: "no" }, 422)) as never);
    await expect(bad.send({ to: "a@b.co", subject: "s", html: "", text: "" })).rejects.toMatchObject({ code: "PROVIDER" });
  });
  it("escapes user content in HTML and includes the order total", () => {
    const m = templates.orderConfirmation("a@b.co", { orderNumber: "VR-1", total: 1250000, currency: "NGN", items: [{ name: "<script>x</script>", qty: 1, line: 1250000 }], url: "https://v/orders/VR-1" });
    expect(m.html).not.toContain("<script>x</script>"); expect(m.html).toContain("&lt;script&gt;"); expect(m.text).toContain("12,500");
  });
});
describe("mock payment provider", () => {
  it("signs/validates webhooks and uses the DB-backed lookup when given", async () => {
    const p = createMockPaymentProvider({ secret: "s", lookup: async (r) => (r === "r1" ? { amountMinor: 500, currency: "NGN", state: "paid" } : null) });
    expect(await p.verify("r1")).toMatchObject({ status: "success", amountMinor: 500 }); expect((await p.verify("nope")).status).toBe("failed");
    const body = '{"event":"charge.success","data":{"id":1,"reference":"r1"}}';
    expect(await p.verifyWebhookSignature(body, await hmacHex("SHA-512", "s", body))).toBe(true); expect(await p.verifyWebhookSignature(body, "00")).toBe(false);
  });
});
