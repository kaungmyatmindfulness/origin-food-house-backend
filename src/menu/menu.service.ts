import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  private async checkOwnerOrAdmin(actingUserId: number, shopId: number) {
    const membership = await this.prisma.userShop.findUnique({
      where: { userId_shopId: { userId: actingUserId, shopId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this shop');
    }
    if (!([Role.OWNER, Role.ADMIN] as Role[]).includes(membership.role)) {
      throw new ForbiddenException('Only OWNER or ADMIN can modify menu items');
    }
  }

  // READ: all items for a shop (public)
  async getShopMenuItems(shopId: number) {
    return this.prisma.menuItem.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
    });
  }

  // READ single item by ID (public)
  async getMenuItemById(itemId: number) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    return item;
  }

  // CREATE
  async createMenuItem(
    actingUserId: number,
    shopId: number,
    dto: CreateMenuItemDto,
  ) {
    await this.checkOwnerOrAdmin(actingUserId, shopId);

    return this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        imageKey: dto.imageKey,
        categoryId: dto.categoryId,
        shopId,
        // Store arrays in JSON
        variations: (dto.variations ||
          undefined) as unknown as Prisma.JsonObject,
        sizes: (dto.sizes || undefined) as unknown as Prisma.JsonObject,
        addOns: (dto.addOnOptions || undefined) as unknown as Prisma.JsonObject,
      },
    });
  }

  // UPDATE
  async updateMenuItem(
    actingUserId: number,
    shopId: number,
    itemId: number,
    dto: UpdateMenuItemDto,
  ) {
    await this.checkOwnerOrAdmin(actingUserId, shopId);

    // ensure item belongs to that shop
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.shopId !== shopId) {
      throw new ForbiddenException('Item does not belong to your current shop');
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        imageKey: dto.imageKey,
        categoryId: dto.categoryId,
        // update JSON fields if provided
        variations: (dto.variations !== undefined
          ? dto.variations
          : undefined) as unknown as Prisma.JsonObject,
        sizes: (dto.sizes !== undefined
          ? dto.sizes
          : undefined) as unknown as Prisma.JsonObject,
        addOns: (dto.addOnOptions !== undefined
          ? dto.addOnOptions
          : undefined) as unknown as Prisma.JsonObject,
      },
    });
  }

  // DELETE
  async deleteMenuItem(actingUserId: number, shopId: number, itemId: number) {
    await this.checkOwnerOrAdmin(actingUserId, shopId);

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException(`Menu item not found (id=${itemId})`);
    }
    if (item.shopId !== shopId) {
      throw new ForbiddenException('Item does not belong to your current shop');
    }

    return this.prisma.menuItem.delete({ where: { id: itemId } });
  }
}
