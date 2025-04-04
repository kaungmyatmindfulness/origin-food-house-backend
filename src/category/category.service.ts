import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger, // Added Logger
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { Prisma, Category, MenuItem } from '@prisma/client'; // Import Prisma types

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name); // Added Logger

  constructor(private prisma: PrismaService) {}

  /**
   * Checks if the user has OWNER or ADMIN role for the given store.
   * Throws ForbiddenException if access is denied.
   */
  private async checkOwnerOrAdmin(
    userId: number,
    storeId: number,
  ): Promise<void> {
    // Added input validation check
    if (!userId || !storeId) {
      this.logger.warn(
        `checkOwnerOrAdmin called with invalid userId (${userId}) or storeId (${storeId})`,
      );
      throw new ForbiddenException(
        'Invalid user or store context for permission check.',
      );
    }

    const membership = await this.prisma.userStore.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
      select: { role: true }, // Only select role
    });

    if (!membership) {
      this.logger.warn(
        `Permission denied: User ${userId} not found in Store ${storeId}.`,
      );
      throw new ForbiddenException(
        `User is not a member of store ID ${storeId}.`,
      );
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      this.logger.warn(
        `Permission denied: User ${userId} has role ${membership.role} in Store ${storeId}, requires OWNER or ADMIN.`,
      );
      throw new ForbiddenException(
        `User requires OWNER or ADMIN role for this action in store ID ${storeId}.`,
      );
    }
    this.logger.verbose(
      `User ${userId} authorized as ${membership.role} for Store ${storeId}.`,
    );
  }

  /**
   * Creates a new category within the specified store. Requires Owner/Admin role.
   */
  async create(
    userId: number,
    storeId: number,
    dto: CreateCategoryDto,
  ): Promise<Category> {
    this.logger.log(
      `User ${userId} attempting to create category '${dto.name}' in Store ${storeId}.`,
    );
    await this.checkOwnerOrAdmin(userId, storeId);

    // Find max sortOrder atomically during creation if possible, or get max first
    // Getting max first is simpler here.
    const maxSortResult = await this.prisma.category.aggregate({
      _max: { sortOrder: true },
      where: { storeId },
    });
    // Default to -1 so the first item gets sortOrder 0
    const newSortOrder = (maxSortResult._max.sortOrder ?? -1) + 1;
    this.logger.verbose(
      `Calculated new sortOrder: ${newSortOrder} for category in Store ${storeId}.`,
    );

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        storeId,
        sortOrder: newSortOrder,
      },
    });
    this.logger.log(
      `Category '${category.name}' (ID: ${category.id}) created successfully in Store ${storeId}.`,
    );
    return category;
  }

  /**
   * Finds all categories for a given store, ordered by sortOrder.
   * Optionally includes MenuItems.
   */
  async findAll(storeId: number, includeItems = false): Promise<Category[]> {
    // Added includeItems flag
    this.logger.verbose(
      `Workspaceing all categories for Store ${storeId}, includeItems: ${includeItems}.`,
    );
    return this.prisma.category.findMany({
      where: { storeId },
      // Conditionally include menuItems
      include: {
        menuItems: includeItems ? { orderBy: { sortOrder: 'asc' } } : false,
      },
      orderBy: { sortOrder: 'asc' }, // Order by sortOrder by default
    });
  }

  /**
   * Finds a single category by its ID, ensuring it belongs to the specified store.
   * @throws NotFoundException if category not found or doesn't belong to the store.
   */
  async findOne(categoryId: number, storeId: number): Promise<Category> {
    this.logger.verbose(
      `Workspaceing category ID ${categoryId} for Store ${storeId}.`,
    );
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    // Combine checks for existence and store ownership
    if (!category || category.storeId !== storeId) {
      this.logger.warn(
        `Category ID ${categoryId} not found or does not belong to Store ${storeId}.`,
      );
      throw new NotFoundException(
        `Category with ID ${categoryId} not found in your store.`,
      );
    }
    return category;
  }

  /**
   * Updates a category's name. Requires Owner/Admin role.
   * @throws NotFoundException, ForbiddenException
   */
  async update(
    userId: number,
    storeId: number,
    categoryId: number,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    this.logger.log(
      `User ${userId} attempting to update category ID ${categoryId} in Store ${storeId}.`,
    );
    await this.checkOwnerOrAdmin(userId, storeId);

    // Use findOne which includes store check
    await this.findOne(categoryId, storeId); // Throws if not found or doesn't belong

    const updatedCategory = await this.prisma.category.update({
      where: { id: categoryId }, // No need for storeId here as findOne validated it
      data: {
        name: dto.name, // Assumes dto only contains name, otherwise use ?? existing.name
      },
    });
    this.logger.log(`Category ID ${categoryId} updated successfully.`);
    return updatedCategory;
  }

  /**
   * Deletes a category. Requires Owner/Admin role.
   * @throws NotFoundException, ForbiddenException
   */
  async remove(
    userId: number,
    storeId: number,
    categoryId: number,
  ): Promise<{ id: number }> {
    this.logger.log(
      `User ${userId} attempting to delete category ID ${categoryId} from Store ${storeId}.`,
    );
    await this.checkOwnerOrAdmin(userId, storeId);

    // Use findOne which includes store check
    await this.findOne(categoryId, storeId); // Throws if not found or doesn't belong

    // Prisma's onDelete: Cascade on MenuItem relationship should handle associated items if set in schema
    // Check your MenuItem schema for `onDelete: Cascade` on the category relation. If not set, handle item deletion/reassignment first.
    await this.prisma.category.delete({
      where: { id: categoryId },
    });
    this.logger.log(
      `Category ID ${categoryId} deleted successfully from Store ${storeId}.`,
    );
    return { id: categoryId }; // Return ID of deleted category
  }

  /**
   * Bulk updates sort orders for categories and their menu items within a store. Requires Owner/Admin role.
   * Optimized to reduce database reads during validation.
   * @throws ForbiddenException, BadRequestException
   */
  async sortCategoriesAndMenuItems(
    userId: number,
    storeId: number,
    payload: SortCategoriesPayloadDto,
  ): Promise<{ message: string }> {
    this.logger.log(
      `User ${userId} attempting to sort categories/items in Store ${storeId}.`,
    );
    await this.checkOwnerOrAdmin(userId, storeId);

    // --- Optimization: Fetch valid IDs upfront ---
    const validStoreEntities = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        categories: { select: { id: true } },
        menuItems: { select: { id: true } },
      },
    });

    if (!validStoreEntities) {
      // Should not happen if storeId comes from JWT of an admin/owner, but safeguard
      throw new NotFoundException(`Store with ID ${storeId} not found.`);
    }

    const validCategoryIds = new Set(
      validStoreEntities.categories.map((c) => c.id),
    );
    const validMenuItemIds = new Set(
      validStoreEntities.menuItems.map((i) => i.id),
    );
    // --- End Optimization ---

    const updateOperations: Prisma.PrismaPromise<any>[] = []; // Use PrismaPromise type

    for (const cat of payload.categories) {
      // Validate category belongs to store using the prefetched set
      if (!validCategoryIds.has(cat.id)) {
        this.logger.error(
          `Sorting failed: Category ID ${cat.id} does not belong to Store ${storeId}. Payload invalid.`,
        );
        throw new BadRequestException(
          `Invalid payload: Category ID ${cat.id} does not belong to your store.`,
        );
      }

      // Queue category sort order update
      updateOperations.push(
        this.prisma.category.update({
          where: { id: cat.id }, // No storeId needed here if validated
          data: { sortOrder: cat.sortOrder },
        }),
      );

      for (const item of cat.menuItems) {
        // Validate menu item belongs to store using the prefetched set
        if (!validMenuItemIds.has(item.id)) {
          this.logger.error(
            `Sorting failed: Menu Item ID ${item.id} does not belong to Store ${storeId}. Payload invalid.`,
          );
          throw new BadRequestException(
            `Invalid payload: Menu Item ID ${item.id} does not belong to your store.`,
          );
        }

        // Queue menu item sort order update
        updateOperations.push(
          this.prisma.menuItem.update({
            where: { id: item.id }, // No storeId needed here if validated
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
      `Executing ${updateOperations.length} sort update operations for Store ${storeId}.`,
    );
    // Run all queued updates in a single transaction
    await this.prisma.$transaction(updateOperations);

    this.logger.log(
      `Categories & menu items reordered successfully for Store ${storeId}.`,
    );
    return { message: 'Categories & menu items reordered successfully.' };
  }
}
