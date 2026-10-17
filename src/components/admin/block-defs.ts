import type { BlockDef } from "./block-editor";
export const PAGE_BLOCKS: Record<string, BlockDef> = {
  hero: { label: "Campaign hero (split)", fields: [{ name: "title", label: "Title" }, { name: "subtitle", label: "Subtitle" }, { name: "ctaLabel", label: "Button label" }, { name: "ctaHref", label: "Button link", hint: "/shop or https://…" }] },
  campaign_hero: { label: "Campaign hero (from Campaigns)", fields: [{ name: "slug", label: "Campaign slug", hint: "Uses the campaign's desktop/mobile media, title and button." }] },
  brand_intro: { label: "Brand introductions", fields: [] },
  product_rail: { label: "Product rail", fields: [{ name: "title", label: "Title" }, { name: "source", label: "Source", type: "select", options: ["newest", "featured", "discounted"] }, { name: "limit", label: "How many (1–24)", type: "number" }] },
  collection_feature: { label: "Featured collection", fields: [{ name: "slug", label: "Collection slug" }] },
  look_feature: { label: "Shop the Look feature", fields: [{ name: "slug", label: "Look slug" }] },
  editorial_rail: { label: "Journal stories", fields: [{ name: "title", label: "Title" }, { name: "limit", label: "How many (1–6)", type: "number" }] },
  promo: { label: "Promotional banner", fields: [{ name: "title", label: "Title" }, { name: "body", label: "Text" }, { name: "ctaLabel", label: "Button label" }, { name: "ctaHref", label: "Button link" }] },
  outfit_builder_intro: { label: "Outfit Builder intro", fields: [] },
  newsletter: { label: "Newsletter signup", fields: [] },
};
export const ARTICLE_BLOCKS: Record<string, BlockDef> = {
  paragraph: { label: "Paragraph", fields: [{ name: "text", label: "Text", type: "textarea" }] },
  heading: { label: "Heading", fields: [{ name: "text", label: "Heading" }] },
  quote: { label: "Quote", fields: [{ name: "text", label: "Quote", type: "textarea" }, { name: "cite", label: "Attribution" }] },
  image: { label: "Image", fields: [{ name: "mediaId", label: "Media ID (from Media library)" }, { name: "alt", label: "Alt text override" }] },
  product_embed: { label: "Product", fields: [{ name: "refId", label: "Product ID" }] },
  look_embed: { label: "Shop the Look link", fields: [{ name: "slug", label: "Look slug" }] },
  collection_embed: { label: "Collection link", fields: [{ name: "slug", label: "Collection slug" }] },
};
