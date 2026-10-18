import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createMockShippingProvider } from "./mock";
import { createShipbubbleProvider } from "./shipbubble";
import type { ShippingProvider } from "./types";

export function getShippingProvider(): ShippingProvider {
  const e = getEnv();
  if (e.SHIPPING_DRIVER === "shipbubble") {
    return createShipbubbleProvider({ apiKey: e.SHIPBUBBLE_API_KEY ?? "", baseUrl: e.SHIPBUBBLE_BASE_URL, origin: { name: e.SHIP_ORIGIN_NAME ?? "", phone: e.SHIP_ORIGIN_PHONE ?? "", email: e.SHIP_ORIGIN_EMAIL ?? "", address: e.SHIP_ORIGIN_ADDRESS ?? "" } });
  }
  if (e.APP_ENV === "production") throw new AppError("CONFIG", "Mock shipping is not allowed in production");
  return createMockShippingProvider();
}
export type * from "./types";
