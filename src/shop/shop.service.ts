import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // or your chosen ORM
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new shop, automatically assigning the creator as OWNER.
   */
  async createShop(userId: number, dto: CreateShopDto) {
    // 1. Create the shop
    const shop = await this.prisma.shop.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
      },
    });

    // 2. Assign the user as OWNER in UserShop pivot
    await this.prisma.userShop.create({
      data: {
        userId,
        shopId: shop.id,
        role: Role.OWNER,
      },
    });

    return shop;
  }

  /**
   * Update shop info, only if user is OWNER or ADMIN of the shop.
   */
  async updateShop(userId: number, shopId: number, dto: UpdateShopDto) {
    // Check role
    const membership = await this.prisma.userShop.findUnique({
      where: {
        userId_shopId: { userId, shopId },
      },
    });
    if (
      !membership ||
      !([Role.OWNER, Role.ADMIN] as Role[]).includes(membership.role)
    ) {
      throw new ForbiddenException(
        'You do not have permission to edit this shop',
      );
    }

    // Perform update
    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
      },
    });
    return updated;
  }

  /**
   * Invite or assign a role to a user by their email.
   * Owner or Admin can do so, with restrictions:
   * - OWNER can assign any role
   * - ADMIN can only assign SALE or CHEF
   */
  async inviteOrAssignRoleByEmail(
    actingUserId: number,
    shopId: number,
    dto: InviteOrAssignRoleDto,
  ) {
    // 1) Check the role of the acting user in this shop
    const membership = await this.prisma.userShop.findUnique({
      where: { userId_shopId: { userId: actingUserId, shopId } },
    });
    if (!membership) {
      throw new ForbiddenException('You have no membership in this shop');
    }

    // 2) Permission logic
    const isOwner = membership.role === Role.OWNER;
    const isAdmin = membership.role === Role.ADMIN;

    // If user is neither OWNER nor ADMIN, forbid
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can invite or assign roles',
      );
    }

    // ADMIN can only assign SALE or CHEF
    if (isAdmin && !([Role.SALE, Role.CHEF] as Role[]).includes(dto.role)) {
      throw new ForbiddenException('ADMIN can only assign SALE or CHEF roles');
    }

    // 3) Find or create the target user by email
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser) {
      throw new NotFoundException(`No user found with email ${dto.email}`);
      // or auto-create the user if you prefer
    }

    // 4) Upsert userShop pivot to set the new role
    const userShop = await this.prisma.userShop.upsert({
      where: {
        userId_shopId: {
          userId: targetUser.id,
          shopId,
        },
      },
      update: {
        role: dto.role,
      },
      create: {
        userId: targetUser.id,
        shopId,
        role: dto.role,
      },
    });

    return userShop;
  }
}
