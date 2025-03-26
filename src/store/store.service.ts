import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // or your chosen ORM
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { Role } from '@prisma/client';

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new store, automatically assigning the creator as OWNER.
   */
  async createStore(userId: number, dto: CreateStoreDto) {
    // 1. Create the store
    const store = await this.prisma.store.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
      },
    });

    // 2. Assign the user as OWNER in UserStore pivot
    await this.prisma.userStore.create({
      data: {
        userId,
        storeId: store.id,
        role: Role.OWNER,
      },
    });

    return store;
  }

  /**
   * Update store info, only if user is OWNER or ADMIN of the store.
   */
  async updateStore(userId: number, storeId: number, dto: UpdateStoreDto) {
    // Check role
    const membership = await this.prisma.userStore.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
    });
    if (
      !membership ||
      !([Role.OWNER, Role.ADMIN] as Role[]).includes(membership.role)
    ) {
      throw new ForbiddenException(
        'You do not have permission to edit this store',
      );
    }

    // Perform update
    const updated = await this.prisma.store.update({
      where: { id: storeId },
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
    storeId: number,
    dto: InviteOrAssignRoleDto,
  ) {
    // 1) Check the role of the acting user in this store
    const membership = await this.prisma.userStore.findUnique({
      where: { userId_storeId: { userId: actingUserId, storeId } },
    });
    if (!membership) {
      throw new ForbiddenException('You have no membership in this store');
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

    // 4) Upsert userStore pivot to set the new role
    const userStore = await this.prisma.userStore.upsert({
      where: {
        userId_storeId: {
          userId: targetUser.id,
          storeId,
        },
      },
      update: {
        role: dto.role,
      },
      create: {
        userId: targetUser.id,
        storeId,
        role: dto.role,
      },
    });

    return userStore;
  }
}
