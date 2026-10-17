import { CatalogRepository } from "./catalog-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { AuditService } from "@/domains/audit/audit-service";
import { AuthenticatedUser } from "@/domains/identity/types";
import { PERMISSIONS } from "@/domains/rbac/types";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  CreateProductSchema,
  CreateProductInput,
  UpdateProductSchema,
  UpdateProductInput,
  CreateVariantSchema,
  CreateVariantInput,
  UpdateVariantSchema,
  UpdateVariantInput,
  CreateCategorySchema,
  CreateCategoryInput,
  UpdateCategorySchema,
  UpdateCategoryInput,
  CreateCollectionSchema,
  CreateCollectionInput,
  UpdateCollectionSchema,
  UpdateCollectionInput,
  AdjustInventorySchema,
  AdjustInventoryInput,
  CreateMediaSchema,
  CreateMediaInput,
  UpdateMediaSchema,
  UpdateMediaInput,
} from "./types";
import { Product, ProductVariant, Category, Collection, Inventory, ProductMedia } from "@/infrastructure/database/schema";

export class CatalogService {
  constructor(
    private catalogRepo: CatalogRepository,
    private authService: AuthorizationService,
    private auditService?: AuditService
  ) {}

  /**
   * Internal helper to extract assigned brand IDs for an administrator user.
   * Returns string array of brand IDs, or null if SUPER_ADMIN (unrestricted).
   */
  private getAuthorizedBrandIds(userAuth: AuthenticatedUser | null): string[] | null {
    if (!userAuth || !userAuth.adminProfile) {
      return null;
    }
    if (this.authService.isSuperAdmin(userAuth)) {
      return null; // Unrestricted
    }

    const assignedBrandIds: string[] = [];
    userAuth.adminRoles?.forEach((role) => {
      if (role.brandId && !assignedBrandIds.includes(role.brandId)) {
        assignedBrandIds.push(role.brandId);
      }
    });

    return assignedBrandIds;
  }

  // ---------------------------------------------------------------------------
  // PRODUCTS
  // ---------------------------------------------------------------------------
  async createProduct(userAuth: AuthenticatedUser, input: CreateProductInput): Promise<Product> {
    const validated = CreateProductSchema.parse(input);

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_CREATE,
      validated.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to create products for this brand");
    }

    const existingSlug = await this.catalogRepo.findProductBySlug(validated.slug);
    if (existingSlug) {
      throw new ValidationError(`Product slug '${validated.slug}' already exists`);
    }

    // Validate category integrity: each category must belong to product's brand OR be global
    if (validated.categoryIds && validated.categoryIds.length > 0) {
      for (const catId of validated.categoryIds) {
        const cat = await this.catalogRepo.findCategoryById(catId);
        if (!cat) {
          throw new NotFoundError(`Category ID '${catId}' not found`);
        }
        if (cat.brandId && cat.brandId !== validated.brandId) {
          throw new ForbiddenError(`Category '${cat.name}' belongs to a different brand`);
        }
      }
    }

    const productId = `prod_${crypto.randomUUID()}`;
    const product = await this.catalogRepo.createProduct(
      {
        id: productId,
        brandId: validated.brandId,
        name: validated.name,
        slug: validated.slug,
        shortDescription: validated.shortDescription,
        fullDescription: validated.fullDescription,
        status: validated.status ?? "DRAFT",
        basePriceCents: validated.basePriceCents ?? 0,
        currency: validated.currency ?? "NGN",
        materials: validated.materials,
        careInfo: validated.careInfo,
        fitInfo: validated.fitInfo,
        sizingInfo: validated.sizingInfo,
        seoTitle: validated.seoTitle,
        seoDescription: validated.seoDescription,
      },
      validated.categoryIds
    );

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.product_create",
        entityType: "product",
        entityId: product.id,
        brandId: product.brandId,
        metadata: { name: product.name, slug: product.slug, basePriceCents: product.basePriceCents },
      });
    }

    return product;
  }

  async getProductById(userAuth: AuthenticatedUser | null, id: string): Promise<Product> {
    const product = await this.catalogRepo.findProductById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.PRODUCTS_READ,
        product.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to view products for this brand");
      }
    }

    return product;
  }

  async getProductBySlug(userAuth: AuthenticatedUser | null, slug: string): Promise<Product> {
    const product = await this.catalogRepo.findProductBySlug(slug);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.PRODUCTS_READ,
        product.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to view products for this brand");
      }
    }

    return product;
  }

  async listProducts(
    userAuth: AuthenticatedUser | null,
    filters?: { brandId?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; categoryId?: string }
  ): Promise<Product[]> {
    if (userAuth && userAuth.adminProfile) {
      const authorizedBrandIds = this.getAuthorizedBrandIds(userAuth);

      if (authorizedBrandIds !== null) {
        if (filters?.brandId) {
          const hasPerm = await this.authService.hasBrandPermission(
            userAuth,
            PERMISSIONS.PRODUCTS_READ,
            filters.brandId
          );
          if (!hasPerm) {
            throw new ForbiddenError("Not authorized to list products for this brand");
          }
          return this.catalogRepo.listProducts({ ...filters, brandId: filters.brandId });
        }

        // Verify products.read permission for assigned brands
        const readableBrandIds: string[] = [];
        for (const bId of authorizedBrandIds) {
          const hasPerm = await this.authService.hasBrandPermission(userAuth, PERMISSIONS.PRODUCTS_READ, bId);
          if (hasPerm) readableBrandIds.push(bId);
        }
        if (readableBrandIds.length === 0) {
          throw new ForbiddenError("Not authorized to read products");
        }
        return this.catalogRepo.listProducts({ ...filters, brandId: readableBrandIds });
      }
    }

    return this.catalogRepo.listProducts(filters);
  }

  async updateProduct(userAuth: AuthenticatedUser, id: string, input: UpdateProductInput): Promise<Product> {
    const validated = UpdateProductSchema.parse(input);

    const existing = await this.catalogRepo.findProductById(id);
    if (!existing) {
      throw new NotFoundError("Product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_UPDATE,
      existing.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to update products for this brand");
    }

    if (validated.slug && validated.slug !== existing.slug) {
      const slugCheck = await this.catalogRepo.findProductBySlug(validated.slug);
      if (slugCheck) {
        throw new ValidationError(`Product slug '${validated.slug}' already exists`);
      }
    }

    if (validated.categoryIds && validated.categoryIds.length > 0) {
      for (const catId of validated.categoryIds) {
        const cat = await this.catalogRepo.findCategoryById(catId);
        if (!cat) {
          throw new NotFoundError(`Category ID '${catId}' not found`);
        }
        if (cat.brandId && cat.brandId !== existing.brandId) {
          throw new ForbiddenError(`Category '${cat.name}' belongs to a different brand`);
        }
      }
    }

    const { categoryIds, ...updateFields } = validated;
    const updated = await this.catalogRepo.updateProduct(id, updateFields, categoryIds);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.product_update",
        entityType: "product",
        entityId: updated.id,
        brandId: updated.brandId,
        metadata: { updatedFields: Object.keys(input) },
      });
    }

    return updated;
  }

  async archiveProduct(userAuth: AuthenticatedUser, id: string): Promise<Product> {
    const existing = await this.catalogRepo.findProductById(id);
    if (!existing) {
      throw new NotFoundError("Product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_ARCHIVE,
      existing.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to archive products for this brand");
    }

    const archived = await this.catalogRepo.archiveProduct(id);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.product_archive",
        entityType: "product",
        entityId: archived.id,
        brandId: archived.brandId,
      });
    }

    return archived;
  }

  // ---------------------------------------------------------------------------
  // VARIANTS
  // ---------------------------------------------------------------------------
  async createVariant(userAuth: AuthenticatedUser, input: CreateVariantInput): Promise<ProductVariant> {
    const validated = CreateVariantSchema.parse(input);

    const parentProduct = await this.catalogRepo.findProductById(validated.productId);
    if (!parentProduct) {
      throw new NotFoundError("Parent product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_UPDATE,
      parentProduct.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to manage variants for this product");
    }

    const existingSku = await this.catalogRepo.findVariantBySku(validated.sku);
    if (existingSku) {
      throw new ValidationError(`Variant SKU '${validated.sku}' already exists`);
    }

    const variantId = `var_${crypto.randomUUID()}`;
    const variant = await this.catalogRepo.createVariant(
      {
        id: variantId,
        productId: validated.productId,
        sku: validated.sku,
        size: validated.size,
        color: validated.color,
        colorCode: validated.colorCode,
        priceOverrideCents: validated.priceOverrideCents,
        currency: validated.currency ?? "NGN",
        barcode: validated.barcode,
        weightGrams: validated.weightGrams,
        dimensions: validated.dimensions,
        status: validated.status ?? "ACTIVE",
      },
      validated.initialQuantity ?? 0
    );

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.variant_create",
        entityType: "variant",
        entityId: variant.id,
        brandId: parentProduct.brandId,
        metadata: { sku: variant.sku, productId: parentProduct.id },
      });
    }

    return variant;
  }

  async listVariantsByProduct(userAuth: AuthenticatedUser | null, productId: string): Promise<ProductVariant[]> {
    const parentProduct = await this.catalogRepo.findProductById(productId);
    if (!parentProduct) {
      throw new NotFoundError("Parent product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.PRODUCTS_READ,
        parentProduct.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to list variants for this brand");
      }
    }

    return this.catalogRepo.listVariantsByProduct(productId);
  }

  async updateVariant(userAuth: AuthenticatedUser, id: string, input: UpdateVariantInput): Promise<ProductVariant> {
    const validated = UpdateVariantSchema.parse(input);

    const existingVariant = await this.catalogRepo.findVariantById(id);
    if (!existingVariant) {
      throw new NotFoundError("Variant not found");
    }

    const parentProduct = await this.catalogRepo.findProductById(existingVariant.productId);
    if (!parentProduct) {
      throw new NotFoundError("Parent product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_UPDATE,
      parentProduct.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to update variants for this brand");
    }

    if (validated.sku && validated.sku !== existingVariant.sku) {
      const skuCheck = await this.catalogRepo.findVariantBySku(validated.sku);
      if (skuCheck) {
        throw new ValidationError(`Variant SKU '${validated.sku}' already exists`);
      }
    }

    const updated = await this.catalogRepo.updateVariant(id, validated);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.variant_update",
        entityType: "variant",
        entityId: updated.id,
        brandId: parentProduct.brandId,
        metadata: { updatedFields: Object.keys(input) },
      });
    }

    return updated;
  }

  async archiveVariant(userAuth: AuthenticatedUser, id: string): Promise<ProductVariant> {
    const existingVariant = await this.catalogRepo.findVariantById(id);
    if (!existingVariant) {
      throw new NotFoundError("Variant not found");
    }

    const parentProduct = await this.catalogRepo.findProductById(existingVariant.productId);
    if (!parentProduct) {
      throw new NotFoundError("Parent product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.PRODUCTS_ARCHIVE,
      parentProduct.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to archive variants for this brand");
    }

    const archived = await this.catalogRepo.archiveVariant(id);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.variant_archive",
        entityType: "variant",
        entityId: archived.id,
        brandId: parentProduct.brandId,
      });
    }

    return archived;
  }

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------
  async createCategory(userAuth: AuthenticatedUser, input: CreateCategoryInput): Promise<Category> {
    const validated = CreateCategorySchema.parse(input);

    const isSuper = this.authService.isSuperAdmin(userAuth);

    if (!validated.brandId) {
      if (!isSuper) {
        throw new ForbiddenError("Brand administrators cannot create global categories");
      }
    } else {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.CATEGORIES_CREATE,
        validated.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create categories for this brand");
      }
    }

    const existingSlug = await this.catalogRepo.findCategoryBySlug(validated.slug);
    if (existingSlug) {
      throw new ValidationError(`Category slug '${validated.slug}' already exists`);
    }

    if (validated.parentId) {
      const parent = await this.catalogRepo.findCategoryById(validated.parentId);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
      // Verify child category brand matches parent category brand (or parent is global)
      if (validated.brandId && parent.brandId && parent.brandId !== validated.brandId) {
        throw new ForbiddenError("Child category brand must match parent category brand");
      }
    }

    const category = await this.catalogRepo.createCategory({
      id: `cat_${crypto.randomUUID()}`,
      name: validated.name,
      slug: validated.slug,
      description: validated.description,
      parentId: validated.parentId,
      brandId: validated.brandId,
      isActive: validated.isActive ?? true,
    });

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.category_create",
        entityType: "category",
        entityId: category.id,
        brandId: category.brandId,
        metadata: { name: category.name, slug: category.slug },
      });
    }

    return category;
  }

  async listCategories(
    userAuth: AuthenticatedUser | null,
    filters?: { brandId?: string; parentId?: string | null }
  ): Promise<Category[]> {
    if (userAuth && userAuth.adminProfile) {
      const authorizedBrandIds = this.getAuthorizedBrandIds(userAuth);

      if (authorizedBrandIds !== null) {
        if (filters?.brandId) {
          const hasPerm = await this.authService.hasBrandPermission(
            userAuth,
            PERMISSIONS.CATEGORIES_READ,
            filters.brandId
          );
          if (!hasPerm) {
            throw new ForbiddenError("Not authorized to view categories for this brand");
          }
          return this.catalogRepo.listCategories({ ...filters, brandId: filters.brandId });
        }

        const readableBrandIds: string[] = [];
        for (const bId of authorizedBrandIds) {
          const hasPerm = await this.authService.hasBrandPermission(userAuth, PERMISSIONS.CATEGORIES_READ, bId);
          if (hasPerm) readableBrandIds.push(bId);
        }
        if (readableBrandIds.length === 0) {
          throw new ForbiddenError("Not authorized to read categories");
        }
        return this.catalogRepo.listCategories({ ...filters, brandId: readableBrandIds });
      }
    }

    return this.catalogRepo.listCategories(filters);
  }

  async updateCategory(userAuth: AuthenticatedUser, id: string, input: UpdateCategoryInput): Promise<Category> {
    const validated = UpdateCategorySchema.parse(input);

    const existing = await this.catalogRepo.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }

    if (existing.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.CATEGORIES_UPDATE,
        existing.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to update this category");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can update global categories");
      }
    }

    if (validated.parentId) {
      if (validated.parentId === id) {
        throw new ValidationError("Category cannot be its own parent");
      }
      const parent = await this.catalogRepo.findCategoryById(validated.parentId);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
      if (existing.brandId && parent.brandId && parent.brandId !== existing.brandId) {
        throw new ForbiddenError("Child category brand must match parent category brand");
      }
    }

    const updated = await this.catalogRepo.updateCategory(id, validated);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.category_update",
        entityType: "category",
        entityId: updated.id,
        brandId: updated.brandId,
        metadata: { updatedFields: Object.keys(input) },
      });
    }

    return updated;
  }

  async archiveCategory(userAuth: AuthenticatedUser, id: string): Promise<Category> {
    const existing = await this.catalogRepo.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }

    if (existing.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.CATEGORIES_ARCHIVE,
        existing.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to archive this category");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can archive global categories");
      }
    }

    const archived = await this.catalogRepo.archiveCategory(id);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.category_archive",
        entityType: "category",
        entityId: archived.id,
        brandId: archived.brandId,
      });
    }

    return archived;
  }

  // ---------------------------------------------------------------------------
  // COLLECTIONS
  // ---------------------------------------------------------------------------
  async createCollection(userAuth: AuthenticatedUser, input: CreateCollectionInput): Promise<Collection> {
    const validated = CreateCollectionSchema.parse(input);

    const isSuper = this.authService.isSuperAdmin(userAuth);

    if (!validated.brandId) {
      if (!isSuper) {
        throw new ForbiddenError("Brand administrators cannot create global collections");
      }
    } else {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_CREATE,
        validated.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create collections for this brand");
      }
    }

    const existingSlug = await this.catalogRepo.findCollectionBySlug(validated.slug);
    if (existingSlug) {
      throw new ValidationError(`Collection slug '${validated.slug}' already exists`);
    }

    const collection = await this.catalogRepo.createCollection({
      id: `coll_${crypto.randomUUID()}`,
      brandId: validated.brandId,
      name: validated.name,
      slug: validated.slug,
      description: validated.description,
      status: validated.status ?? "DRAFT",
      isFeatured: validated.isFeatured ?? false,
    });

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_create",
        entityType: "collection",
        entityId: collection.id,
        brandId: collection.brandId,
        metadata: { name: collection.name, slug: collection.slug },
      });
    }

    return collection;
  }

  async listCollections(
    userAuth: AuthenticatedUser | null,
    filters?: { brandId?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED" }
  ): Promise<Collection[]> {
    if (userAuth && userAuth.adminProfile) {
      const authorizedBrandIds = this.getAuthorizedBrandIds(userAuth);

      if (authorizedBrandIds !== null) {
        if (filters?.brandId) {
          const hasPerm = await this.authService.hasBrandPermission(
            userAuth,
            PERMISSIONS.COLLECTIONS_READ,
            filters.brandId
          );
          if (!hasPerm) {
            throw new ForbiddenError("Not authorized to view collections for this brand");
          }
          return this.catalogRepo.listCollections({ ...filters, brandId: filters.brandId });
        }

        const readableBrandIds: string[] = [];
        for (const bId of authorizedBrandIds) {
          const hasPerm = await this.authService.hasBrandPermission(userAuth, PERMISSIONS.COLLECTIONS_READ, bId);
          if (hasPerm) readableBrandIds.push(bId);
        }
        if (readableBrandIds.length === 0) {
          throw new ForbiddenError("Not authorized to read collections");
        }
        return this.catalogRepo.listCollections({ ...filters, brandId: readableBrandIds });
      }
    }

    return this.catalogRepo.listCollections(filters);
  }

  async updateCollection(userAuth: AuthenticatedUser, id: string, input: UpdateCollectionInput): Promise<Collection> {
    const validated = UpdateCollectionSchema.parse(input);

    const existing = await this.catalogRepo.findCollectionById(id);
    if (!existing) {
      throw new NotFoundError("Collection not found");
    }

    if (existing.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_UPDATE,
        existing.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to update this collection");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can update global collections");
      }
    }

    const updated = await this.catalogRepo.updateCollection(id, validated);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_update",
        entityType: "collection",
        entityId: updated.id,
        brandId: updated.brandId,
        metadata: { updatedFields: Object.keys(input) },
      });
    }

    return updated;
  }

  async archiveCollection(userAuth: AuthenticatedUser, id: string): Promise<Collection> {
    const existing = await this.catalogRepo.findCollectionById(id);
    if (!existing) {
      throw new NotFoundError("Collection not found");
    }

    if (existing.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_ARCHIVE,
        existing.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to archive this collection");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can archive global collections");
      }
    }

    const archived = await this.catalogRepo.archiveCollection(id);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_archive",
        entityType: "collection",
        entityId: archived.id,
        brandId: archived.brandId,
      });
    }

    return archived;
  }

  async addProductToCollection(
    userAuth: AuthenticatedUser,
    collectionId: string,
    productId: string,
    position?: number
  ): Promise<void> {
    const collection = await this.catalogRepo.findCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundError("Collection not found");
    }

    const product = await this.catalogRepo.findProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (collection.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_UPDATE,
        collection.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to update this collection");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can add products to global collections");
      }
    }

    // Cross-brand collection membership check: collection & product must match brand if collection is brand-scoped
    if (collection.brandId && collection.brandId !== product.brandId) {
      throw new ForbiddenError("Product and collection belong to different brands");
    }

    await this.catalogRepo.addProductToCollection(collectionId, productId, position);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_product_add",
        entityType: "collection",
        entityId: collectionId,
        brandId: collection.brandId ?? product.brandId,
        metadata: { productId, position },
      });
    }
  }

  async removeProductFromCollection(
    userAuth: AuthenticatedUser,
    collectionId: string,
    productId: string
  ): Promise<void> {
    const collection = await this.catalogRepo.findCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundError("Collection not found");
    }

    if (collection.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_UPDATE,
        collection.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to update this collection");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can update global collections");
      }
    }

    await this.catalogRepo.removeProductFromCollection(collectionId, productId);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_product_remove",
        entityType: "collection",
        entityId: collectionId,
        brandId: collection.brandId,
        metadata: { productId },
      });
    }
  }

  async reorderCollectionProducts(
    userAuth: AuthenticatedUser,
    collectionId: string,
    ordering: { productId: string; position: number }[]
  ): Promise<void> {
    const collection = await this.catalogRepo.findCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundError("Collection not found");
    }

    if (collection.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_UPDATE,
        collection.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to update this collection");
      }
    } else {
      if (!this.authService.isSuperAdmin(userAuth)) {
        throw new ForbiddenError("Only SUPER_ADMIN can update global collections");
      }
    }

    // Fetch current collection product memberships
    const existingCollectionProducts = await this.catalogRepo.listCollectionProducts(collectionId);
    const existingProductIds = new Set(existingCollectionProducts.map((item) => item.product.id));

    // Validate complete ordering BEFORE applying updates
    for (const item of ordering) {
      const prod = await this.catalogRepo.findProductById(item.productId);
      if (!prod) {
        throw new NotFoundError(`Product '${item.productId}' not found`);
      }
      if (!existingProductIds.has(item.productId)) {
        throw new ValidationError(`Product '${prod.name}' is not a member of collection '${collection.name}'`);
      }
      if (collection.brandId && prod.brandId !== collection.brandId) {
        throw new ForbiddenError(`Product '${prod.name}' belongs to a different brand than the collection`);
      }
    }

    await this.catalogRepo.reorderCollectionProducts(collectionId, ordering);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.collection_products_reorder",
        entityType: "collection",
        entityId: collectionId,
        brandId: collection.brandId,
        metadata: { orderingCount: ordering.length },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // INVENTORY
  // ---------------------------------------------------------------------------
  async listInventory(userAuth: AuthenticatedUser | null) {
    if (userAuth && userAuth.adminProfile) {
      const authorizedBrandIds = this.getAuthorizedBrandIds(userAuth);
      if (authorizedBrandIds !== null) {
        const readableBrandIds: string[] = [];
        for (const bId of authorizedBrandIds) {
          const hasPerm = await this.authService.hasBrandPermission(userAuth, PERMISSIONS.INVENTORY_READ, bId);
          if (hasPerm) readableBrandIds.push(bId);
        }
        if (readableBrandIds.length === 0) {
          throw new ForbiddenError("Not authorized to read inventory");
        }
        return this.catalogRepo.listInventoryWithVariants(readableBrandIds);
      }
    }

    return this.catalogRepo.listInventoryWithVariants();
  }

  async adjustInventory(userAuth: AuthenticatedUser, input: AdjustInventoryInput): Promise<Inventory> {
    const validated = AdjustInventorySchema.parse(input);

    const variant = await this.catalogRepo.findVariantById(validated.variantId);
    if (!variant) {
      throw new NotFoundError("Variant not found");
    }

    const product = await this.catalogRepo.findProductById(variant.productId);
    if (!product) {
      throw new NotFoundError("Parent product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.INVENTORY_ADJUST,
      product.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to adjust inventory for this brand");
    }

    const updatedInv = await this.catalogRepo.adjustInventory(
      validated.variantId,
      validated.quantityChange,
      validated.type,
      validated.reason,
      userAuth.user.id
    );

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "inventory.adjust",
        entityType: "inventory",
        entityId: updatedInv.id,
        brandId: product.brandId,
        metadata: {
          variantId: validated.variantId,
          type: validated.type,
          change: validated.quantityChange,
          newQuantity: updatedInv.quantity,
          reservedQuantity: updatedInv.reservedQuantity,
        },
      });
    }

    return updatedInv;
  }

  // ---------------------------------------------------------------------------
  // MEDIA
  // ---------------------------------------------------------------------------
  async createMedia(userAuth: AuthenticatedUser, input: CreateMediaInput): Promise<ProductMedia> {
    const validated = CreateMediaSchema.parse(input);

    const product = await this.catalogRepo.findProductById(validated.productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.MEDIA_CREATE,
      product.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to add media to this product");
    }

    if (validated.variantId) {
      const variant = await this.catalogRepo.findVariantById(validated.variantId);
      if (!variant || variant.productId !== product.id) {
        throw new ValidationError("Variant does not belong to this product");
      }
    }

    const media = await this.catalogRepo.createMedia({
      id: `med_${crypto.randomUUID()}`,
      productId: validated.productId,
      variantId: validated.variantId,
      mediaType: validated.mediaType,
      url: validated.url,
      altText: validated.altText,
      width: validated.width,
      height: validated.height,
      durationSeconds: validated.durationSeconds,
      posterUrl: validated.posterUrl,
      position: validated.position ?? 0,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
    });

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.media_create",
        entityType: "product_media",
        entityId: media.id,
        brandId: product.brandId,
        metadata: { productId: product.id, mediaType: media.mediaType, url: media.url },
      });
    }

    return media;
  }

  async updateMedia(userAuth: AuthenticatedUser, id: string, input: UpdateMediaInput): Promise<ProductMedia> {
    const validated = UpdateMediaSchema.parse(input);

    const existing = await this.catalogRepo.findMediaById(id);
    if (!existing) {
      throw new NotFoundError("Media record not found");
    }

    const product = await this.catalogRepo.findProductById(existing.productId);
    if (!product) {
      throw new NotFoundError("Associated product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.MEDIA_UPDATE,
      product.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to update media for this brand");
    }

    if (validated.variantId) {
      const variant = await this.catalogRepo.findVariantById(validated.variantId);
      if (!variant) {
        throw new NotFoundError("Target variant not found");
      }
      if (variant.productId !== existing.productId) {
        throw new ValidationError("Variant does not belong to the product associated with this media asset");
      }
    }

    const { metadata, ...restFields } = validated;
    const updatePayload: Partial<ProductMedia> = { ...restFields };
    if (metadata !== undefined) {
      updatePayload.metadata = metadata ? JSON.stringify(metadata) : null;
    }

    const updated = await this.catalogRepo.updateMedia(id, updatePayload);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.media_update",
        entityType: "product_media",
        entityId: updated.id,
        brandId: product.brandId,
        metadata: { updatedFields: Object.keys(input) },
      });
    }

    return updated;
  }

  async deleteMedia(userAuth: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.catalogRepo.findMediaById(id);
    if (!existing) {
      throw new NotFoundError("Media record not found");
    }

    const product = await this.catalogRepo.findProductById(existing.productId);
    if (!product) {
      throw new NotFoundError("Associated product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.MEDIA_DELETE,
      product.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to delete media for this brand");
    }

    await this.catalogRepo.deleteMedia(id);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.media_delete",
        entityType: "product_media",
        entityId: id,
        brandId: product.brandId,
      });
    }
  }

  async reorderMedia(
    userAuth: AuthenticatedUser,
    productId: string,
    ordering: { mediaId: string; position: number }[]
  ): Promise<void> {
    const product = await this.catalogRepo.findProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const hasPerm = await this.authService.hasBrandPermission(
      userAuth,
      PERMISSIONS.MEDIA_UPDATE,
      product.brandId
    );
    if (!hasPerm) {
      throw new ForbiddenError("Not authorized to update media for this brand");
    }

    await this.catalogRepo.reorderMedia(productId, ordering);

    if (this.auditService) {
      await this.auditService.log({
        actorUserId: userAuth.user.id,
        action: "catalog.media_reorder",
        entityType: "product_media",
        entityId: productId,
        brandId: product.brandId,
        metadata: { orderingCount: ordering.length },
      });
    }
  }

  async listMediaByProduct(userAuth: AuthenticatedUser | null, productId: string): Promise<ProductMedia[]> {
    const product = await this.catalogRepo.findProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.MEDIA_READ,
        product.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to list media for this brand");
      }
    }

    return this.catalogRepo.listMediaByProduct(productId);
  }

  async listMediaByVariant(userAuth: AuthenticatedUser | null, variantId: string): Promise<ProductMedia[]> {
    const variant = await this.catalogRepo.findVariantById(variantId);
    if (!variant) {
      throw new NotFoundError("Variant not found");
    }

    const product = await this.catalogRepo.findProductById(variant.productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.MEDIA_READ,
        product.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to list media for this brand");
      }
    }

    return this.catalogRepo.listMediaByVariant(variantId);
  }
}
