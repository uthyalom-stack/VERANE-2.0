import type { ShippingProvider } from "./types";
/** DEVELOPMENT/TEST ONLY — deterministic fake rates, NOT real carrier data. Refused in production. */
export function createMockShippingProvider(): ShippingProvider {
  return {
    name: "mock",
    async getRates(dest) {
      const lagos = dest.state.trim().toLowerCase() === "lagos";
      return [
        { id: "mock-standard", name: "Standard (mock)", carrier: "MockCarrier", amountMinor: lagos ? 250000 : 450000, currency: "NGN", etaText: lagos ? "1–2 days" : "3–5 days" },
        { id: "mock-express", name: "Express (mock)", carrier: "MockCarrier", amountMinor: lagos ? 450000 : 900000, currency: "NGN", etaText: lagos ? "Same day" : "1–2 days" },
      ];
    },
    async createShipment({ orderNumber }) { return { providerShipmentId: `mock-${orderNumber}`, trackingNumber: `MOCK${orderNumber.slice(-6)}`, trackingUrl: null, carrier: "MockCarrier" }; },
    async track() { return { status: "in_transit", trackingUrl: null }; },
  };
}
