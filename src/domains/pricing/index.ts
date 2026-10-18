import { assertMinor, percentOf } from "@/lib/money";
import { AppError } from "@/lib/errors";

export type PricedLine = { variantId: string; brandId: string; unitPrice: number; quantity: number };
export type DiscountRule = {
  code: string; kind: "percent" | "fixed"; value: number; brandId: string | null;
  minSubtotal: number | null; maxRedemptions: number | null; redemptionCount: number;
  startsAt: Date | null; endsAt: Date | null; isActive: boolean;
};
export type PricingInput = {
  lines: PricedLine[]; discount?: DiscountRule | null; shippingTotal?: number;
  taxBps?: number; taxInclusive?: boolean; now?: Date;
};
export type PricingResult = {
  lines: Array<PricedLine & { lineTotal: number }>;
  subtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; total: number;
};

/** Effective unit price = variant override if set, else product base price. */
export function effectiveUnitPrice(base: number, override: number | null | undefined): number {
  return assertMinor(override ?? base, "unit price");
}

export function validateDiscount(rule: DiscountRule, lines: PricedLine[], now: Date): { discountable: number } {
  if (!rule.isActive) throw new AppError("VALIDATION", "This code is not active");
  if (rule.startsAt && now < rule.startsAt) throw new AppError("VALIDATION", "This code is not valid yet");
  if (rule.endsAt && now > rule.endsAt) throw new AppError("VALIDATION", "This code has expired");
  if (rule.maxRedemptions !== null && rule.redemptionCount >= rule.maxRedemptions) throw new AppError("VALIDATION", "This code has been fully redeemed");
  const scoped = lines.filter((l) => rule.brandId === null || l.brandId === rule.brandId);
  const discountable = scoped.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (discountable === 0) throw new AppError("VALIDATION", "This code does not apply to items in your bag");
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  if (rule.minSubtotal !== null && subtotal < rule.minSubtotal) throw new AppError("VALIDATION", "Your bag is below the minimum for this code");
  return { discountable };
}

export function computePricing(input: PricingInput): PricingResult {
  const now = input.now ?? new Date();
  for (const l of input.lines) {
    assertMinor(l.unitPrice);
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99) throw new AppError("VALIDATION", "Invalid quantity");
  }
  const lines = input.lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let discountTotal = 0;
  if (input.discount) {
    const { discountable } = validateDiscount(input.discount, input.lines, now);
    discountTotal = input.discount.kind === "percent" ? percentOf(discountable, input.discount.value) : Math.min(input.discount.value, discountable);
  }
  const shippingTotal = assertMinor(input.shippingTotal ?? 0, "shipping");
  const taxable = subtotal - discountTotal;
  const bps = input.taxBps ?? 0;
  const taxRaw = Math.floor((taxable * bps + 5000) / 10000);
  // inclusive: tax is already inside prices (reported, not added). exclusive: added on top.
  const taxTotal = taxRaw;
  const total = subtotal - discountTotal + shippingTotal + (input.taxInclusive === false ? taxTotal : 0);
  return { lines, subtotal, discountTotal, shippingTotal, taxTotal, total };
}
