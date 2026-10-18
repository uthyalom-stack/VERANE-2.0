import { AppError } from "@/lib/errors";
import type { CreatedShipment, ShipAddress, ShipParcelItem, ShippingOption, ShippingProvider, TrackingStatus } from "./types";

type Cfg = { apiKey: string; baseUrl: string; origin: { name: string; phone: string; email: string; address: string }; categoryId?: number };

/**
 * Shipbubble adapter. Flow (per Shipbubble's public API as I understand it — LIVE UNVERIFIED, field names must be checked
 * against the current docs before go-live): validate sender/receiver addresses -> fetch_rates -> create label from the
 * `request_token` + chosen `service_code`/`courier_id` -> read label for tracking.
 * Rates are re-fetched server-side at order placement; the option id is `${courier_id}:${service_code}` plus request_token in meta.
 */
export function createShipbubbleProvider(cfg: Cfg, fetchImpl: typeof fetch = fetch): ShippingProvider {
  if (!cfg.apiKey) throw new AppError("CONFIG", "SHIPBUBBLE_API_KEY is required for the shipbubble driver");
  const call = async (path: string, body?: unknown, retries = 2): Promise<Record<string, any>> => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetchImpl(`${cfg.baseUrl}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
        const j = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: Record<string, any> } | null;
        if (res.status >= 500 && attempt < retries) { await new Promise((r) => setTimeout(r, 300 * 2 ** attempt)); continue; }
        if (!res.ok || !j || j.status === "failed" || !j.data) throw new AppError("PROVIDER", "Shipping provider error", { status: res.status, message: j?.message });
        return j.data;
      } catch (e) { if (e instanceof AppError || attempt >= retries) throw e instanceof AppError ? e : new AppError("PROVIDER", "Shipping provider unreachable"); await new Promise((r) => setTimeout(r, 300 * 2 ** attempt)); }
    }
  };
  const validate = async (a: { name: string; email: string; phone: string; address: string }) => {
    const d = await call("/shipping/address/validate", { name: a.name, email: a.email, phone: a.phone, address: a.address });
    if (!d.address_code) throw new AppError("VALIDATION", "We couldn't validate that delivery address");
    return Number(d.address_code);
  };
  const flat = (a: ShipAddress) => [a.line1, a.line2, a.city, a.state, a.country].filter(Boolean).join(", ");
  const pkg = (items: ShipParcelItem[]) => items.map((i) => ({ name: i.name, description: i.name, unit_weight: String(i.weightKg ?? 0.5), unit_amount: String(Math.round(i.unitPriceMinor / 100)), quantity: String(i.quantity) }));
  return {
    name: "shipbubble",
    async getRates(dest, items) {
      const [sender, receiver] = await Promise.all([validate({ name: cfg.origin.name, email: cfg.origin.email, phone: cfg.origin.phone, address: cfg.origin.address }), validate({ name: dest.recipientName, email: dest.email, phone: dest.phone, address: flat(dest) })]);
      const pickup = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
      const d = await call("/shipping/fetch_rates", { sender_address_code: sender, reciever_address_code: receiver, pickup_date: pickup, category_id: cfg.categoryId ?? 98190590, package_items: pkg(items), package_dimension: { length: 30, width: 25, height: 10 } });
      const token = String(d.request_token);
      const couriers = (d.couriers ?? []) as Array<Record<string, any>>;
      return couriers.map((c) => ({ id: `${c.courier_id}:${c.service_code}`, name: String(c.service_type ?? c.courier_name), carrier: String(c.courier_name), amountMinor: Math.round(Number(c.total) * 100), currency: "NGN", etaText: c.delivery_eta ? String(c.delivery_eta) : null, meta: { requestToken: token, serviceCode: String(c.service_code), courierId: String(c.courier_id) } }))
        .filter((o) => Number.isFinite(o.amountMinor) && o.amountMinor >= 0);
    },
    async createShipment({ option }) {
      const m = option.meta as { requestToken?: string; serviceCode?: string; courierId?: string } | undefined;
      if (!m?.requestToken || !m.serviceCode || !m.courierId) throw new AppError("VALIDATION", "Shipping quote is missing; re-quote before creating a shipment");
      const d = await call("/shipping/labels", { request_token: m.requestToken, service_code: m.serviceCode, courier_id: m.courierId });
      return { providerShipmentId: String(d.order_id), trackingNumber: d.tracking_number ? String(d.tracking_number) : null, trackingUrl: d.tracking_url ? String(d.tracking_url) : null, carrier: d.courier?.name ? String(d.courier.name) : option.carrier };
    },
    async track(id) {
      const d = await call(`/shipping/labels/${encodeURIComponent(id)}`);
      const raw = String(d.status ?? "").toLowerCase();
      const status: TrackingStatus = raw.includes("deliver") && !raw.includes("out") ? "delivered" : raw.includes("out_for") || raw.includes("out for") ? "out_for_delivery" : raw.includes("transit") || raw.includes("picked") ? "in_transit" : raw.includes("cancel") || raw.includes("fail") ? "failed" : raw.includes("return") ? "returned" : "label_created";
      return { status, trackingUrl: d.tracking_url ? String(d.tracking_url) : null };
    },
  };
}
