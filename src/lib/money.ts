/** All money is integer minor units (kobo for NGN). Never use floats for arithmetic. */
export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR";

export function assertMinor(n: number, label = "amount"): number {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${label} must be an integer number of minor units`);
  return n;
}

/** Convert a major-unit decimal string ("12500.50") to minor units without float math. */
export function parseMajorToMinor(input: string): number {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new RangeError("Invalid money amount");
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

export function formatMoney(minor: number, currency: CurrencyCode | string = "NGN", locale = "en-NG"): string {
  const major = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
  }).format(major);
}

/** Percentage of an amount, rounded half-up to the nearest minor unit. percent may be fractional-free integer 0..100. */
export function percentOf(minor: number, percent: number): number {
  assertMinor(minor);
  if (percent < 0 || percent > 100) throw new RangeError("percent out of range");
  return Math.floor((minor * percent + 50) / 100);
}
