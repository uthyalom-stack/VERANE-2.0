import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt, id, money, ts, updatedAt } from "./_helpers";
import { brands, productVariants, products } from "./catalog";
import { users } from "./identity";

export const addresses = sqliteTable("addresses", {
  id: id(),
  userId: text().references(() => users.id, { onDelete: "cascade" }), // NULL for guest-order snapshot addresses
  label: text(),
  recipientName: text().notNull(),
  phone: text().notNull(),
  line1: text().notNull(),
  line2: text(),
  city: text().notNull(),
  state: text().notNull(),
  postalCode: text(),
  country: text().notNull().default("NG"),
  isDefault: integer({ mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const carts = sqliteTable(
  "carts",
  {
    id: id(),
    userId: text().references(() => users.id, { onDelete: "cascade" }),
    guestTokenHash: text(), // hash of the HTTP-only guest cart cookie
    currency: text().notNull().default("NGN"),
    discountCode: text(),
    status: text({ enum: ["active", "converted", "abandoned"] }).notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("carts_guest_uq").on(t.guestTokenHash), index("carts_user_idx").on(t.userId, t.status)],
);

export const cartItems = sqliteTable(
  "cart_items",
  {
    id: id(),
    cartId: text().notNull().references(() => carts.id, { onDelete: "cascade" }),
    variantId: text().notNull().references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cart_items_uq").on(t.cartId, t.variantId)],
); // NOTE: no price stored; price is always resolved server-side from the catalog.

export const wishlistItems = sqliteTable(
  "wishlist_items",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: text().references(() => productVariants.id, { onDelete: "set null" }),
    priceAtSaveMinor: money(), // lets us show "price changed" without trusting it for checkout
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wishlist_uq").on(t.userId, t.productId)],
);

export const savedOutfits = sqliteTable("saved_outfits", {
  id: id(),
  userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
  brandId: text().references(() => brands.id, { onDelete: "set null" }),
  name: text().notNull(),
  shareToken: text(), // set only when the customer chooses to share
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const outfitItems = sqliteTable(
  "outfit_items",
  {
    id: id(),
    outfitId: text().notNull().references(() => savedOutfits.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: text().references(() => productVariants.id, { onDelete: "set null" }),
    slot: text({ enum: ["top", "bottom", "outerwear", "dress", "footwear", "accessory"] }).notNull(),
    sortOrder: integer().notNull().default(0),
    // composition geometry, per-mille units (see docs/DECISIONS.md D-05)
    x: integer().notNull().default(500),
    y: integer().notNull().default(500),
    scale: integer().notNull().default(1000),
  },
  (t) => [index("outfit_items_outfit_idx").on(t.outfitId, t.sortOrder)],
);

export const discounts = sqliteTable("discounts", {
  id: id(),
  brandId: text().references(() => brands.id, { onDelete: "restrict" }), // NULL = house-wide
  code: text().notNull().unique(),
  kind: text({ enum: ["percent", "fixed"] }).notNull(),
  value: integer().notNull(), // percent: 1..100 ; fixed: minor units
  minSubtotal: money(),
  maxRedemptions: integer(),
  redemptionCount: integer().notNull().default(0),
  startsAt: ts(),
  endsAt: ts(),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    orderNumber: text().notNull().unique(), // VR-YYYYMMDD-XXXXXX
    userId: text().references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    phone: text(),
    currency: text().notNull().default("NGN"),
    status: text({
      enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded", "payment_failed", "expired"],
    }).notNull().default("pending_payment"),
    paymentStatus: text({ enum: ["unpaid", "pending", "paid", "failed", "cancelled", "refunded"] }).notNull().default("unpaid"),
    subtotal: money().notNull(),
    discountTotal: money().notNull().default(0),
    shippingTotal: money().notNull().default(0),
    taxTotal: money().notNull().default(0),
    total: money().notNull(),
    discountCode: text(),
    shippingAddressJson: text({ mode: "json" }).$type<Record<string, unknown>>().notNull(),
    shippingOptionJson: text({ mode: "json" }).$type<Record<string, unknown>>(),
    reservationExpiresAt: ts(),
    publicTokenHash: text(), // sha256(pepper+token): lets a guest buyer open their confirmation without an account
    cartId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId, t.createdAt), index("orders_status_idx").on(t.status)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: id(),
    orderId: text().notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: text().notNull().references(() => products.id, { onDelete: "restrict" }),
    variantId: text().notNull().references(() => productVariants.id, { onDelete: "restrict" }),
    brandId: text().notNull().references(() => brands.id, { onDelete: "restrict" }), // denormalised for brand-scoped order access
    productName: text().notNull(), // snapshots
    sku: text().notNull(),
    size: text(),
    colorName: text(),
    unitPrice: money().notNull(),
    quantity: integer().notNull(),
    lineTotal: money().notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_brand_idx").on(t.brandId)],
);

export const paymentAttempts = sqliteTable(
  "payment_attempts",
  {
    id: id(),
    orderId: text().notNull().references(() => orders.id, { onDelete: "cascade" }),
    provider: text().notNull(), // paystack | mock
    reference: text().notNull().unique(), // our reference, sent to the provider
    providerTransactionId: text(),
    amount: money().notNull(),
    currency: text().notNull(),
    status: text({ enum: ["initialized", "success", "failed", "abandoned", "mismatch"] }).notNull().default("initialized"),
    verifiedAt: ts(),
    rawResponseJson: text({ mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pay_order_idx").on(t.orderId)],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: id(),
    provider: text().notNull(),
    eventKey: text().notNull(), // provider event id, or event+reference fallback
    eventType: text().notNull(),
    signatureValid: integer({ mode: "boolean" }).notNull(),
    payloadJson: text({ mode: "json" }).$type<Record<string, unknown>>(),
    processedAt: ts(),
    processingError: text(),
    receivedAt: createdAt(),
  },
  (t) => [uniqueIndex("webhook_event_uq").on(t.provider, t.eventKey)],
);

export const shippingRecords = sqliteTable("shipping_records", {
  id: id(),
  orderId: text().notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text().notNull(),
  providerShipmentId: text(),
  trackingNumber: text(),
  trackingUrl: text(),
  carrier: text(),
  status: text({ enum: ["pending", "label_created", "in_transit", "out_for_delivery", "delivered", "failed", "returned"] }).notNull().default("pending"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orderStatusHistory = sqliteTable(
  "order_status_history",
  {
    id: id(),
    orderId: text().notNull().references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text(),
    toStatus: text().notNull(),
    note: text(),
    actorUserId: text(),
    createdAt: createdAt(),
  },
  (t) => [index("osh_order_idx").on(t.orderId, t.createdAt)],
);

export const savedLooks = sqliteTable(
  "saved_looks",
  {
    id: id(),
    userId: text().notNull().references(() => users.id, { onDelete: "cascade" }),
    lookId: text().notNull(), // FK to looks declared in editorial.ts would create an import cycle; enforced in the service
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("saved_looks_uq").on(t.userId, t.lookId)],
);
