import { ActionForm, type FieldDef } from "@/components/ui/action-form";
import { saveProductAction } from "@/app/actions/admin";
import { toLocalInput } from "./ui";
import { dollars } from "@/lib/admin";
import type { products } from "@/infrastructure/db/schema";

type P = typeof products.$inferSelect;
export function ProductForm({ brands, categories, selectedCategoryIds, product }: { brands: Array<{ id: string; name: string }>; categories: Array<{ id: string; name: string }>; selectedCategoryIds: string[]; product?: P }) {
  const t = (name: string, label: string, v?: string | null, o: Partial<FieldDef> = {}): FieldDef => ({ name, label, defaultValue: v ?? "", required: false, ...o });
  const fields: FieldDef[] = [
    { name: "brandId", label: "Brand", type: "select", options: brands.map((b) => [b.id, b.name]), defaultValue: product?.brandId },
    t("name", "Name", product?.name, { required: true }), t("slug", "Slug (auto from name if empty)", product?.slug, { hint: "Changing a slug creates a redirect from the old URL." }), t("subtitle", "Subtitle", product?.subtitle),
    t("description", "Description", product?.description, { type: "textarea" }), t("materials", "Materials", product?.materials, { type: "textarea", rows: 2 }), t("fit", "Fit", product?.fit, { type: "textarea", rows: 2 }),
    t("sizingInfo", "Sizing information", product?.sizingInfo, { type: "textarea", rows: 2 }),
    { name: "customSizingEnabled", label: "Offer custom measurements", type: "checkbox", required: false, defaultValue: product?.customSizingEnabled ? "on" : "" },
    { name: "preOrderEnabled", label: "Allow pre-orders", type: "checkbox", required: false, defaultValue: product?.preOrderEnabled ? "on" : "" },
    t("fulfillmentTime", "Pre-order / production lead time", product?.fulfillmentTime, { hint: "Shown as an expected lead time when pre-orders are enabled." }),
    t("careInstructions", "Care", product?.careInstructions, { type: "textarea", rows: 2 }), t("deliveryInfo", "Delivery information", product?.deliveryInfo, { type: "textarea", rows: 2 }),
    t("productType", "Product type", product?.productType), t("style", "Style", product?.style), t("occasion", "Occasion", product?.occasion),
    t("basePrice", "Price (₦)", dollars(product?.basePrice), { required: true, type: "number", step: "0.01" }), t("compareAtPrice", "Compare-at price (₦, optional)", dollars(product?.compareAtPrice), { type: "number", step: "0.01" }),
    { name: "status", label: "Status", type: "select", options: [["draft", "Draft"], ["scheduled", "Scheduled"], ["published", "Published"]], defaultValue: product?.status === "archived" ? "draft" : product?.status ?? "draft" },
    t("publishAt", "Publish at (for Scheduled)", toLocalInput(product?.publishAt), { type: "datetime-local" }),
    { name: "isFeatured", label: "Featured", type: "checkbox", required: false, defaultValue: product?.isFeatured ? "on" : "" },
    { name: "categoryIds", label: "Categories", type: "checkboxes", options: categories.map((c) => [c.id, c.name]), defaultValue: selectedCategoryIds.join(","), required: false },
    t("seoTitle", "SEO title (≤70)", product?.seoTitle), t("seoDescription", "SEO description (≤170)", product?.seoDescription, { type: "textarea", rows: 2 }),
  ];
  return <ActionForm action={saveProductAction} fields={fields} submitLabel={product ? "Save product" : "Create product"} hidden={product ? { id: product.id } : {}} />;
}
