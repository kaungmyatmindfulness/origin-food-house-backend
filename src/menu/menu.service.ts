import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  async getStoreMenuItems(storeId: number) {
    return this.prisma.menuItem.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMenuItemById(itemId: number) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    return item;
  }

  // Helper method: verifies that the user is an OWNER or ADMIN of the store.
  async checkOwnerOrAdmin(userId: number, storeId: number) {
    const membership = await this.prisma.userStore.findUnique({
      // Assuming a composite unique index exists on (userId, storeId)
      where: { userId_storeId: { userId, storeId } },
    });
    if (!membership) {
      throw new ForbiddenException('User is not a member of this store');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'User does not have permission to perform this action',
      );
    }
    return membership;
  }

  async createMenuItem(
    userId: number,
    storeId: number,
    dto: CreateMenuItemDto,
  ) {
    // Check if the user is an owner or admin of the store.
    await this.checkOwnerOrAdmin(userId, storeId);
    // Create the menu item using the storeId from JWT.
    const newItem = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        imageKey: dto.imageKey,
        categoryId: dto.categoryId,
        storeId, // from JWT
        // Nested relations for variations, sizes, addOns can be handled separately.
      },
    });
    return newItem;
  }

  async updateMenuItem(
    userId: number,
    storeId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ) {
    // Check membership and permissions.
    await this.checkOwnerOrAdmin(userId, storeId);
    // Verify the menu item exists and belongs to the store.
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.storeId !== storeId) {
      throw new ForbiddenException(
        'Unauthorized: This menu item does not belong to your store.',
      );
    }
    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        imageKey: dto.imageKey,
        categoryId: dto.categoryId,
      },
    });
    return updated;
  }

  async deleteMenuItem(userId: number, storeId: number, itemId: number) {
    // Check membership and permissions.
    await this.checkOwnerOrAdmin(userId, storeId);
    // Verify the item exists and belongs to the store.
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.storeId !== storeId) {
      throw new ForbiddenException(
        'Unauthorized: This menu item does not belong to your store.',
      );
    }
    const deleted = await this.prisma.menuItem.delete({
      where: { id: itemId },
    });
    return deleted;
  }
}
