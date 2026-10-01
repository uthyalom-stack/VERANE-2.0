import { z } from "zod";

export const ProductStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type ProductStatus = z.infer<typeof ProductStatusEnum>;

export const VariantStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export type VariantStatus = z.infer<typeof VariantStatusEnum>;

export const CollectionStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type CollectionStatus = z.infer<typeof CollectionStatusEnum>;

export const InventoryTransactionTypeEnum = z.enum([
  "STOCK_RECEIVED",
  "MANUAL_ADJUSTMENT",
  "RESERVATION",
  "RELEASE",
  "SALE",
  "RETURN",
  "CORRECTION",
]);
export type InventoryTransactionType = z.infer<typeof InventoryTransactionTypeEnum>;

export const MediaTypeEnum = z.enum([
  "IMAGE",
  "VIDEO",
  "MODEL_IMAGE",
  "DETAIL_IMAGE",
  "EDITORIAL",
  "PRODUCT_VIDEO",
  "VIDEO_POSTER",
  "ASSET_3D",
]);
export type MediaType = z.infer<typeof MediaTypeEnum>;

// Pricing Helper: Converts minor units (kobo/cents) to formatted string or display float
export function minorUnitsToMajor(minorUnits: number): number {
  return minorUnits / 100;
}

export function majorToMinorUnits(majorUnits: number): number {
  return Math.round(majorUnits * 100);
}

// Validation Schemas
export const CreateProductSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  name: z.string().min(1, "Product name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  status: ProductStatusEnum.default("DRAFT").optional(),
  materials: z.string().optional(),
  careInfo: z.string().optional(),
  fitInfo: z.string().optional(),
  sizingInfo: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
});
export type CreateProductInput = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.omit({ brandId: true }).partial();
export type UpdateProductInput = z.input<typeof UpdateProductSchema>;

export const CreateVariantSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  sku: z.string().min(1, "SKU is required"),
  size: z.string().optional(),
  color: z.string().optional(),
  colorCode: z.string().optional(),
  priceOverrideCents: z.number().int().nonnegative().optional(),
  currency: z.string().default("NGN").optional(),
  barcode: z.string().optional(),
  weightGrams: z.number().int().nonnegative().optional(),
  dimensions: z.string().optional(),
  status: VariantStatusEnum.default("ACTIVE").optional(),
  initialQuantity: z.number().int().nonnegative().default(0).optional(),
});
export type CreateVariantInput = z.input<typeof CreateVariantSchema>;

export const UpdateVariantSchema = CreateVariantSchema.omit({ productId: true }).partial();
export type UpdateVariantInput = z.input<typeof UpdateVariantSchema>;

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});
export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type UpdateCategoryInput = z.input<typeof UpdateCategorySchema>;

export const CreateCollectionSchema = z.object({
  brandId: z.string().optional().nullable(),
  name: z.string().min(1, "Collection name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
  description: z.string().optional(),
  status: CollectionStatusEnum.default("DRAFT").optional(),
  isFeatured: z.boolean().default(false).optional(),
});
export type CreateCollectionInput = z.input<typeof CreateCollectionSchema>;

export const UpdateCollectionSchema = CreateCollectionSchema.partial();
export type UpdateCollectionInput = z.input<typeof UpdateCollectionSchema>;

export const AdjustInventorySchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantityChange: z.number().int(),
  type: InventoryTransactionTypeEnum,
  reason: z.string().optional(),
});
export type AdjustInventoryInput = z.input<typeof AdjustInventorySchema>;

export const CreateMediaSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional().nullable(),
  mediaType: MediaTypeEnum,
  url: z.string().min(1, "Media URL is required"),
  altText: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  posterUrl: z.string().optional(),
  position: z.number().int().nonnegative().default(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateMediaInput = z.input<typeof CreateMediaSchema>;

export const UpdateMediaSchema = CreateMediaSchema.omit({ productId: true }).partial();
export type UpdateMediaInput = z.input<typeof UpdateMediaSchema>;
