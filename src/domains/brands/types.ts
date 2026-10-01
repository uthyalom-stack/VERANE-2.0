export interface BrandDTO {
  id: string;
  name: string;
  slug: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const BRAND_CODES = {
  UTHY_LUXURY: "UTHY_LUXURY",
  ALOMZIEE_FOOTIES: "ALOMZIEE_FOOTIES",
} as const;

export type BrandCode = (typeof BRAND_CODES)[keyof typeof BRAND_CODES];
