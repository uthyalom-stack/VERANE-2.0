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

  CATEGORIES_READ: "categories.read",
  CATEGORIES_CREATE: "categories.create",
  CATEGORIES_UPDATE: "categories.update",
  CATEGORIES_ARCHIVE: "categories.archive",

  COLLECTIONS_READ: "collections.read",
  COLLECTIONS_CREATE: "collections.create",
  COLLECTIONS_UPDATE: "collections.update",
  COLLECTIONS_ARCHIVE: "collections.archive",

  ORDERS_READ: "orders.read",
  ORDERS_UPDATE: "orders.update",

  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",

  MEDIA_READ: "media.read",
  MEDIA_CREATE: "media.create",
  MEDIA_UPDATE: "media.update",
  MEDIA_DELETE: "media.delete",

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
