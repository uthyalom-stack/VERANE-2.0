import { eq, and, sql, asc, inArray } from "drizzle-orm";
import { Database } from "@/infrastructure/database/client";
import {
  products,
  productVariants,
  categories,
  productCategories,
  collections,
  collectionProducts,
  inventory,
  inventoryTransactions,
  productMedia,
  Product,
  NewProduct,
  ProductVariant,
  NewProductVariant,
  Category,
  NewCategory,
  Collection,
  NewCollection,
  Inventory,
  InventoryTransaction,
  ProductMedia,
  NewProductMedia,
} from "@/infrastructure/database/schema";

export class CatalogRepository {
  constructor(private db: Database) {}

  // ---------------------------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------------------------
  async createProduct(data: NewProduct, categoryIds?: string[]): Promise<Product> {
    const [inserted] = await this.db.insert(products).values(data).returning();

    if (categoryIds && categoryIds.length > 0) {
      const categoryRows = categoryIds.map((catId) => ({
        productId: inserted.id,
        categoryId: catId,
        createdAt: new Date(),
      }));
      await this.db.insert(productCategories).values(categoryRows);
    }

    return inserted;
  }

  async findProductById(id: string): Promise<Product | null> {
    const [prod] = await this.db.select().from(products).where(eq(products.id, id));
    return prod || null;
  }

  async findProductBySlug(slug: string): Promise<Product | null> {
    const [prod] = await this.db.select().from(products).where(eq(products.slug, slug));
    return prod || null;
  }

  async listProducts(filters?: {
    brandId?: string;
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    categoryId?: string;
  }): Promise<Product[]> {
    const conditions = [];

    if (filters?.brandId) {
      conditions.push(eq(products.brandId, filters.brandId));
    }
    if (filters?.status) {
      conditions.push(eq(products.status, filters.status));
    }

    if (filters?.categoryId) {
      const prodCatRows = await this.db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(eq(productCategories.categoryId, filters.categoryId));

      const productIds = prodCatRows.map((r) => r.productId);
      if (productIds.length === 0) return [];

      conditions.push(inArray(products.id, productIds));
    }

    if (conditions.length > 0) {
      return this.db.select().from(products).where(and(...conditions));
    }

    return this.db.select().from(products);
  }

  async updateProduct(id: string, data: Partial<NewProduct>, categoryIds?: string[]): Promise<Product> {
    const [updated] = await this.db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (categoryIds !== undefined) {
      await this.db.delete(productCategories).where(eq(productCategories.productId, id));
      if (categoryIds.length > 0) {
        const categoryRows = categoryIds.map((catId) => ({
          productId: id,
          categoryId: catId,
          createdAt: new Date(),
        }));
        await this.db.insert(productCategories).values(categoryRows);
      }
    }

    return updated;
  }

  async archiveProduct(id: string): Promise<Product> {
    const [archived] = await this.db
      .update(products)
      .set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return archived;
  }

  // ---------------------------------------------------------------------------
  // PRODUCT VARIANTS
  // ---------------------------------------------------------------------------
  async createVariant(data: NewProductVariant, initialQuantity: number = 0): Promise<ProductVariant> {
    const [variant] = await this.db.insert(productVariants).values(data).returning();

    // Create initial inventory row
    await this.db.insert(inventory).values({
      id: `inv_${variant.id}`,
      variantId: variant.id,
      quantity: Math.max(0, initialQuantity),
      reservedQuantity: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (initialQuantity > 0) {
      await this.db.insert(inventoryTransactions).values({
        id: `invtx_${crypto.randomUUID()}`,
        variantId: variant.id,
        type: "STOCK_RECEIVED",
        quantityChange: initialQuantity,
        previousQuantity: 0,
        newQuantity: initialQuantity,
        reason: "Initial variant creation",
        createdAt: new Date(),
      });
    }

    return variant;
  }

  async findVariantById(id: string): Promise<ProductVariant | null> {
    const [varRow] = await this.db.select().from(productVariants).where(eq(productVariants.id, id));
    return varRow || null;
  }

  async findVariantBySku(sku: string): Promise<ProductVariant | null> {
    const [varRow] = await this.db.select().from(productVariants).where(eq(productVariants.sku, sku));
    return varRow || null;
  }

  async listVariantsByProduct(productId: string): Promise<ProductVariant[]> {
    return this.db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }

  async updateVariant(id: string, data: Partial<NewProductVariant>): Promise<ProductVariant> {
    const [updated] = await this.db
      .update(productVariants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productVariants.id, id))
      .returning();
    return updated;
  }

  async archiveVariant(id: string): Promise<ProductVariant> {
    const [archived] = await this.db
      .update(productVariants)
      .set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(productVariants.id, id))
      .returning();
    return archived;
  }

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------
  async createCategory(data: NewCategory): Promise<Category> {
    const [cat] = await this.db.insert(categories).values(data).returning();
    return cat;
  }

  async findCategoryById(id: string): Promise<Category | null> {
    const [cat] = await this.db.select().from(categories).where(eq(categories.id, id));
    return cat || null;
  }

  async findCategoryBySlug(slug: string): Promise<Category | null> {
    const [cat] = await this.db.select().from(categories).where(eq(categories.slug, slug));
    return cat || null;
  }

  async listCategories(filters?: { brandId?: string; parentId?: string | null }): Promise<Category[]> {
    const conditions = [];

    if (filters?.brandId) {
      conditions.push(eq(categories.brandId, filters.brandId));
    }
    if (filters?.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(sql`${categories.parentId} IS NULL`);
      } else {
        conditions.push(eq(categories.parentId, filters.parentId));
      }
    }

    if (conditions.length > 0) {
      return this.db.select().from(categories).where(and(...conditions));
    }

    return this.db.select().from(categories);
  }

  async updateCategory(id: string, data: Partial<NewCategory>): Promise<Category> {
    const [updated] = await this.db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async archiveCategory(id: string): Promise<Category> {
    const [archived] = await this.db
      .update(categories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return archived;
  }

  async getProductCategories(productId: string): Promise<Category[]> {
    const rows = await this.db
      .select({ category: categories })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(eq(productCategories.productId, productId));

    return rows.map((r) => r.category);
  }

  // ---------------------------------------------------------------------------
  // COLLECTIONS
  // ---------------------------------------------------------------------------
  async createCollection(data: NewCollection): Promise<Collection> {
    const [coll] = await this.db.insert(collections).values(data).returning();
    return coll;
  }

  async findCollectionById(id: string): Promise<Collection | null> {
    const [coll] = await this.db.select().from(collections).where(eq(collections.id, id));
    return coll || null;
  }

  async findCollectionBySlug(slug: string): Promise<Collection | null> {
    const [coll] = await this.db.select().from(collections).where(eq(collections.slug, slug));
    return coll || null;
  }

  async listCollections(filters?: { brandId?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED" }): Promise<Collection[]> {
    const conditions = [];

    if (filters?.brandId) {
      conditions.push(eq(collections.brandId, filters.brandId));
    }
    if (filters?.status) {
      conditions.push(eq(collections.status, filters.status));
    }

    if (conditions.length > 0) {
      return this.db.select().from(collections).where(and(...conditions));
    }

    return this.db.select().from(collections);
  }

  async updateCollection(id: string, data: Partial<NewCollection>): Promise<Collection> {
    const [updated] = await this.db
      .update(collections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    return updated;
  }

  async archiveCollection(id: string): Promise<Collection> {
    const [archived] = await this.db
      .update(collections)
      .set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    return archived;
  }

  async addProductToCollection(collectionId: string, productId: string, position?: number): Promise<void> {
    let pos = position;
    if (pos === undefined) {
      const existing = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(collectionProducts)
        .where(eq(collectionProducts.collectionId, collectionId));
      pos = existing[0]?.count ?? 0;
    }

    await this.db
      .insert(collectionProducts)
      .values({
        collectionId,
        productId,
        position: pos,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  async removeProductFromCollection(collectionId: string, productId: string): Promise<void> {
    await this.db
      .delete(collectionProducts)
      .where(and(eq(collectionProducts.collectionId, collectionId), eq(collectionProducts.productId, productId)));
  }

  async reorderCollectionProducts(collectionId: string, productOrdering: { productId: string; position: number }[]): Promise<void> {
    for (const item of productOrdering) {
      await this.db
        .update(collectionProducts)
        .set({ position: item.position })
        .where(and(eq(collectionProducts.collectionId, collectionId), eq(collectionProducts.productId, item.productId)));
    }
  }

  async listCollectionProducts(collectionId: string): Promise<{ product: Product; position: number }[]> {
    const rows = await this.db
      .select({ product: products, position: collectionProducts.position })
      .from(collectionProducts)
      .innerJoin(products, eq(collectionProducts.productId, products.id))
      .where(eq(collectionProducts.collectionId, collectionId))
      .orderBy(asc(collectionProducts.position));

    return rows;
  }

  // ---------------------------------------------------------------------------
  // INVENTORY
  // ---------------------------------------------------------------------------
  async getVariantInventory(variantId: string): Promise<Inventory | null> {
    const [inv] = await this.db.select().from(inventory).where(eq(inventory.variantId, variantId));
    return inv || null;
  }

  async adjustInventory(
    variantId: string,
    quantityChange: number,
    type: "STOCK_RECEIVED" | "MANUAL_ADJUSTMENT" | "RESERVATION" | "RELEASE" | "SALE" | "RETURN" | "CORRECTION",
    reason?: string,
    actorUserId?: string
  ): Promise<Inventory> {
    const currentInv = await this.getVariantInventory(variantId);
    const previousQuantity = currentInv ? currentInv.quantity : 0;
    const reservedQuantity = currentInv ? currentInv.reservedQuantity : 0;

    let newQuantity = previousQuantity;
    let newReserved = reservedQuantity;

    if (type === "RESERVATION") {
      newReserved = reservedQuantity + quantityChange;
    } else if (type === "RELEASE") {
      newReserved = Math.max(0, reservedQuantity - quantityChange);
    } else {
      newQuantity = previousQuantity + quantityChange;
    }

    if (newQuantity < 0) {
      throw new Error("Inventory quantity cannot be negative");
    }
    if (newQuantity - newReserved < 0) {
      throw new Error("Available inventory (quantity - reservedQuantity) cannot be negative");
    }

    let updatedInv: Inventory;
    if (!currentInv) {
      const [inserted] = await this.db
        .insert(inventory)
        .values({
          id: `inv_${variantId}`,
          variantId,
          quantity: newQuantity,
          reservedQuantity: newReserved,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      updatedInv = inserted;
    } else {
      const [updated] = await this.db
        .update(inventory)
        .set({
          quantity: newQuantity,
          reservedQuantity: newReserved,
          updatedAt: new Date(),
        })
        .where(eq(inventory.variantId, variantId))
        .returning();
      updatedInv = updated;
    }

    // Record inventory transaction
    await this.db.insert(inventoryTransactions).values({
      id: `invtx_${crypto.randomUUID()}`,
      variantId,
      type,
      quantityChange,
      previousQuantity,
      newQuantity,
      reason,
      actorUserId,
      createdAt: new Date(),
    });

    return updatedInv;
  }

  async listInventoryTransactions(variantId: string): Promise<InventoryTransaction[]> {
    return this.db.select().from(inventoryTransactions).where(eq(inventoryTransactions.variantId, variantId));
  }

  // ---------------------------------------------------------------------------
  // MEDIA
  // ---------------------------------------------------------------------------
  async createMedia(data: NewProductMedia): Promise<ProductMedia> {
    const [mediaRow] = await this.db.insert(productMedia).values(data).returning();
    return mediaRow;
  }

  async findMediaById(id: string): Promise<ProductMedia | null> {
    const [row] = await this.db.select().from(productMedia).where(eq(productMedia.id, id));
    return row || null;
  }

  async listMediaByProduct(productId: string): Promise<ProductMedia[]> {
    return this.db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.position));
  }

  async listMediaByVariant(variantId: string): Promise<ProductMedia[]> {
    return this.db
      .select()
      .from(productMedia)
      .where(eq(productMedia.variantId, variantId))
      .orderBy(asc(productMedia.position));
  }

  async updateMedia(id: string, data: Partial<NewProductMedia>): Promise<ProductMedia> {
    const [updated] = await this.db
      .update(productMedia)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productMedia.id, id))
      .returning();
    return updated;
  }

  async deleteMedia(id: string): Promise<void> {
    await this.db.delete(productMedia).where(eq(productMedia.id, id));
  }

  async reorderMedia(productId: string, mediaOrdering: { mediaId: string; position: number }[]): Promise<void> {
    for (const item of mediaOrdering) {
      await this.db
        .update(productMedia)
        .set({ position: item.position })
        .where(and(eq(productMedia.id, item.mediaId), eq(productMedia.productId, productId)));
    }
  }
}
