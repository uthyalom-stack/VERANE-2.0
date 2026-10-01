import { Product, ProductVariant } from "@/infrastructure/database/schema";

export interface EffectivePriceResult {
  effectivePriceCents: number;
  currency: string;
  isOverride: boolean;
}

/**
 * Calculates the authoritative server-side effective price for a product / variant combination.
 * Uses variant.priceOverrideCents if non-null/non-undefined; otherwise falls back to product.basePriceCents.
 */
export function calculateEffectivePrice(
  product: Product,
  variant?: ProductVariant | null
): EffectivePriceResult {
  if (
    variant &&
    variant.priceOverrideCents !== null &&
    variant.priceOverrideCents !== undefined
  ) {
    return {
      effectivePriceCents: variant.priceOverrideCents,
      currency: variant.currency || product.currency,
      isOverride: true,
    };
  }

  return {
    effectivePriceCents: product.basePriceCents,
    currency: product.currency,
    isOverride: false,
  };
}
