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

    await client.execute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, brand_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, short_description TEXT, full_description TEXT, status TEXT DEFAULT 'DRAFT' NOT NULL, base_price_cents INTEGER DEFAULT 0 NOT NULL, currency TEXT DEFAULT 'NGN' NOT NULL, materials TEXT, care_info TEXT, fit_info TEXT, sizing_info TEXT, seo_title TEXT, seo_description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived_at INTEGER);`);
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

  // Rule 1 & 2: Brand Admins product listing isolation
  it("1 & 2. UTHY_ADMIN cannot list ALOMZIEE products and ALOMZIEE_ADMIN cannot list UTHY products", async () => {
    const uthyProd = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "UTHY Silk Suit",
      slug: `uthy-suit-${Date.now()}`,
    });

    const alomzieeProd = await catalogService.createProduct(superUser, {
      brandId: alomzieeBrandId,
      name: "ALOMZIEE Boots",
      slug: `alomziee-boots-${Date.now()}`,
    });

    const uthyList = await catalogService.listProducts(uthyAdminUser);
    expect(uthyList.map((p) => p.id)).toContain(uthyProd.id);
    expect(uthyList.map((p) => p.id)).not.toContain(alomzieeProd.id);

    const alomzieeList = await catalogService.listProducts(alomzieeAdminUser);
    expect(alomzieeList.map((p) => p.id)).toContain(alomzieeProd.id);
    expect(alomzieeList.map((p) => p.id)).not.toContain(uthyProd.id);

    // Attempting to list with explicitly forged brandId filter
    await expect(
      catalogService.listProducts(uthyAdminUser, { brandId: alomzieeBrandId })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      catalogService.listProducts(alomzieeAdminUser, { brandId: uthyBrandId })
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 3 & 4: Brand Admins category listing isolation
  it("3 & 4. UTHY_ADMIN cannot list ALOMZIEE categories and ALOMZIEE_ADMIN cannot list UTHY categories", async () => {
    const uthyCat = await catalogService.createCategory(superUser, {
      name: "UTHY Tops",
      slug: `uthy-tops-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const alomzieeCat = await catalogService.createCategory(superUser, {
      name: "ALOMZIEE Sandals",
      slug: `alomziee-sandals-${Date.now()}`,
      brandId: alomzieeBrandId,
    });

    const uthyCats = await catalogService.listCategories(uthyAdminUser);
    expect(uthyCats.map((c) => c.id)).toContain(uthyCat.id);
    expect(uthyCats.map((c) => c.id)).not.toContain(alomzieeCat.id);

    const alomzieeCats = await catalogService.listCategories(alomzieeAdminUser);
    expect(alomzieeCats.map((c) => c.id)).toContain(alomzieeCat.id);
    expect(alomzieeCats.map((c) => c.id)).not.toContain(uthyCat.id);

    await expect(
      catalogService.listCategories(uthyAdminUser, { brandId: alomzieeBrandId })
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 5 & 6: Brand Admins collection listing isolation
  it("5 & 6. UTHY_ADMIN cannot list ALOMZIEE collections and ALOMZIEE_ADMIN cannot list UTHY collections", async () => {
    const uthyColl = await catalogService.createCollection(superUser, {
      name: "UTHY Winter Drop",
      slug: `uthy-winter-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const alomzieeColl = await catalogService.createCollection(superUser, {
      name: "ALOMZIEE Summer Drop",
      slug: `alomziee-summer-${Date.now()}`,
      brandId: alomzieeBrandId,
    });

    const uthyColls = await catalogService.listCollections(uthyAdminUser);
    expect(uthyColls.map((c) => c.id)).toContain(uthyColl.id);
    expect(uthyColls.map((c) => c.id)).not.toContain(alomzieeColl.id);

    const alomzieeColls = await catalogService.listCollections(alomzieeAdminUser);
    expect(alomzieeColls.map((c) => c.id)).toContain(alomzieeColl.id);
    expect(alomzieeColls.map((c) => c.id)).not.toContain(uthyColl.id);

    await expect(
      catalogService.listCollections(uthyAdminUser, { brandId: alomzieeBrandId })
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 7 & 8: Cross-brand category attachment rejection
  it("7 & 8. UTHY product cannot receive ALOMZIEE category and ALOMZIEE product cannot receive UTHY category", async () => {
    const uthyCat = await catalogService.createCategory(superUser, {
      name: "UTHY Dresses",
      slug: `uthy-dresses-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const alomzieeCat = await catalogService.createCategory(superUser, {
      name: "ALOMZIEE Footwear",
      slug: `alomziee-footwear-${Date.now()}`,
      brandId: alomzieeBrandId,
    });

    await expect(
      catalogService.createProduct(uthyAdminUser, {
        brandId: uthyBrandId,
        name: "UTHY Dress",
        slug: `uthy-dress-${Date.now()}`,
        categoryIds: [alomzieeCat.id],
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      catalogService.createProduct(alomzieeAdminUser, {
        brandId: alomzieeBrandId,
        name: "ALOMZIEE Shoe",
        slug: `alomziee-shoe-${Date.now()}`,
        categoryIds: [uthyCat.id],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 9 & 10: Cross-brand collection product membership rejection
  it("9 & 10. UTHY collection cannot receive ALOMZIEE product and ALOMZIEE collection cannot receive UTHY product", async () => {
    const uthyColl = await catalogService.createCollection(superUser, {
      name: "UTHY Exclusive Rail",
      slug: `uthy-rail-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const alomzieeColl = await catalogService.createCollection(superUser, {
      name: "ALOMZIEE Exclusive Rail",
      slug: `alomziee-rail-${Date.now()}`,
      brandId: alomzieeBrandId,
    });

    const uthyProd = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "UTHY Jacket",
      slug: `uthy-jacket-${Date.now()}`,
    });

    const alomzieeProd = await catalogService.createProduct(superUser, {
      brandId: alomzieeBrandId,
      name: "ALOMZIEE Loafers",
      slug: `alomziee-loafers-${Date.now()}`,
    });

    // UTHY collection receiving ALOMZIEE product -> Rejected
    await expect(
      catalogService.addProductToCollection(superUser, uthyColl.id, alomzieeProd.id)
    ).rejects.toThrow(ForbiddenError);

    // ALOMZIEE collection receiving UTHY product -> Rejected
    await expect(
      catalogService.addProductToCollection(superUser, alomzieeColl.id, uthyProd.id)
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 11 & 12: Brand admins cannot create global entities
  it("11 & 12. Brand admins cannot create global categories or collections", async () => {
    await expect(
      catalogService.createCategory(uthyAdminUser, {
        name: "Global Apparel",
        slug: `global-apparel-${Date.now()}`,
        brandId: null,
      })
    ).rejects.toThrow(ForbiddenError);

    await expect(
      catalogService.createCollection(alomzieeAdminUser, {
        name: "Global Drop",
        slug: `global-drop-${Date.now()}`,
        brandId: null,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // Rule 13: SUPER_ADMIN across both brands and global entity creation
  it("13. SUPER_ADMIN can create global entities and operate across both brands", async () => {
    const globalCat = await catalogService.createCategory(superUser, {
      name: "Universal Accessories",
      slug: `universal-acc-${Date.now()}`,
      brandId: null,
    });
    expect(globalCat.id).toBeDefined();

    const globalColl = await catalogService.createCollection(superUser, {
      name: "Featured Platform Launch",
      slug: `platform-launch-${Date.now()}`,
      brandId: null,
    });
    expect(globalColl.id).toBeDefined();
  });
});
