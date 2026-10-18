import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { seedDatabase } from "../src/infrastructure/database/seed";
import { CatalogRepository } from "../src/domains/catalog/catalog-repository";
import { CatalogService } from "../src/domains/catalog/catalog-service";
import { calculateEffectivePrice } from "../src/domains/catalog/pricing";
import { RbacRepository } from "../src/domains/rbac/rbac-repository";
import { BrandRepository } from "../src/domains/brands/brand-repository";
import { AuthorizationService } from "../src/domains/identity/authorization-service";
import { AuthenticatedUser } from "../src/domains/identity/types";
import { ROLES } from "../src/domains/rbac/types";
import { BRAND_CODES } from "../src/domains/brands/types";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Catalog Foundation Domain & Invariants", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const catalogRepo = new CatalogRepository(db);
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);
  const catalogService = new CatalogService(catalogRepo, authService);

  let superUser: AuthenticatedUser;
  let uthyBrandId: string;

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
    uthyBrandId = uthy!.id;

    superUser = {
      user: {
        id: "super_user_1",
        email: "super@verane.com",
        name: "Super Admin",
        passwordHash: "hash",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminProfile: {
        id: "admin_prof_super",
        userId: "super_user_1",
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
      session: {
        id: "sess_super",
        userId: "super_user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        lastUsedAt: new Date(),
        revokedAt: null,
      },
    };
  });

  // Rule 14 & 15: Product Base Price & Variant Price Override
  it("14 & 15. Uses product base price when no variant override exists, and variant override when present", async () => {
    const product = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Structured Silk Gown",
      slug: `silk-gown-${Date.now()}`,
      basePriceCents: 15000000, // 150,000 NGN in kobo
      currency: "NGN",
    });

    const defaultVariant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku: `SKU-GOWN-M-${Date.now()}`,
      size: "M",
    });

    const overrideVariant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku: `SKU-GOWN-XL-${Date.now()}`,
      size: "XL",
      priceOverrideCents: 18000000, // 180,000 NGN in kobo
    });

    const defaultPrice = calculateEffectivePrice(product, defaultVariant);
    expect(defaultPrice.effectivePriceCents).toBe(15000000);
    expect(defaultPrice.isOverride).toBe(false);

    const overridePrice = calculateEffectivePrice(product, overrideVariant);
    expect(overridePrice.effectivePriceCents).toBe(18000000);
    expect(overridePrice.isOverride).toBe(true);
  });

  // Rule 16: Inventory Invariants (reservation, release, insufficient stock, negative stock)
  it("16. Inventory invariants cannot be violated", async () => {
    const product = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Couture Blazer",
      slug: `blazer-${Date.now()}`,
      basePriceCents: 5000000,
    });

    const variant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku: `SKU-BLAZER-M-${Date.now()}`,
      initialQuantity: 10,
    });

    // 1. Valid reservation
    let inv = await catalogService.adjustInventory(superUser, {
      variantId: variant.id,
      quantityChange: 4,
      type: "RESERVATION",
    });
    expect(inv.quantity).toBe(10);
    expect(inv.reservedQuantity).toBe(4);

    // 2. Valid release
    inv = await catalogService.adjustInventory(superUser, {
      variantId: variant.id,
      quantityChange: 2,
      type: "RELEASE",
    });
    expect(inv.quantity).toBe(10);
    expect(inv.reservedQuantity).toBe(2);

    // 3. Insufficient available stock for reservation (Available: 10 - 2 = 8; Request: 9)
    await expect(
      catalogService.adjustInventory(superUser, {
        variantId: variant.id,
        quantityChange: 9,
        type: "RESERVATION",
      })
    ).rejects.toThrow("Insufficient available inventory for reservation");

    // 4. Invalid release exceeding reserved quantity
    await expect(
      catalogService.adjustInventory(superUser, {
        variantId: variant.id,
        quantityChange: 5,
        type: "RELEASE",
      })
    ).rejects.toThrow("Invalid release quantity: exceeds reserved quantity");

    // 5. Preventing negative total quantity
    await expect(
      catalogService.adjustInventory(superUser, {
        variantId: variant.id,
        quantityChange: -15,
        type: "MANUAL_ADJUSTMENT",
      })
    ).rejects.toThrow("Inventory quantity cannot be negative");
  });
});
