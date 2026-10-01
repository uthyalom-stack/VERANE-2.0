import { describe, it, expect, beforeEach } from "vitest";
import { createDatabaseConnection } from "../src/infrastructure/database/client";
import { seedDatabase } from "../src/infrastructure/database/seed";
import { CatalogRepository } from "../src/domains/catalog/catalog-repository";
import { CatalogService } from "../src/domains/catalog/catalog-service";
import { RbacRepository } from "../src/domains/rbac/rbac-repository";
import { BrandRepository } from "../src/domains/brands/brand-repository";
import { AuthorizationService } from "../src/domains/identity/authorization-service";
import { AuthenticatedUser } from "../src/domains/identity/types";
import { ROLES } from "../src/domains/rbac/types";
import { BRAND_CODES } from "../src/domains/brands/types";
import { ValidationError } from "../src/lib/errors";

interface SqliteSessionClient {
  session: {
    client: {
      execute: (sql: string) => Promise<unknown>;
    };
  };
}

describe("Catalog Foundation Domain & Repositories", () => {
  const db = createDatabaseConnection({ url: "file::memory:" });
  const catalogRepo = new CatalogRepository(db);
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);
  const authService = new AuthorizationService(rbacRepo, brandRepo);
  const catalogService = new CatalogService(catalogRepo, authService);

  let superUser: AuthenticatedUser;
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

  it("should create, retrieve, update, and archive a product with categories", async () => {
    const category = await catalogService.createCategory(superUser, {
      name: "Ready-To-Wear",
      slug: `rtw-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const product = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Silk Evening Gown",
      slug: `silk-gown-${Date.now()}`,
      shortDescription: "Luxurious evening dress",
      categoryIds: [category.id],
    });

    expect(product.id).toBeDefined();
    expect(product.brandId).toBe(uthyBrandId);

    const retrieved = await catalogService.getProductById(superUser, product.id);
    expect(retrieved.name).toBe("Silk Evening Gown");

    const updated = await catalogService.updateProduct(superUser, product.id, {
      name: "Scultped Silk Evening Gown",
    });
    expect(updated.name).toBe("Scultped Silk Evening Gown");

    const archived = await catalogService.archiveProduct(superUser, product.id);
    expect(archived.status).toBe("ARCHIVED");
  });

  it("should reject duplicate product slug", async () => {
    const slug = `unique-slug-${Date.now()}`;
    await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "First Product",
      slug,
    });

    await expect(
      catalogService.createProduct(superUser, {
        brandId: uthyBrandId,
        name: "Second Product",
        slug,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should create variants with minor-unit price override and SKU uniqueness", async () => {
    const product = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Tailored Jacket",
      slug: `tailored-jacket-${Date.now()}`,
    });

    const sku = `SKU-JKT-XS-${Date.now()}`;
    const variant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku,
      size: "XS",
      color: "Black",
      colorCode: "#000000",
      priceOverrideCents: 2500000, // 25,000 NGN in kobo
      initialQuantity: 10,
    });

    expect(variant.sku).toBe(sku);
    expect(variant.priceOverrideCents).toBe(2500000);

    const inv = await catalogRepo.getVariantInventory(variant.id);
    expect(inv?.quantity).toBe(10);
    expect(inv?.reservedQuantity).toBe(0);

    await expect(
      catalogService.createVariant(superUser, {
        productId: product.id,
        sku,
        size: "S",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should enforce category hierarchy and duplicate slug prevention", async () => {
    const parent = await catalogService.createCategory(superUser, {
      name: "Women",
      slug: `women-${Date.now()}`,
      brandId: uthyBrandId,
    });

    const child = await catalogService.createCategory(superUser, {
      name: "Outerwear",
      slug: `outerwear-${Date.now()}`,
      parentId: parent.id,
      brandId: uthyBrandId,
    });

    expect(child.parentId).toBe(parent.id);

    await expect(
      catalogService.createCategory(superUser, {
        name: "Women Dup",
        slug: parent.slug,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should create collections, support product membership and position reordering", async () => {
    const collection = await catalogService.createCollection(superUser, {
      brandId: uthyBrandId,
      name: "Autumn/Winter Haute Couture",
      slug: `aw-couture-${Date.now()}`,
    });

    const prod1 = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Couture Coat 1",
      slug: `couture-1-${Date.now()}`,
    });

    const prod2 = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Couture Coat 2",
      slug: `couture-2-${Date.now()}`,
    });

    await catalogService.addProductToCollection(superUser, collection.id, prod1.id, 0);
    await catalogService.addProductToCollection(superUser, collection.id, prod2.id, 1);

    let items = await catalogRepo.listCollectionProducts(collection.id);
    expect(items[0].product.id).toBe(prod1.id);
    expect(items[1].product.id).toBe(prod2.id);

    // Reorder: swap positions
    await catalogService.reorderCollectionProducts(superUser, collection.id, [
      { productId: prod1.id, position: 1 },
      { productId: prod2.id, position: 0 },
    ]);

    items = await catalogRepo.listCollectionProducts(collection.id);
    expect(items[0].product.id).toBe(prod2.id);
    expect(items[1].product.id).toBe(prod1.id);
  });

  it("should manage inventory adjustments, record transactions, and prevent negative inventory", async () => {
    const product = await catalogService.createProduct(superUser, {
      brandId: alomzieeBrandId,
      name: "Leather Boots",
      slug: `leather-boots-${Date.now()}`,
    });

    const variant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku: `SKU-BOOTS-42-${Date.now()}`,
      size: "EU 42",
      initialQuantity: 5,
    });

    const updatedInv = await catalogService.adjustInventory(superUser, {
      variantId: variant.id,
      quantityChange: 15,
      type: "STOCK_RECEIVED",
      reason: "Restock Shipment",
    });

    expect(updatedInv.quantity).toBe(20);

    const txs = await catalogRepo.listInventoryTransactions(variant.id);
    expect(txs.length).toBe(2); // Initial creation (5) + Restock (15)

    // Attempting to subtract more than available should throw
    await expect(
      catalogService.adjustInventory(superUser, {
        variantId: variant.id,
        quantityChange: -100,
        type: "MANUAL_ADJUSTMENT",
      })
    ).rejects.toThrow("Inventory quantity cannot be negative");
  });

  it("should handle product and variant media associations and ordering", async () => {
    const product = await catalogService.createProduct(superUser, {
      brandId: uthyBrandId,
      name: "Structured Blazer",
      slug: `blazer-${Date.now()}`,
    });

    const variant = await catalogService.createVariant(superUser, {
      productId: product.id,
      sku: `SKU-BLAZER-BLK-${Date.now()}`,
      color: "Black",
    });

    await catalogService.createMedia(superUser, {
      productId: product.id,
      mediaType: "EDITORIAL",
      url: "https://media.verane.com/blazer-editorial.jpg",
      position: 0,
    });

    const varMedia = await catalogService.createMedia(superUser, {
      productId: product.id,
      variantId: variant.id,
      mediaType: "DETAIL_IMAGE",
      url: "https://media.verane.com/blazer-black-detail.jpg",
      position: 0,
    });

    const prodMediaList = await catalogService.listMediaByProduct(superUser, product.id);
    expect(prodMediaList.length).toBe(2);

    const varMediaList = await catalogService.listMediaByVariant(superUser, variant.id);
    expect(varMediaList.length).toBe(1);
    expect(varMediaList[0].id).toBe(varMedia.id);
  });
});
