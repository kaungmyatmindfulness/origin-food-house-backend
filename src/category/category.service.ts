import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { Prisma, Category, Role } from '@prisma/client';
import { CategoryResponseDto } from 'src/category/dto/category-response.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  private readonly categoryWithItemsInclude =
    Prisma.validator<Prisma.CategoryInclude>()({
      menuItems: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      },
    });

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Creates a new category within the specified store. Requires Owner/Admin role.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the store.
   * @param dto DTO containing category name.
   * @returns The newly created Category.
   * @throws {ForbiddenException} If user lacks permission.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async create(
    userId: string,
    storeId: string,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    this.logger.log(
      `User ${userId} attempting to create category '${dto.name}' in Store ${storeId}.`,
    );

    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      const existingActiveCategory = await this.prisma.category.findFirst({
        where: {
          storeId: storeId,
          name: dto.name,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existingActiveCategory) {
        throw new BadRequestException(
          `An active category with name "${dto.name}" already exists.`,
        );
      }

      const maxSortResult = await this.prisma.category.aggregate({
        _max: { sortOrder: true },
        where: { storeId, deletedAt: null },
      });
      const newSortOrder = (maxSortResult._max.sortOrder ?? -1) + 1;
      this.logger.verbose(
        `Calculated new sortOrder: ${newSortOrder} for category in Store ${storeId}.`,
      );

      const category = await this.prisma.category.create({
        data: { name: dto.name, storeId, sortOrder: newSortOrder },
      });

      this.logger.log(
        `Category '${category.name}' (ID: ${category.id}) created successfully in Store ${storeId}.`,
      );
      return category;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Category name "${dto.name}" could not be created due to a conflict.`,
        );
      }
      this.logger.error(
        `Failed to create category '${dto.name}' in Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not create category.');
    }
  }

  /**
   * Finds all categories for a given store, ordered by sortOrder.
   * Optionally includes MenuItems ordered by their sortOrder.
   * @param storeId The ID (UUID) of the store.
   * @param includeItems Whether to include associated menu items.
   * @returns Array of categories, potentially with nested menu items.
   */
  async findAll(
    storeId: string,
    includeItems = false,
  ): Promise<CategoryResponseDto[]> {
    this.logger.verbose(
      `Finding all categories for Store ${storeId}, includeItems: ${includeItems}.`,
    );
    try {
      const categories = await this.prisma.category.findMany({
        where: {
          storeId: storeId,
          deletedAt: null,
        },
        include: {
          menuItems: includeItems
            ? this.categoryWithItemsInclude.menuItems
            : undefined,
        },
        orderBy: { sortOrder: 'asc' },
      });
      return categories;
    } catch (error) {
      this.logger.error(
        `Failed to find categories for Store ${storeId}.`,
        error,
      );
      throw new InternalServerErrorException('Could not retrieve categories.');
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
          storeId: storeId,
          deletedAt: null,
        },
      });

      return category;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
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
      throw new InternalServerErrorException('Could not retrieve category.');
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

    // 1. Ensure the category being updated exists and is active
    await this.findOne(categoryId, storeId); // This already includes deletedAt: null check

    // 2. Check if ANOTHER active category with the new name exists
    if (dto.name) {
      const conflictingCategory = await this.prisma.category.findFirst({
        where: {
          storeId: storeId,
          name: dto.name,
          id: { not: categoryId }, // Exclude the current category
          deletedAt: null, // Check only active categories
        },
        select: { id: true },
      });
      if (conflictingCategory) {
        throw new BadRequestException(
          `Another active category with name "${dto.name}" already exists.`,
        );
      }
    }

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id: categoryId },
        data: {
          name: dto.name,
        },
      });
      this.logger.log(`Category ID ${categoryId} updated successfully.`);
      return updatedCategory;
    } catch (error) {
      this.logger.error(
        `Failed to update category ID ${categoryId} in Store ${storeId}.`,
        error,
      );
      throw new InternalServerErrorException('Could not update category.');
    }
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

    // 1. Ensure category exists and is active before trying to delete
    await this.findOne(categoryId, storeId); // Includes deletedAt: null check

    // 2. Check for ACTIVE child MenuItems
    const menuItemCount = await this.prisma.menuItem.count({
      where: {
        categoryId: categoryId,
        deletedAt: null, // <-- Check only ACTIVE menu items
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

    try {
      // 3. Perform soft delete (via middleware)
      // The actual DB operation will be an UPDATE by the middleware
      await this.prisma.category.delete({
        where: { id: categoryId },
      });
      this.logger.log(`Category ID ${categoryId} soft deleted successfully.`);
      return { id: categoryId };
    } catch (error) {
      // Handle errors *other* than not found (which findOne handles) or FK constraints (which menuItemCount check handles)
      this.logger.error(
        `Failed to soft delete category ID ${categoryId}`,
        error,
      );
      throw new InternalServerErrorException('Could not delete category.');
    }
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
        return { message: 'No categories or items to reorder.' };
      }

      this.logger.log(
        `Executing ${updateOperations.length} sort update operations for Store ${storeId} in a transaction.`,
      );

      await this.prisma.$transaction(updateOperations);

      this.logger.log(
        `Categories & menu items reordered successfully for Store ${storeId}.`,
      );
      return { message: 'Categories & menu items reordered successfully.' };
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
        'Could not reorder categories and items.',
      );
    }
  }
}
