export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  UTHY_ADMIN: "UTHY_ADMIN",
  ALOMZIEE_ADMIN: "ALOMZIEE_ADMIN",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_ARCHIVE: "products.archive",

  ORDERS_READ: "orders.read",
  ORDERS_UPDATE: "orders.update",

  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",

  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_PUBLISH: "content.publish",

  ANALYTICS_READ: "analytics.read",

  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_UPDATE: "customers.update",

  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface AdminRoleAssignment {
  roleId: string;
  roleName: string;
  brandId: string | null;
  brandCode: string | null;
}
