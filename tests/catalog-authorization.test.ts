import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { RbacRepository } from "../src/domains/rbac/rbac-repository";
import { BrandRepository } from "../src/domains/brands/brand-repository";
import { CatalogRepository } from "../src/domains/catalog/catalog-repository";
import { CatalogService } from "../src/domains/catalog/catalog-service";
import { AuthorizationService } from "../src/domains/identity/authorization-service";
import { seedDatabase } from "../src/infrastructure/database/seed";
import { BRAND_CODES } from "../src/domains/brands/types";
import { ROLES } from "../src/domains/rbac/types";
import { AuthenticatedUser } from "../src/domains/identity/types";
import { ForbiddenError } from "../src/lib/errors";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Catalog Brand-Scoped Authorization Enforcement", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const catalogRepo = new CatalogRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);
  const catalogService = new CatalogService(catalogRepo, authService);

  let superUser: AuthenticatedUser;
  let uthyAdminUser: AuthenticatedUser;
  let alomzieeAdminUser: AuthenticatedUser;

  let uthyBrandId: string;
  let alomzieeBrandId: string;

  beforeEach(async () => {
    const client = (db as unknown as SqliteSessionClient).session.client;
    await client.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS customer_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS admin_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, revoked_at INTEGER);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL, permission_id TEXT NOT NULL, PRIMARY KEY (role_id, permission_id));`);
    await client.execute(`CREATE TABLE IF NOT EXISTS admin_roles (id TEXT PRIMARY KEY, admin_profile_id TEXT NOT NULL, role_id TEXT NOT NULL, brand_id TEXT, created_at INTEGER NOT NULL);`);

    await client.execute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, brand_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, short_description TEXT, full_description TEXT, status TEXT DEFAULT 'DRAFT' NOT NULL, materials TEXT, care_info TEXT, fit_info TEXT, sizing_info TEXT, seo_title TEXT, seo_description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived_at INTEGER);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS product_variants (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, sku TEXT NOT NULL UNIQUE, size TEXT, color TEXT, color_code TEXT, price_override_cents INTEGER, currency TEXT DEFAULT 'NGN' NOT NULL, barcode TEXT, weight_grams INTEGER, dimensions TEXT, status TEXT DEFAULT 'ACTIVE' NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived_at INTEGER);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, parent_id TEXT, brand_id TEXT, is_active INTEGER DEFAULT 1 NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS product_categories (product_id TEXT NOT NULL, category_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(product_id, category_id));`);
    await client.execute(`CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY NOT NULL, brand_id TEXT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, status TEXT DEFAULT 'DRAFT' NOT NULL, is_featured INTEGER DEFAULT 0 NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived_at INTEGER);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS collection_products (collection_id TEXT NOT NULL, product_id TEXT NOT NULL, position INTEGER DEFAULT 0 NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(collection_id, product_id));`);
    await client.execute(`CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY NOT NULL, variant_id TEXT NOT NULL UNIQUE, quantity INTEGER DEFAULT 0 NOT NULL, reserved_quantity INTEGER DEFAULT 0 NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS inventory_transactions (id TEXT PRIMARY KEY NOT NULL, variant_id TEXT NOT NULL, type TEXT NOT NULL, quantity_change INTEGER NOT NULL, previous_quantity INTEGER NOT NULL, new_quantity INTEGER NOT NULL, reason TEXT, actor_user_id TEXT, created_at INTEGER NOT NULL);`);
    await client.execute(`CREATE TABLE IF NOT EXISTS product_media (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, variant_id TEXT, media_type TEXT NOT NULL, url TEXT NOT NULL, alt_text TEXT, width INTEGER, height INTEGER, duration_seconds INTEGER, poster_url TEXT, position INTEGER DEFAULT 0 NOT NULL, metadata TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);

    await seedDatabase(db);

    const uthy = await brandRepo.findByCode(BRAND_CODES.UTHY_LUXURY);
    const alomziee = await brandRepo.findByCode(BRAND_CODES.ALOMZIEE_FOOTIES);
    uthyBrandId = uthy!.id;
    alomzieeBrandId = alomziee!.id;

    const uthyRole = await rbacRepo.findRoleByName(ROLES.UTHY_ADMIN);
    const alomzieeRole = await rbacRepo.findRoleByName(ROLES.ALOMZIEE_ADMIN);

    const mockSession = {
      id: "sess_123",
      userId: "user_123",
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      revokedAt: null,
    };

    superUser = {
      user: {
        id: "user_super",
        email: "super@verane.com",
        name: "Super Admin",
        passwordHash: "hash",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminProfile: {
        id: "admin_super",
        userId: "user_super",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminRoles: [
        {
          roleId: "role_super_admin",
          roleName: ROLES.SUPER_ADMIN,
          brandId: null,
          brandCode: null,
        },
      ],
      session: mockSession,
    };

    uthyAdminUser = {
      user: {
        id: "user_uthy_admin",
        email: "uthy.admin@verane.com",
        name: "UTHY Admin",
        passwordHash: "hash",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminProfile: {
        id: "admin_uthy",
        userId: "user_uthy_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminRoles: [
        {
          roleId: uthyRole!.id,
          roleName: ROLES.UTHY_ADMIN,
          brandId: uthyBrandId,
          brandCode: BRAND_CODES.UTHY_LUXURY,
        },
      ],
      session: mockSession,
    };

    alomzieeAdminUser = {
      user: {
        id: "user_alomziee_admin",
        email: "alomziee.admin@verane.com",
        name: "ALOMZIEE Admin",
        passwordHash: "hash",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminProfile: {
        id: "admin_alomziee",
        userId: "user_alomziee_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminRoles: [
        {
          roleId: alomzieeRole!.id,
          roleName: ROLES.ALOMZIEE_ADMIN,
          brandId: alomzieeBrandId,
          brandCode: BRAND_CODES.ALOMZIEE_FOOTIES,
        },
      ],
      session: mockSession,
    };
  });

  it("SUPER_ADMIN should be allowed to manage all brand catalogs", async () => {
    const uthyProd = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "UTHY Silk Cape",
      slug: `uthy-cape-${Date.now()}`,
    });

    const alomzieeProd = await catalogService.createProduct(superUser, {
      brandId: alomzieeBrandId,
      name: "ALOMZIEE Leather Loafers",
      slug: `alomziee-loafers-${Date.now()}`,
    });

    expect(uthyProd.id).toBeDefined();
    expect(alomzieeProd.id).toBeDefined();
  });

  it("UTHY_ADMIN should be allowed for UTHY catalog and DENIED for ALOMZIEE catalog", async () => {
    // Allowed: UTHY product creation
    const uthyProd = await catalogService.createProduct(uthyAdminUser, {
      brandId: uthyBrandId,
      name: "UTHY Velvet Gown",
      slug: `uthy-gown-${Date.now()}`,
    });
    expect(uthyProd.id).toBeDefined();

    // Denied: UTHY_ADMIN trying to create ALOMZIEE product by submitting ALOMZIEE brandId
    await expect(
      catalogService.createProduct(uthyAdminUser, {
        brandId: alomzieeBrandId,
        name: "Sneakers",
        slug: `sneakers-${Date.now()}`,
      })
    ).rejects.toThrow(ForbiddenError);

    // Denied: UTHY_ADMIN trying to update an existing ALOMZIEE product ID directly
    const alomzieeProd = await catalogService.createProduct(superUser, {
      brandId: alomzieeBrandId,
      name: "ALOMZIEE Mules",
      slug: `alomziee-mules-${Date.now()}`,
    });

    await expect(
      catalogService.updateProduct(uthyAdminUser, alomzieeProd.id, {
        name: "Hijacked Mules Name",
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      catalogService.archiveProduct(uthyAdminUser, alomzieeProd.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it("ALOMZIEE_ADMIN should be allowed for ALOMZIEE catalog and DENIED for UTHY catalog", async () => {
    // Allowed: ALOMZIEE product creation
    const alomzieeProd = await catalogService.createProduct(alomzieeAdminUser, {
      brandId: alomzieeBrandId,
      name: "ALOMZIEE Chelsea Boots",
      slug: `chelsea-boots-${Date.now()}`,
    });
    expect(alomzieeProd.id).toBeDefined();

    // Denied: ALOMZIEE_ADMIN trying to create UTHY product
    await expect(
      catalogService.createProduct(alomzieeAdminUser, {
        brandId: uthyBrandId,
        name: "UTHY Corset",
        slug: `uthy-corset-${Date.now()}`,
      })
    ).rejects.toThrow(ForbiddenError);

    // Denied: ALOMZIEE_ADMIN updating UTHY product directly
    const uthyProd = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "UTHY Trench Coat",
      slug: `uthy-trench-${Date.now()}`,
    });

    await expect(
      catalogService.updateProduct(alomzieeAdminUser, uthyProd.id, {
        name: "Hijacked Trench Name",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should enforce brand scope on inventory adjustments", async () => {
    const uthyProd = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "UTHY Blazer",
      slug: `uthy-blazer-${Date.now()}`,
    });

    const variant = await catalogService.createVariant(superUser, {
      productId: uthyProd.id,
      sku: `SKU-UTHY-BLAZER-${Date.now()}`,
      initialQuantity: 10,
    });

    // UTHY_ADMIN can adjust UTHY variant inventory
    const adjusted = await catalogService.adjustInventory(uthyAdminUser, {
      variantId: variant.id,
      quantityChange: 5,
      type: "STOCK_RECEIVED",
    });
    expect(adjusted.quantity).toBe(15);

    // ALOMZIEE_ADMIN trying to adjust UTHY variant inventory should be DENIED
    await expect(
      catalogService.adjustInventory(alomzieeAdminUser, {
        variantId: variant.id,
        quantityChange: 5,
        type: "STOCK_RECEIVED",
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
