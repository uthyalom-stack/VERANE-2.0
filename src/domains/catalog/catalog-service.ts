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
  CreateCollectionSchema,
  CreateCollectionInput,
  AdjustInventorySchema,
  AdjustInventoryInput,
  CreateMediaSchema,
  CreateMediaInput,
} from "./types";
import { Product, ProductVariant, Category, Collection, Inventory, ProductMedia } from "@/infrastructure/database/schema";

export class CatalogService {
  constructor(
    private catalogRepo: CatalogRepository,
    private authService: AuthorizationService,
    private auditService?: AuditService
  ) {}

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
        metadata: { name: product.name, slug: product.slug },
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
      const hasAccess = await this.authService.hasBrandAccess(userAuth, product.brandId);
      if (!hasAccess) {
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
      const hasAccess = await this.authService.hasBrandAccess(userAuth, product.brandId);
      if (!hasAccess) {
        throw new ForbiddenError("Not authorized to view products for this brand");
      }
    }

    return product;
  }

  async listProducts(
    userAuth: AuthenticatedUser | null,
    filters?: { brandId?: string; status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; categoryId?: string }
  ): Promise<Product[]> {
    if (filters?.brandId && userAuth && userAuth.adminProfile) {
      const hasAccess = await this.authService.hasBrandAccess(userAuth, filters.brandId);
      if (!hasAccess) {
        throw new ForbiddenError("Not authorized to list products for this brand");
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

    return variant;
  }

  async listVariantsByProduct(userAuth: AuthenticatedUser | null, productId: string): Promise<ProductVariant[]> {
    const parentProduct = await this.catalogRepo.findProductById(productId);
    if (!parentProduct) {
      throw new NotFoundError("Parent product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasAccess = await this.authService.hasBrandAccess(userAuth, parentProduct.brandId);
      if (!hasAccess) {
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

    return this.catalogRepo.updateVariant(id, validated);
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

    return this.catalogRepo.archiveVariant(id);
  }

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------
  async createCategory(userAuth: AuthenticatedUser, input: CreateCategoryInput): Promise<Category> {
    const validated = CreateCategorySchema.parse(input);

    if (validated.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.CATEGORIES_CREATE,
        validated.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create categories for this brand");
      }
    } else {
      const hasPerm = await this.authService.hasPermission(userAuth, PERMISSIONS.CATEGORIES_CREATE);
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create global categories");
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

    return category;
  }

  async listCategories(
    userAuth: AuthenticatedUser | null,
    filters?: { brandId?: string; parentId?: string | null }
  ): Promise<Category[]> {
    if (filters?.brandId && userAuth && userAuth.adminProfile) {
      const hasAccess = await this.authService.hasBrandAccess(userAuth, filters.brandId);
      if (!hasAccess) {
        throw new ForbiddenError("Not authorized to view categories for this brand");
      }
    }

    return this.catalogRepo.listCategories(filters);
  }

  // ---------------------------------------------------------------------------
  // COLLECTIONS
  // ---------------------------------------------------------------------------
  async createCollection(userAuth: AuthenticatedUser, input: CreateCollectionInput): Promise<Collection> {
    const validated = CreateCollectionSchema.parse(input);

    if (validated.brandId) {
      const hasPerm = await this.authService.hasBrandPermission(
        userAuth,
        PERMISSIONS.COLLECTIONS_CREATE,
        validated.brandId
      );
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create collections for this brand");
      }
    } else {
      const hasPerm = await this.authService.hasPermission(userAuth, PERMISSIONS.COLLECTIONS_CREATE);
      if (!hasPerm) {
        throw new ForbiddenError("Not authorized to create global collections");
      }
    }

    const existingSlug = await this.catalogRepo.findCollectionBySlug(validated.slug);
    if (existingSlug) {
      throw new ValidationError(`Collection slug '${validated.slug}' already exists`);
    }

    return this.catalogRepo.createCollection({
      id: `coll_${crypto.randomUUID()}`,
      brandId: validated.brandId,
      name: validated.name,
      slug: validated.slug,
      description: validated.description,
      status: validated.status ?? "DRAFT",
      isFeatured: validated.isFeatured ?? false,
    });
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
    }

    await this.catalogRepo.addProductToCollection(collectionId, productId, position);
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
    }

    await this.catalogRepo.reorderCollectionProducts(collectionId, ordering);
  }

  // ---------------------------------------------------------------------------
  // INVENTORY
  // ---------------------------------------------------------------------------
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

    return media;
  }

  async listMediaByProduct(userAuth: AuthenticatedUser | null, productId: string): Promise<ProductMedia[]> {
    const product = await this.catalogRepo.findProductById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (userAuth && userAuth.adminProfile) {
      const hasAccess = await this.authService.hasBrandAccess(userAuth, product.brandId);
      if (!hasAccess) {
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
      const hasAccess = await this.authService.hasBrandAccess(userAuth, product.brandId);
      if (!hasAccess) {
        throw new ForbiddenError("Not authorized to list media for this brand");
      }
    }

    return this.catalogRepo.listMediaByVariant(variantId);
  }
}
