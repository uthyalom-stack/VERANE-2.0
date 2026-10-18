export type ShipAddress = { recipientName: string; phone: string; email: string; line1: string; line2?: string | undefined; city: string; state: string; postalCode?: string | undefined; country: string };
export type ShipParcelItem = { name: string; quantity: number; unitPriceMinor: number; weightKg?: number };
export type ShippingOption = { id: string; name: string; carrier: string; amountMinor: number; currency: string; etaText: string | null; meta?: Record<string, unknown> };
export type CreatedShipment = { providerShipmentId: string; trackingNumber: string | null; trackingUrl: string | null; carrier: string | null };
export type TrackingStatus = "pending" | "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "failed" | "returned";

export interface ShippingProvider {
  readonly name: "shipbubble" | "mock";
  /** Always called server-side with the destination + cart contents; never trusts a client-supplied price. */
  getRates(dest: ShipAddress, items: ShipParcelItem[]): Promise<ShippingOption[]>;
  createShipment(input: { orderNumber: string; dest: ShipAddress; items: ShipParcelItem[]; option: ShippingOption }): Promise<CreatedShipment>;
  track(providerShipmentId: string): Promise<{ status: TrackingStatus; trackingUrl: string | null }>;
}
