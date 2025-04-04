import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { Prisma, MenuItem } from '@prisma/client';
import { UpsertCategoryDto } from './dto/upsert-category.dto';
import { UpsertCustomizationGroupDto } from './dto/upsert-customization-group.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  // Check if user is OWNER or ADMIN for the given store
  async checkOwnerOrAdmin(userId: number, storeId: number): Promise<void> {
    const membership = await this.prisma.userStore.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (!membership) {
      throw new ForbiddenException(
        `User (ID: ${userId}) is not a member of this store (ID: ${storeId})`,
      );
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        `User (ID: ${userId}) requires OWNER or ADMIN role for this action in store (ID: ${storeId})`,
      );
    }
  }

  // Include clause for fetching menu items with details
  private readonly menuItemInclude = {
    category: true,
    customizationGroups: {
      orderBy: { name: 'asc' }, // Or createdAt, etc.
      include: {
        customizationOptions: {
          orderBy: { name: 'asc' }, // Or additionalPrice, etc.
        },
      },
    },
  } satisfies Prisma.MenuItemInclude;

  // Retrieve all menu items for a specific store
  async getStoreMenuItems(storeId: number): Promise<MenuItem[]> {
    return this.prisma.menuItem.findMany({
      where: { storeId },
      orderBy: { category: { sortOrder: 'asc' }, sortOrder: 'asc' }, // Order by category, then item sort order
      include: this.menuItemInclude,
    });
  }

  // Retrieve a single menu item by its ID
  async getMenuItemById(itemId: number): Promise<MenuItem> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: this.menuItemInclude,
    });
    if (!item) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }
    return item;
  }

  // Create a new menu item
  async createMenuItem(
    userId: number,
    storeId: number,
    dto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    await this.checkOwnerOrAdmin(userId, storeId);

    if (!dto.category) {
      throw new BadRequestException(
        'Category is required when creating a menu item.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Upsert Category
      const categoryId = await this.upsertCategory(tx, dto.category, storeId);

      // 2. Get next sort order within the category
      const maxSort = await tx.menuItem.aggregate({
        where: { storeId, categoryId: categoryId }, // Sort within the category
        _max: { sortOrder: true },
      });
      const newSortOrder = (maxSort._max.sortOrder ?? -1) + 1; // Default to 0 if no items yet

      // 3. Create MenuItem
      const menuItem = await tx.menuItem.create({
        data: {
          name: dto.name,
          description: dto.description,
          basePrice: dto.basePrice, // Prisma handles Decimal conversion
          imageKey: dto.imageKey,
          storeId,
          categoryId: categoryId,
          sortOrder: newSortOrder,
          // Customization groups will be created below
        },
      });

      // 4. Create Customization Groups and Options (if provided)
      if (dto.customizationGroups?.length) {
        for (const groupDto of dto.customizationGroups) {
          if (!groupDto.options?.length) continue; // Skip groups without options

          const group = await tx.customizationGroup.create({
            data: {
              menuItemId: menuItem.id,
              name: groupDto.name,
              required: groupDto.required ?? false,
              minSelectable:
                groupDto.minSelectable ?? (groupDto.required ? 1 : 0),
              maxSelectable: groupDto.maxSelectable ?? 1,
              // Options will be created next
            },
          });

          await tx.customizationOption.createMany({
            data: groupDto.options.map((optionDto) => ({
              customizationGroupId: group.id,
              name: optionDto.name,
              additionalPrice: optionDto.additionalPrice, // Prisma handles Decimal conversion
            })),
          });
        }
      }

      // 5. Return the newly created item with includes
      // Use findUniqueOrThrow for type safety and because we know it exists
      return tx.menuItem.findUniqueOrThrow({
        where: { id: menuItem.id },
        include: this.menuItemInclude,
      });
    });
  }

  // Update an existing menu item
  async updateMenuItem(
    userId: number,
    storeId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    await this.checkOwnerOrAdmin(userId, storeId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify item exists and belongs to the store
      const existingMenuItem = await tx.menuItem.findUnique({
        where: { id: itemId },
        include: this.menuItemInclude, // Fetch existing customizations
      });

      if (!existingMenuItem) {
        throw new NotFoundException(`Menu item with ID ${itemId} not found`);
      }
      if (existingMenuItem.storeId !== storeId) {
        throw new ForbiddenException(
          `Menu item (ID: ${itemId}) does not belong to your store (ID: ${storeId})`,
        );
      }

      // 2. Upsert Category if provided
      let newCategoryId = existingMenuItem.categoryId;
      if (dto.category) {
        newCategoryId = await this.upsertCategory(tx, dto.category, storeId);
      }

      // 3. Update MenuItem basic fields
      await tx.menuItem.update({
        where: { id: itemId },
        data: {
          name: dto.name ?? existingMenuItem.name,
          description: dto.description ?? existingMenuItem.description,
          basePrice: dto.basePrice ?? existingMenuItem.basePrice,
          imageKey: dto.imageKey ?? existingMenuItem.imageKey,
          categoryId: newCategoryId,
          // sortOrder could be updated separately if needed
        },
      });

      // 4. Process Customization Groups (Upsert/Delete)
      if (dto.customizationGroups !== undefined) {
        // Only process if the key exists in DTO
        await this.syncCustomizationGroups(
          tx,
          itemId,
          existingMenuItem.customizationGroups,
          dto.customizationGroups, // DTO can be null/empty array to delete all
        );
      }

      // 5. Return the updated item
      return tx.menuItem.findUniqueOrThrow({
        where: { id: itemId },
        include: this.menuItemInclude,
      });
    });
  }

  // Delete a menu item
  async deleteMenuItem(
    userId: number,
    storeId: number,
    itemId: number,
  ): Promise<{ id: number }> {
    await this.checkOwnerOrAdmin(userId, storeId);

    // Verify item exists and belongs to the store before deleting
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { storeId: true }, // Only need storeId for verification
    });

    if (!item) {
      throw new NotFoundException(`Menu item with ID ${itemId} not found`);
    }
    if (item.storeId !== storeId) {
      throw new ForbiddenException(
        `Menu item (ID: ${itemId}) does not belong to your store (ID: ${storeId})`,
      );
    }

    // Delete the item (relations with onDelete: Cascade will handle groups/options)
    await this.prisma.menuItem.delete({
      where: { id: itemId },
    });

    return { id: itemId }; // Return ID of deleted item
  }

  // --- Helper Functions ---

  // Upserts a category within a transaction
  private async upsertCategory(
    tx: Prisma.TransactionClient,
    catDto: UpsertCategoryDto,
    storeId: number,
  ): Promise<number> {
    if (catDto.id) {
      // Update existing category
      try {
        const updatedCat = await tx.category.update({
          where: { id: catDto.id, storeId: storeId }, // Ensure it belongs to the store
          data: { name: catDto.name },
          select: { id: true },
        });
        return updatedCat.id;
      } catch (error) {
        // Handle case where ID exists but belongs to another store or doesn't exist
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException(
            `Category with ID ${catDto.id} not found or does not belong to store ID ${storeId}.`,
          );
        }
        throw error; // Re-throw other errors
      }
    } else {
      // Create new category
      const existing = await tx.category.findFirst({
        where: { name: catDto.name, storeId },
      });
      if (existing) {
        // Optionally return existing ID or throw error if name must be unique per store
        // For now, let's return the existing one to avoid duplicates by name
        return existing.id;
        // Or: throw new BadRequestException(`Category with name "${catDto.name}" already exists in store ID ${storeId}.`);
      }

      // Get next sort order for the new category
      const maxSort = await tx.category.aggregate({
        where: { storeId },
        _max: { sortOrder: true },
      });
      const newSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      const newCat = await tx.category.create({
        data: {
          name: catDto.name,
          storeId,
          sortOrder: newSortOrder,
        },
        select: { id: true },
      });
      return newCat.id;
    }
  }

  // Syncs Customization Groups and Options based on DTO during update
  private async syncCustomizationGroups(
    tx: Prisma.TransactionClient,
    menuItemId: number,
    existingGroups: Array<{
      id: number;
      customizationOptions: Array<{ id: number }>;
    }>, // Existing data from DB
    groupDtos: UpsertCustomizationGroupDto[] | null | undefined, // New data from request DTO
  ) {
    const dtoGroups = groupDtos ?? []; // Ensure it's an array
    const existingGroupIds = new Set(existingGroups.map((g) => g.id));
    const dtoGroupIds = new Set(
      dtoGroups.filter((g) => g.id).map((g) => g.id as number),
    );

    // 1. Delete groups that are in existing but not in DTO
    const groupsToDelete = existingGroups.filter((g) => !dtoGroupIds.has(g.id));
    if (groupsToDelete.length > 0) {
      await tx.customizationGroup.deleteMany({
        where: { id: { in: groupsToDelete.map((g) => g.id) } },
      });
      // Cascade delete should handle options
    }

    // 2. Process groups present in the DTO (Update or Create)
    for (const groupDto of dtoGroups) {
      if (groupDto.id && existingGroupIds.has(groupDto.id)) {
        // Update existing group
        const existingGroup = existingGroups.find((g) => g.id === groupDto.id)!; // We know it exists
        await tx.customizationGroup.update({
          where: { id: groupDto.id },
          data: {
            name: groupDto.name,
            required: groupDto.required ?? false, // Use defaults from schema/DTO
            minSelectable:
              groupDto.minSelectable ?? (groupDto.required ? 1 : 0),
            maxSelectable: groupDto.maxSelectable ?? 1,
          },
        });
        // Sync options within this updated group
        await this.syncCustomizationOptions(
          tx,
          groupDto.id,
          existingGroup.customizationOptions,
          groupDto.options,
        );
      } else {
        // Create new group (ignore any ID passed in DTO if it wasn't in existing)
        if (!groupDto.options?.length) continue; // Don't create empty groups

        const newGroup = await tx.customizationGroup.create({
          data: {
            menuItemId: menuItemId,
            name: groupDto.name,
            required: groupDto.required ?? false,
            minSelectable:
              groupDto.minSelectable ?? (groupDto.required ? 1 : 0),
            maxSelectable: groupDto.maxSelectable ?? 1,
            // Options below
          },
        });
        // Create all options for the new group
        if (groupDto.options?.length) {
          await tx.customizationOption.createMany({
            data: groupDto.options.map((optDto) => ({
              customizationGroupId: newGroup.id,
              name: optDto.name,
              additionalPrice: optDto.additionalPrice,
            })),
          });
        }
      }
    }
  }

  // Syncs Customization Options within a specific group
  private async syncCustomizationOptions(
    tx: Prisma.TransactionClient,
    groupId: number,
    existingOptions: Array<{ id: number }>,
    optionDtos:
      | Array<{ id?: number; name: string; additionalPrice?: number | Decimal }>
      | null
      | undefined,
  ) {
    const dtoOptions = optionDtos ?? [];
    const existingOptionIds = new Set(existingOptions.map((o) => o.id));
    const dtoOptionIds = new Set(
      dtoOptions.filter((o) => o.id).map((o) => o.id as number),
    );

    // 1. Delete options that exist but are not in the DTO for this group
    const optionsToDelete = existingOptions.filter(
      (o) => !dtoOptionIds.has(o.id),
    );
    if (optionsToDelete.length > 0) {
      await tx.customizationOption.deleteMany({
        where: { id: { in: optionsToDelete.map((o) => o.id) } },
      });
    }

    // 2. Process options from DTO (Update or Create)
    for (const optionDto of dtoOptions) {
      if (optionDto.id && existingOptionIds.has(optionDto.id)) {
        // Update existing option
        await tx.customizationOption.update({
          where: { id: optionDto.id },
          data: {
            name: optionDto.name,
            additionalPrice: optionDto.additionalPrice,
          },
        });
      } else {
        // Create new option (ignore ID if it wasn't in existing)
        await tx.customizationOption.create({
          data: {
            customizationGroupId: groupId,
            name: optionDto.name,
            additionalPrice: optionDto.additionalPrice,
          },
        });
      }
    }
  }
}
