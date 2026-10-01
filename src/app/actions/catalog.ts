"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { db } from "@/infrastructure/database/client";
import { CatalogRepository } from "@/domains/catalog/catalog-repository";
import { CatalogService } from "@/domains/catalog/catalog-service";
import { RbacRepository } from "@/domains/rbac/rbac-repository";
import { BrandRepository } from "@/domains/brands/brand-repository";
import { AuthorizationService } from "@/domains/identity/authorization-service";
import { AuditService } from "@/domains/audit/audit-service";
import {
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateCollectionInput,
  UpdateCollectionInput,
  AdjustInventoryInput,
  CreateMediaInput,
  UpdateMediaInput,
} from "@/domains/catalog/types";

function getCatalogService() {
  const catalogRepo = new CatalogRepository(db);
  const rbacRepo = new RbacRepository(db);
  const brandRepo = new BrandRepository(db);

  const authService = new AuthorizationService(rbacRepo, brandRepo);
  const auditService = new AuditService(db);

  return new CatalogService(catalogRepo, authService, auditService);
}

// -----------------------------------------------------------------------------
// PRODUCTS
// -----------------------------------------------------------------------------
export async function createProductAction(input: CreateProductInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const product = await catalogService.createProduct(authUser, input);

  revalidatePath("/admin/products");
  return { success: true, product };
}

export async function updateProductAction(id: string, input: UpdateProductInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const product = await catalogService.updateProduct(authUser, id, input);

  revalidatePath("/admin/products");
  return { success: true, product };
}

export async function archiveProductAction(id: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const product = await catalogService.archiveProduct(authUser, id);

  revalidatePath("/admin/products");
  return { success: true, product };
}

// -----------------------------------------------------------------------------
// VARIANTS
// -----------------------------------------------------------------------------
export async function createVariantAction(input: CreateVariantInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const variant = await catalogService.createVariant(authUser, input);

  revalidatePath("/admin/products");
  return { success: true, variant };
}

export async function updateVariantAction(id: string, input: UpdateVariantInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const variant = await catalogService.updateVariant(authUser, id, input);

  revalidatePath("/admin/products");
  return { success: true, variant };
}

export async function archiveVariantAction(id: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const variant = await catalogService.archiveVariant(authUser, id);

  revalidatePath("/admin/products");
  return { success: true, variant };
}

// -----------------------------------------------------------------------------
// CATEGORIES
// -----------------------------------------------------------------------------
export async function createCategoryAction(input: CreateCategoryInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const category = await catalogService.createCategory(authUser, input);

  revalidatePath("/admin/categories");
  return { success: true, category };
}

export async function updateCategoryAction(id: string, input: UpdateCategoryInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const category = await catalogService.updateCategory(authUser, id, input);

  revalidatePath("/admin/categories");
  return { success: true, category };
}

export async function archiveCategoryAction(id: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const category = await catalogService.archiveCategory(authUser, id);

  revalidatePath("/admin/categories");
  return { success: true, category };
}

// -----------------------------------------------------------------------------
// COLLECTIONS
// -----------------------------------------------------------------------------
export async function createCollectionAction(input: CreateCollectionInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const collection = await catalogService.createCollection(authUser, input);

  revalidatePath("/admin/collections");
  return { success: true, collection };
}

export async function updateCollectionAction(id: string, input: UpdateCollectionInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const collection = await catalogService.updateCollection(authUser, id, input);

  revalidatePath("/admin/collections");
  return { success: true, collection };
}

export async function archiveCollectionAction(id: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const collection = await catalogService.archiveCollection(authUser, id);

  revalidatePath("/admin/collections");
  return { success: true, collection };
}

export async function addProductToCollectionAction(collectionId: string, productId: string, position?: number) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  await catalogService.addProductToCollection(authUser, collectionId, productId, position);

  revalidatePath("/admin/collections");
  return { success: true };
}

export async function removeProductFromCollectionAction(collectionId: string, productId: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  await catalogService.removeProductFromCollection(authUser, collectionId, productId);

  revalidatePath("/admin/collections");
  return { success: true };
}

export async function reorderCollectionProductsAction(
  collectionId: string,
  ordering: { productId: string; position: number }[]
) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  await catalogService.reorderCollectionProducts(authUser, collectionId, ordering);

  revalidatePath("/admin/collections");
  return { success: true };
}

// -----------------------------------------------------------------------------
// INVENTORY
// -----------------------------------------------------------------------------
export async function adjustInventoryAction(input: AdjustInventoryInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const inventory = await catalogService.adjustInventory(authUser, input);

  revalidatePath("/admin/inventory");
  return { success: true, inventory };
}

// -----------------------------------------------------------------------------
// MEDIA
// -----------------------------------------------------------------------------
export async function createMediaAction(input: CreateMediaInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const media = await catalogService.createMedia(authUser, input);

  revalidatePath("/admin/products");
  return { success: true, media };
}

export async function updateMediaAction(id: string, input: UpdateMediaInput) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  const media = await catalogService.updateMedia(authUser, id, input);

  revalidatePath("/admin/products");
  return { success: true, media };
}

export async function deleteMediaAction(id: string) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  await catalogService.deleteMedia(authUser, id);

  revalidatePath("/admin/products");
  return { success: true };
}

export async function reorderMediaAction(productId: string, ordering: { mediaId: string; position: number }[]) {
  const authUser = await getCurrentUser();
  if (!authUser) throw new Error("Unauthorized");

  const catalogService = getCatalogService();
  await catalogService.reorderMedia(authUser, productId, ordering);

  revalidatePath("/admin/products");
  return { success: true };
}
