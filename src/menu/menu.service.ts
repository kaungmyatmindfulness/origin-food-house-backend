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

  async getShopMenuItems(shopId: number) {
    return this.prisma.menuItem.findMany({
      where: { shopId },
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

  // Helper method: verifies that the user is an OWNER or ADMIN of the shop.
  async checkOwnerOrAdmin(userId: number, shopId: number) {
    const membership = await this.prisma.userShop.findUnique({
      // Assuming a composite unique index exists on (userId, shopId)
      where: { userId_shopId: { userId, shopId } },
    });
    if (!membership) {
      throw new ForbiddenException('User is not a member of this shop');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'User does not have permission to perform this action',
      );
    }
    return membership;
  }

  async createMenuItem(userId: number, shopId: number, dto: CreateMenuItemDto) {
    // Check if the user is an owner or admin of the shop.
    await this.checkOwnerOrAdmin(userId, shopId);
    // Create the menu item using the shopId from JWT.
    const newItem = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        imageKey: dto.imageKey,
        categoryId: dto.categoryId,
        shopId, // from JWT
        // Nested relations for variations, sizes, addOns can be handled separately.
      },
    });
    return newItem;
  }

  async updateMenuItem(
    userId: number,
    shopId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ) {
    // Check membership and permissions.
    await this.checkOwnerOrAdmin(userId, shopId);
    // Verify the menu item exists and belongs to the shop.
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.shopId !== shopId) {
      throw new ForbiddenException(
        'Unauthorized: This menu item does not belong to your shop.',
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

  async deleteMenuItem(userId: number, shopId: number, itemId: number) {
    // Check membership and permissions.
    await this.checkOwnerOrAdmin(userId, shopId);
    // Verify the item exists and belongs to the shop.
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.shopId !== shopId) {
      throw new ForbiddenException(
        'Unauthorized: This menu item does not belong to your shop.',
      );
    }
    const deleted = await this.prisma.menuItem.delete({
      where: { id: itemId },
    });
    return deleted;
  }
}
