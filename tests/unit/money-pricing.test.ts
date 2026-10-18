import { describe, expect, it } from "vitest";
import { parseMajorToMinor, percentOf, formatMoney } from "@/lib/money";
import { computePricing, validateDiscount, type DiscountRule } from "@/domains/pricing";

const line = (brandId: string, unitPrice: number, quantity = 1, variantId = "v" + unitPrice) => ({ variantId, brandId, unitPrice, quantity });
const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({ code: "X", kind: "percent", value: 10, brandId: null, minSubtotal: null, maxRedemptions: null, redemptionCount: 0, startsAt: null, endsAt: null, isActive: true, ...o });

describe("money", () => {
  it("parses major units without float error", () => {
    expect(parseMajorToMinor("0.29")).toBe(29);
    expect(parseMajorToMinor("1999.9")).toBe(199990);
    expect(() => parseMajorToMinor("1.234")).toThrow();
  });
  it("rounds percentages half-up in integers", () => { expect(percentOf(999, 10)).toBe(100); expect(percentOf(1000, 15)).toBe(150); });
  it("formats NGN", () => { expect(formatMoney(1250000)).toContain("12,500"); });
});

describe("pricing", () => {
  it("sums lines, applies percent discount and shipping", () => {
    const r = computePricing({ lines: [line("a", 10000, 2), line("a", 5000)], discount: rule({ value: 10 }), shippingTotal: 1500 });
    expect(r.subtotal).toBe(25000); expect(r.discountTotal).toBe(2500); expect(r.total).toBe(24000);
  });
  it("brand-scoped discounts only discount that brand's lines", () => {
    const r = computePricing({ lines: [line("a", 10000), line("b", 10000)], discount: rule({ brandId: "a", value: 50 }) });
    expect(r.discountTotal).toBe(5000);
  });
  it("fixed discounts never exceed the discountable amount", () => {
    expect(computePricing({ lines: [line("a", 3000)], discount: rule({ kind: "fixed", value: 99999 }) }).total).toBe(0);
  });
  it("rejects expired, inactive, exhausted, below-minimum and non-applicable codes", () => {
    const lines = [line("a", 10000)]; const now = new Date("2026-01-10");
    expect(() => validateDiscount(rule({ endsAt: new Date("2026-01-01") }), lines, now)).toThrow(/expired/);
    expect(() => validateDiscount(rule({ startsAt: new Date("2026-02-01") }), lines, now)).toThrow(/not valid yet/);
    expect(() => validateDiscount(rule({ isActive: false }), lines, now)).toThrow();
    expect(() => validateDiscount(rule({ maxRedemptions: 1, redemptionCount: 1 }), lines, now)).toThrow(/redeemed/);
    expect(() => validateDiscount(rule({ minSubtotal: 20000 }), lines, now)).toThrow(/minimum/);
    expect(() => validateDiscount(rule({ brandId: "zzz" }), lines, now)).toThrow(/does not apply/);
  });
  it("rejects bad quantities and non-integer prices", () => {
    expect(() => computePricing({ lines: [line("a", 100, 0)] })).toThrow();
    expect(() => computePricing({ lines: [line("a", 10.5)] })).toThrow();
  });
  it("adds exclusive tax on top, reports inclusive tax without adding", () => {
    const base = { lines: [line("a", 10000)], taxBps: 750 };
    expect(computePricing({ ...base, taxInclusive: false }).total).toBe(10750);
    expect(computePricing({ ...base, taxInclusive: true }).total).toBe(10000);
  });
});
