export const PERMISSIONS = {
  // catalog
  "catalog.product.read": "View products (incl. drafts) in scope",
  "catalog.product.write": "Create/edit/archive products and variants",
  "catalog.category.write": "Manage categories",
  "catalog.collection.write": "Manage collections",
  "media.write": "Upload and manage media",
  "inventory.read": "View inventory",
  "inventory.adjust": "Adjust stock levels",
  "orders.read": "View orders in scope",
  "orders.manage": "Update order status, create shipments",
  "customers.read": "View customers who ordered in scope",
  "discounts.write": "Manage discounts",
  "content.write": "Manage pages, campaigns, looks, journal",
  "newsletter.read": "View newsletter subscribers",
  "analytics.read": "View analytics",
  // global-only
  "brands.write": "Manage brands",
  "users.manage": "Manage users, roles and permissions",
  "audit.read": "View audit logs",
  "config.read": "View integration/configuration status",
} as const;
export type PermissionCode = keyof typeof PERMISSIONS;

const BRAND_ADMIN: PermissionCode[] = [
  "catalog.product.read", "catalog.product.write", "catalog.collection.write", "media.write",
  "inventory.read", "inventory.adjust", "orders.read", "orders.manage", "customers.read",
  "discounts.write", "content.write", "newsletter.read", "analytics.read",
];

export const ROLE_DEFINITIONS: Record<string, { name: string; description: string; permissions: PermissionCode[]; brandScoped: boolean }> = {
  SUPER_ADMIN: { name: "Super admin", description: "Global access", permissions: Object.keys(PERMISSIONS) as PermissionCode[], brandScoped: false },
  UTHY_ADMIN: { name: "Brand administrator", description: "Restricted to the assigned brand", permissions: BRAND_ADMIN, brandScoped: true },
  ALOMZIEE_ADMIN: { name: "Brand administrator", description: "Restricted to the assigned brand", permissions: BRAND_ADMIN, brandScoped: true },
};
/** Which brand code each brand-scoped role is allowed to be bound to. */
export const ROLE_BRAND_CODE: Record<string, string> = { UTHY_ADMIN: "UTHY_LUXURY", ALOMZIEE_ADMIN: "ALOMZIEE_FOOTIES" };
/** Permissions that only make sense house-wide; never satisfiable by a brand-bound grant. */
export const GLOBAL_ONLY: PermissionCode[] = ["brands.write", "users.manage", "audit.read", "config.read", "catalog.category.write"];
