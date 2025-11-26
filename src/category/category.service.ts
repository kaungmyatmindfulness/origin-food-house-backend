import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import { CategoryResponseDto } from "src/category/dto/category-response.dto";
import { StandardErrorHandler } from "src/common/decorators/standard-error-handler.decorator";
import { calculateNextSortOrder } from "src/common/utils/sort-order.util";
import { Prisma, Category, Role } from "src/generated/prisma/client";

import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { SortCategoriesPayloadDto } from "./dto/sort-categories-payload.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * Type for Prisma transaction client
 * Used in transaction callbacks to ensure type safety
 */
type TransactionClient = Prisma.TransactionClient;

/**
 * Input type for seeding categories with translations
 */
export interface SeedCategoryInput {
  name: string;
  sortOrder: number;
  translations: Array<{ locale: string; name: string }>;
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  private readonly categoryWithItemsInclude = {
    menuItems: {
      where: { deletedAt: null }, // todo: also include is hidden if admin use
      orderBy: { sortOrder: "asc" },
      include: {
        customizationGroups: {
          include: {
            customizationOptions: {
              include: {
                translations: {
                  select: {
                    locale: true,
                    name: true,
                  },
                },
              },
            },
            translations: {
              select: {
                locale: true,
                name: true,
              },
            },
          },
        },
        translations: {
          select: {
            locale: true,
            name: true,
            description: true,
          },
        },
      },
    },
    translations: {
      select: {
        locale: true,
        name: true,
      },
    },
  } satisfies Prisma.CategoryInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Maps a Prisma Category result to CategoryResponseDto.
   * Handles type conversion for nested menuItems and Decimal values.
   */
  private mapToCategoryResponse(
    category: Category & {
      menuItems?: Array<{
        id: string;
        name: string;
        description: string | null;
        basePrice: Prisma.Decimal;
        imagePath: string | null;
        sortOrder: number;
      }>;
    },
  ): CategoryResponseDto {
    const response: CategoryResponseDto = {
      id: category.id,
      name: category.name,
      storeId: category.storeId,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      menuItems:
        category.menuItems && Array.isArray(category.menuItems)
          ? category.menuItems.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              basePrice: item.basePrice?.toString() ?? "0",
              imagePath: item.imagePath,
              sortOrder: item.sortOrder,
            }))
          : [],
    };
    return response;
  }

  /**
   * Creates a new category within the specified store. Requires Owner/Admin role.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the store.
   * @param dto DTO containing category name.
   * @returns The newly created Category.
   * @throws {ForbiddenException} If user lacks permission.
   * @throws {BadRequestException} For validation errors or conflicts.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  @StandardErrorHandler("create category")
  async create(
    userId: string,
    storeId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return await this.prisma.$transaction(async (tx) => {
      // Check if category with the same name already exists in this store
      const existingCategory = await tx.category.findFirst({
        where: { storeId, name: dto.name, deletedAt: null },
        select: { id: true },
      });
      if (existingCategory) {
        throw new BadRequestException(
          `Category name "${dto.name}" already exists in this store.`,
        );
      }

      // Calculate the new sort order using shared utility
      const newSortOrder = await calculateNextSortOrder(tx, "category", {
        storeId,
        deletedAt: null,
      });
      this.logger.verbose(
        `Calculated new sortOrder: ${newSortOrder} for category in Store ${storeId}.`,
      );

      const category = await tx.category.create({
        data: { name: dto.name, storeId, sortOrder: newSortOrder },
      });

      this.logger.log(
        `Category '${category.name}' (ID: ${category.id}) created successfully in Store ${storeId}.`,
      );
      return category;
    });
  }

  /**
   * Finds all active categories for a given store (identified by ID or slug), ordered by sortOrder.
   * Optionally includes active MenuItems ordered by their sortOrder.
   * @param identifier Object containing either storeId OR storeSlug.
   * @param includeItems Whether to include associated menu items.
   * @returns Array of categories, potentially with nested menu items payload.
   * @throws {NotFoundException} If store identified by slug/id doesn't exist.
   */
  async findAll(
    identifier: { storeId?: string; storeSlug?: string },
    includeItems = true,
  ): Promise<CategoryResponseDto[]> {
    const method = this.findAll.name;
    const { storeId, storeSlug } = identifier;

    if (!storeId && !storeSlug) {
      throw new BadRequestException(
        "Either storeId or storeSlug must be provided.",
      );
    }

    const identifierLog = storeId ? `ID ${storeId}` : `Slug ${storeSlug}`;
    this.logger.verbose(
      `[${method}] Finding active categories for Store [${identifierLog}], includeItems: ${includeItems}.`,
    );

    const whereClause: Prisma.CategoryWhereInput = {
      deletedAt: null,
    };

    if (storeId) {
      whereClause.storeId = storeId;
    } else if (storeSlug) {
      whereClause.store = { slug: storeSlug };
    }

    try {
      const storeExists = await this.prisma.store.count({
        where: storeId ? { id: storeId } : { slug: storeSlug! },
      });
      if (storeExists === 0) {
        throw new NotFoundException(
          `Store with ${storeId ? `ID ${storeId}` : `Slug ${storeSlug}`} not found.`,
        );
      }

      const includeClause = includeItems
        ? this.categoryWithItemsInclude
        : undefined;

      const categories = await this.prisma.category.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: { sortOrder: "asc" },
      });

      this.logger.verbose(
        `[${method}] Found ${categories.length} categories for Store [${identifierLog}].`,
      );
      return categories.map((category) => this.mapToCategoryResponse(category));
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `[${method}] Failed to find categories for Store [${identifierLog}].`,
        error,
      );
      throw new InternalServerErrorException("Could not retrieve categories.");
    }
  }

  /**
   * Finds a single category by ID, ensuring it belongs to the specified store.
   * @param categoryId The ID (UUID) of the category.
   * @param storeId The ID (UUID) of the store it should belong to.
   * @returns The found Category.
   * @throws {NotFoundException} If category not found or doesn't belong to the store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async findOne(categoryId: string, storeId: string): Promise<Category> {
    this.logger.verbose(
      `Finding category ID ${categoryId} within Store ${storeId}.`,
    );
    try {
      const category = await this.prisma.category.findFirstOrThrow({
        where: {
          id: categoryId,
          storeId,
          deletedAt: null,
        },
      });

      return category;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `Active category ID ${categoryId} not found in Store ${storeId}.`,
        );
        throw new NotFoundException(
          `Active category with ID ${categoryId} not found in your store.`,
        );
      }
      this.logger.error(
        `Failed to find category ID ${categoryId} in Store ${storeId}.`,
        error,
      );
      throw new InternalServerErrorException("Could not retrieve category.");
    }
  }

  /**
   * Updates a category's name. Requires Owner/Admin role.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the store.
   * @param categoryId The ID (UUID) of the category to update.
   * @param dto DTO containing the new name.
   * @returns The updated Category.
   * @throws {ForbiddenException} | {NotFoundException} | {InternalServerErrorException}
   */
  @StandardErrorHandler("update category")
  async update(
    userId: string,
    storeId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    this.logger.log(
      `User ${userId} attempting to update category ID ${categoryId} in Store ${storeId}.`,
    );
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return await this.prisma.$transaction(async (tx) => {
      // Verify category exists and belongs to store
      const existingCategory = await tx.category.findFirst({
        where: { id: categoryId, storeId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!existingCategory) {
        throw new NotFoundException(
          `Category with ID ${categoryId} not found in store ${storeId}.`,
        );
      }

      // Check for name conflicts if name is being updated
      if (dto.name) {
        const conflictingCategory = await tx.category.findFirst({
          where: {
            storeId,
            name: dto.name,
            id: { not: categoryId },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (conflictingCategory) {
          throw new BadRequestException(
            `Another active category with name "${dto.name}" already exists.`,
          );
        }
      }

      const updatedCategory = await tx.category.update({
        where: { id: categoryId },
        data: {
          name: dto.name,
        },
      });
      this.logger.log(`Category ID ${categoryId} updated successfully.`);
      return updatedCategory;
    });
  }

  /**
   * Deletes a category. Requires Owner/Admin role.
   * NOTE: Ensure Prisma schema relation from MenuItem to Category has appropriate `onDelete` behavior (e.g., Cascade, SetNull, Restrict).
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the store.
   * @param categoryId The ID (UUID) of the category to delete.
   * @returns Object containing the ID (UUID) of the deleted category.
   * @throws {ForbiddenException} | {NotFoundException} | {InternalServerErrorException}
   */
  @StandardErrorHandler("remove category")
  async remove(
    userId: string,
    storeId: string,
    categoryId: string,
  ): Promise<{ id: string }> {
    this.logger.log(
      `User ${userId} attempting to delete category ID ${categoryId} from Store ${storeId}.`,
    );
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return await this.prisma.$transaction(async (tx) => {
      // Verify category exists and belongs to store
      const existingCategory = await tx.category.findFirst({
        where: { id: categoryId, storeId, deletedAt: null },
        select: { id: true },
      });
      if (!existingCategory) {
        throw new NotFoundException(
          `Category with ID ${categoryId} not found in store ${storeId}.`,
        );
      }

      // Check for active menu items
      const menuItemCount = await tx.menuItem.count({
        where: {
          categoryId,
          deletedAt: null,
        },
      });

      if (menuItemCount > 0) {
        this.logger.warn(
          `Deletion blocked: Category ID ${categoryId} has ${menuItemCount} active menu item(s).`,
        );
        throw new BadRequestException(
          `Cannot delete category because it contains ${menuItemCount} active menu item(s). Please move or delete them first.`,
        );
      }

      this.logger.verbose(
        `Category ID ${categoryId} has no active menu items. Proceeding with soft delete.`,
      );

      await tx.category.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`Category ID ${categoryId} soft deleted successfully.`);
      return { id: categoryId };
    });
  }

  /**
   * Bulk updates sort orders for categories and their menu items within a store. Requires Owner/Admin role.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the store.
   * @param payload DTO containing the nested structure of categories and items with new sort orders.
   * @returns Success message.
   * @throws {ForbiddenException} | {BadRequestException} | {NotFoundException} | {InternalServerErrorException}
   */
  async sortCategoriesAndMenuItems(
    userId: string,
    storeId: string,
    payload: SortCategoriesPayloadDto,
  ): Promise<{ message: string }> {
    this.logger.log(
      `User ${userId} attempting to sort categories/items in Store ${storeId}.`,
    );
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      this.logger.verbose(
        `Prefetching valid category/item IDs for store ${storeId}`,
      );
      const validStoreEntities = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          categories: { select: { id: true } },
          menuItems: { select: { id: true } },
        },
      });

      if (!validStoreEntities) {
        this.logger.error(`Store ${storeId} not found during sort operation.`);
        throw new NotFoundException(`Store with ID ${storeId} not found.`);
      }

      const validCategoryIds = new Set(
        validStoreEntities.categories.map((c) => c.id),
      );
      const validMenuItemIds = new Set(
        validStoreEntities.menuItems.map((i) => i.id),
      );
      this.logger.verbose(
        `Found ${validCategoryIds.size} categories and ${validMenuItemIds.size} menu items for validation.`,
      );

      const updateOperations: Prisma.PrismaPromise<unknown>[] = [];

      for (const cat of payload.categories) {
        if (!validCategoryIds.has(cat.id)) {
          this.logger.error(
            `Sorting failed: Category ID ${cat.id} does not belong to Store ${storeId}. Payload invalid.`,
          );
          throw new BadRequestException(
            `Invalid payload: Category ID ${cat.id} does not belong to your store.`,
          );
        }

        updateOperations.push(
          this.prisma.category.update({
            where: { id: cat.id },
            data: { sortOrder: cat.sortOrder },
          }),
        );

        for (const item of cat.menuItems) {
          if (!validMenuItemIds.has(item.id)) {
            this.logger.error(
              `Sorting failed: Menu Item ID ${item.id} does not belong to Store ${storeId}. Payload invalid.`,
            );
            throw new BadRequestException(
              `Invalid payload: Menu Item ID ${item.id} does not belong to your store.`,
            );
          }

          updateOperations.push(
            this.prisma.menuItem.update({
              where: { id: item.id },
              data: { sortOrder: item.sortOrder },
            }),
          );
        }
      }

      if (updateOperations.length === 0) {
        this.logger.log(`No sort operations needed for Store ${storeId}.`);
        return { message: "No categories or items to reorder." };
      }

      this.logger.log(
        `Executing ${updateOperations.length} sort update operations for Store ${storeId} in a transaction.`,
      );

      await this.prisma.$transaction(updateOperations);

      this.logger.log(
        `Categories & menu items reordered successfully for Store ${storeId}.`,
      );
      return { message: "Categories & menu items reordered successfully." };
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to sort categories/items for Store ${storeId}.`,
        error,
      );
      throw new InternalServerErrorException(
        "Could not reorder categories and items.",
      );
    }
  }

  /**
   * ============================================================================
   * TRANSLATION MANAGEMENT METHODS
   * ============================================================================
   */

  /**
   * Updates or creates translations for a category in multiple locales.
   *
   * This operation uses upsert logic - it creates new translations or
   * updates existing ones based on the (categoryId, locale) composite key.
   * All updates are atomic within a database transaction.
   *
   * @param userId - Auth0 ID of the user making changes
   * @param storeId - Store UUID to verify access
   * @param categoryId - Category UUID to update
   * @param translations - Array of translations to upsert (locale and name)
   * @returns Promise that resolves when all translations are updated
   * @throws {ForbiddenException} If user lacks OWNER/ADMIN role
   * @throws {NotFoundException} If category not found in store
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async updateCategoryTranslations(
    userId: string,
    storeId: string,
    categoryId: string,
    translations: Array<{ locale: string; name: string }>,
  ): Promise<void> {
    const method = this.updateCategoryTranslations.name;
    this.logger.log(
      `[${method}] User ${userId} updating translations for category ${categoryId}`,
    );

    // Check permissions
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Verify category exists and belongs to store
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in store ${storeId}`,
      );
    }

    // Upsert translations
    await this.prisma.$transaction(async (tx) => {
      for (const translation of translations) {
        await tx.categoryTranslation.upsert({
          where: {
            categoryId_locale: {
              categoryId,
              locale: translation.locale,
            },
          },
          update: {
            name: translation.name,
          },
          create: {
            categoryId,
            locale: translation.locale,
            name: translation.name,
          },
        });
      }
    });

    this.logger.log(
      `[${method}] Updated ${translations.length} translations for category ${categoryId}`,
    );
  }

  /**
   * Deletes a specific translation for a category in a given locale.
   *
   * This operation removes the translation entry from the CategoryTranslation table.
   * The default category name remains unchanged - only the localized translation is removed.
   *
   * @param userId - Auth0 ID of the user making changes
   * @param storeId - Store UUID to verify access
   * @param categoryId - Category UUID to update
   * @param locale - Locale code to delete (en, zh, my, th)
   * @returns Promise that resolves when translation is deleted
   * @throws {ForbiddenException} If user lacks OWNER/ADMIN role
   * @throws {NotFoundException} If category not found in store
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async deleteCategoryTranslation(
    userId: string,
    storeId: string,
    categoryId: string,
    locale: string,
  ): Promise<void> {
    const method = this.deleteCategoryTranslation.name;
    this.logger.log(
      `[${method}] User ${userId} deleting ${locale} translation for category ${categoryId}`,
    );

    // Check permissions
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Verify category exists and belongs to store
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId, deletedAt: null },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in store ${storeId}`,
      );
    }

    // Delete translation
    await this.prisma.categoryTranslation.deleteMany({
      where: {
        categoryId,
        locale,
      },
    });

    this.logger.log(
      `[${method}] Deleted ${locale} translation for category ${categoryId}`,
    );
  }

  /**
   * ============================================================================
   * SEEDING METHODS (For Store Creation)
   * ============================================================================
   */

  /**
   * Creates default categories with translations for store seeding.
   * This method is designed to be called within an existing transaction.
   *
   * NOTE: This method bypasses RBAC as it's used for system-level seeding
   * during store creation, not user-initiated operations.
   *
   * @param tx - Prisma transaction client
   * @param storeId - Store UUID to create categories for
   * @param categories - Array of category data with translations
   * @returns Map of category name to category ID
   */
  async createBulkForSeeding(
    tx: TransactionClient,
    storeId: string,
    categories: SeedCategoryInput[],
  ): Promise<Map<string, string>> {
    const method = this.createBulkForSeeding.name;
    this.logger.log(
      `[${method}] Creating ${categories.length} categories with translations for Store ${storeId}`,
    );

    const categoryMap = new Map<string, string>();

    for (const catData of categories) {
      const category = await tx.category.create({
        data: {
          name: catData.name,
          sortOrder: catData.sortOrder,
          storeId,
          deletedAt: null,
          translations: {
            createMany: {
              data: catData.translations.map((t) => ({
                locale: t.locale,
                name: t.name,
              })),
            },
          },
        },
      });
      categoryMap.set(catData.name, category.id);
      this.logger.log(
        `[${method}] Created category "${catData.name}" (ID: ${category.id}) with ${catData.translations.length} translations`,
      );
    }

    this.logger.log(
      `[${method}] Created ${categoryMap.size} categories with translations`,
    );
    return categoryMap;
  }
}
