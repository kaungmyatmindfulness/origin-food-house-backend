import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  // Check if user is OWNER or ADMIN
  async checkOwnerOrAdmin(userId: number, storeId: number) {
    const membership = await this.prisma.userStore.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });
    if (!membership) {
      throw new ForbiddenException('User is not a member of this store');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('User lacks permission for this action');
    }
    return membership;
  }

  // Retrieve all items for a store
  async getStoreMenuItems(storeId: number) {
    return this.prisma.menuItem.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        variations: true,
        sizes: true,
        addOns: true,
      },
    });
  }

  // Fetch single item
  async getMenuItemById(itemId: number) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: { category: true, variations: true, sizes: true, addOns: true },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found: ${itemId}`);
    }
    return item;
  }

  // Create a new item, upserting category/variations in a transaction
  async createMenuItem(
    userId: number,
    storeId: number,
    dto: CreateMenuItemDto,
  ) {
    await this.checkOwnerOrAdmin(userId, storeId);

    return this.prisma.$transaction(async (tx) => {
      let categoryId: number | null = null;
      if (dto.category) {
        categoryId = await this.upsertCategory(tx, dto.category, storeId);
      }

      // get max sort order
      const maxSort = await tx.menuItem.aggregate({
        where: { storeId },
        _max: { sortOrder: true },
      });
      const newSortOrder = (maxSort._max.sortOrder || 0) + 1;

      // create main item
      const mainItem = await tx.menuItem.create({
        data: {
          name: dto.name,
          description: dto.description,
          basePrice: dto.basePrice,
          imageKey: dto.imageKey,
          storeId,
          categoryId: categoryId ?? undefined,
          sortOrder: newSortOrder,
        },
      });

      // upsert variations, sizes, addOns
      if (dto.variations?.length) {
        await this.upsertVariations(tx, mainItem.id, dto.variations);
      }
      if (dto.sizes?.length) {
        await this.upsertSizes(tx, mainItem.id, dto.sizes);
      }
      if (dto.addOnOptions?.length) {
        await this.upsertAddOns(tx, mainItem.id, dto.addOnOptions);
      }

      // return final item
      return tx.menuItem.findUnique({
        where: { id: mainItem.id },
        include: {
          category: true,
          variations: true,
          sizes: true,
          addOns: true,
        },
      });
    });
  }

  // Update existing item with transaction
  async updateMenuItem(
    userId: number,
    storeId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ) {
    await this.checkOwnerOrAdmin(userId, storeId);

    return this.prisma.$transaction(async (tx) => {
      // confirm item
      const existing = await tx.menuItem.findUnique({
        where: { id: itemId },
        include: { variations: true, sizes: true, addOns: true },
      });
      if (!existing) {
        throw new NotFoundException(`Menu item not found: ${itemId}`);
      }
      if (existing.storeId !== storeId) {
        throw new ForbiddenException('Item does not belong to this store');
      }

      // upsert category if provided
      let newCategoryId: number | null = existing.categoryId;
      if (dto.category) {
        newCategoryId = await this.upsertCategory(tx, dto.category, storeId);
      }

      // update main fields
      await tx.menuItem.update({
        where: { id: itemId },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description ?? existing.description,
          basePrice: dto.basePrice ?? existing.basePrice,
          imageKey: dto.imageKey ?? existing.imageKey,
          categoryId: newCategoryId ?? null,
        },
      });

      // upsert variations, sizes, addOns
      if (dto.variations) {
        await this.upsertVariations(tx, itemId, dto.variations);
      }
      if (dto.sizes) {
        await this.upsertSizes(tx, itemId, dto.sizes);
      }
      if (dto.addOnOptions) {
        await this.upsertAddOns(tx, itemId, dto.addOnOptions);
      }

      // final item
      return tx.menuItem.findUnique({
        where: { id: itemId },
        include: {
          category: true,
          variations: true,
          sizes: true,
          addOns: true,
        },
      });
    });
  }

  // Delete item
  async deleteMenuItem(userId: number, storeId: number, itemId: number) {
    await this.checkOwnerOrAdmin(userId, storeId);
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found: ${itemId}`);
    }
    if (item.storeId !== storeId) {
      throw new ForbiddenException('Item does not belong to this store');
    }
    return this.prisma.menuItem.delete({ where: { id: itemId } });
  }

  //
  // ---- HELPER UPSERTS (with transaction) ----
  //
  private async upsertCategory(
    tx: Prisma.TransactionClient,
    catDto: { id?: number; name: string },
    storeId: number,
  ): Promise<number> {
    if (catDto.id) {
      const existingCat = await tx.category.findUnique({
        where: { id: catDto.id },
      });
      if (!existingCat) {
        throw new NotFoundException(`Category not found: ${catDto.id}`);
      }
      if (existingCat.storeId !== storeId) {
        throw new ForbiddenException('Category belongs to another store');
      }
      const updated = await tx.category.update({
        where: { id: catDto.id },
        data: { name: catDto.name },
      });
      return updated.id;
    }
    const newCat = await tx.category.create({
      data: {
        name: catDto.name,
        storeId,
      },
    });
    return newCat.id;
  }

  private async upsertVariations(
    tx: Prisma.TransactionClient,
    menuItemId: number,
    variations: { id?: number; name: string; additionalPrice: number }[],
  ) {
    for (const v of variations) {
      if (v.id) {
        const existing = await tx.variation.findUnique({ where: { id: v.id } });
        if (!existing) {
          throw new NotFoundException(`Variation not found: ${v.id}`);
        }
        if (existing.menuItemId !== menuItemId) {
          throw new ForbiddenException(`Variation ${v.id} mismatch`);
        }
        await tx.variation.update({
          where: { id: v.id },
          data: { name: v.name, extraPrice: v.additionalPrice },
        });
      } else {
        await tx.variation.create({
          data: {
            menuItemId,
            name: v.name,
            extraPrice: v.additionalPrice,
          },
        });
      }
    }
  }

  private async upsertSizes(
    tx: Prisma.TransactionClient,
    menuItemId: number,
    sizes: { id?: number; name: string; additionalPrice: number }[],
  ) {
    for (const s of sizes) {
      if (s.id) {
        const existing = await tx.size.findUnique({ where: { id: s.id } });
        if (!existing) {
          throw new NotFoundException(`Size not found: ${s.id}`);
        }
        if (existing.menuItemId !== menuItemId) {
          throw new ForbiddenException(`Size ${s.id} mismatch`);
        }
        await tx.size.update({
          where: { id: s.id },
          data: { name: s.name, extraPrice: s.additionalPrice },
        });
      } else {
        await tx.size.create({
          data: {
            menuItemId,
            name: s.name,
            extraPrice: s.additionalPrice,
          },
        });
      }
    }
  }

  private async upsertAddOns(
    tx: Prisma.TransactionClient,
    menuItemId: number,
    addOns: { id?: number; name: string; additionalPrice: number }[],
  ) {
    for (const a of addOns) {
      if (a.id) {
        const existing = await tx.addOn.findUnique({ where: { id: a.id } });
        if (!existing) {
          throw new NotFoundException(`AddOn not found: ${a.id}`);
        }
        if (existing.menuItemId !== menuItemId) {
          throw new ForbiddenException(`AddOn ${a.id} mismatch`);
        }
        await tx.addOn.update({
          where: { id: a.id },
          data: { name: a.name, extraPrice: a.additionalPrice },
        });
      } else {
        await tx.addOn.create({
          data: {
            menuItemId,
            name: a.name,
            extraPrice: a.additionalPrice,
          },
        });
      }
    }
  }
}
