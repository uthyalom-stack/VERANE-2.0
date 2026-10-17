import { z } from "zod";
import { slugify } from "@/lib/slug";

const minor = z.number().int().min(0).max(100_000_000_00);
const slug = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only");

export const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(64).regex(/^[A-Z0-9][A-Z0-9\-_.]*$/i, "SKU may contain letters, numbers, - _ ."),
  size: z.string().trim().max(24).nullable().optional(),
  colorName: z.string().trim().max(40).nullable().optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  priceOverride: minor.nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  initialStock: z.number().int().min(0).max(100000).optional(),
}).refine((v) => v.size || v.colorName, { message: "A variant needs a size or a color" });

const productInputBase = z.object({
  brandId: z.string().min(1),
  name: z.string().trim().min(2).max(140),
  slug: slug.optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  materials: z.string().max(2000).nullable().optional(),
  fit: z.string().max(2000).nullable().optional(),
  sizingInfo: z.string().max(2000).nullable().optional(),
  customSizingEnabled: z.boolean().default(false),
  preOrderEnabled: z.boolean().default(false),
  fulfillmentTime: z.string().trim().max(120).nullable().optional(),
  careInstructions: z.string().max(2000).nullable().optional(),
  deliveryInfo: z.string().max(2000).nullable().optional(),
  productType: z.string().trim().max(60).nullable().optional(),
  style: z.string().trim().max(60).nullable().optional(),
  occasion: z.string().trim().max(60).nullable().optional(),
  currency: z.enum(["NGN"]).default("NGN"),
  basePrice: minor,
  compareAtPrice: minor.nullable().optional(),
  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
  publishAt: z.coerce.date().nullable().optional(),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(170).nullable().optional(),
  categoryIds: z.array(z.string()).max(20).default([]),
  variants: z.array(variantInput).max(200).default([]),
});

export const productInput = productInputBase.superRefine((p, ctx) => {
  if (p.compareAtPrice != null && p.compareAtPrice <= p.basePrice) ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Compare-at price must exceed the price" });
  if (p.status === "scheduled" && !p.publishAt) ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Choose a publish date" });
  const skus = new Set<string>();
  for (const v of p.variants) {
    const k = v.sku.toUpperCase();
    if (skus.has(k)) ctx.addIssue({ code: "custom", path: ["variants"], message: `Duplicate SKU ${v.sku}` });
    skus.add(k);
  }
});
export const productUpdateInput = productInputBase.omit({ variants: true });
export type ProductInput = z.infer<typeof productInput>;
export const resolveSlug = (i: { name: string; slug?: string | undefined }) => i.slug ?? slugify(i.name);

const queryBoolean = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);

export const shopQuery = z.object({
  brand: z.string().optional(), category: z.string().optional(), collection: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(), maxPrice: z.coerce.number().int().min(0).optional(),
  size: z.string().optional(), color: z.string().optional(), style: z.string().optional(),
  occasion: z.string().optional(), type: z.string().optional(),
  availability: z.enum(["in_stock"]).optional(),
  featured: queryBoolean.optional(), sale: queryBoolean.optional(),
  sort: z.enum(["featured", "newest", "price_asc", "price_desc"]).default("featured"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type ShopQuery = z.infer<typeof shopQuery>;
