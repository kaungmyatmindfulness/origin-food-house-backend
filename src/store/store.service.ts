import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger, // Added Logger
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Assuming correct path
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { Role, Store, UserStore } from '@prisma/client'; // Import types

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name); // Added logger

  constructor(private prisma: PrismaService) {}

  /**
   * Checks if a user has the required role(s) within a specific store.
   * Throws ForbiddenException if access is denied.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the store being accessed.
   * @param requiredRoles Array of roles that grant permission.
   */
  private async checkStorePermission(
    userId: number,
    storeId: number,
    requiredRoles: Role[],
  ): Promise<{ role: Role }> {
    // Return membership role if needed
    if (!userId || !storeId) {
      this.logger.warn(
        `Permission check failed due to invalid userId (${userId}) or storeId (${storeId})`,
      );
      throw new ForbiddenException(
        'Invalid user or store context for permission check.',
      );
    }
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.error(
        `Permission check failed: requiredRoles array cannot be empty.`,
      );
      throw new ForbiddenException(
        'Permission requirements not specified correctly.',
      );
    }

    const membership = await this.prisma.userStore.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
      select: { role: true },
    });

    if (!membership) {
      this.logger.warn(
        `Permission denied: User ${userId} not found in Store ${storeId}.`,
      );
      throw new ForbiddenException(
        `You are not a member of store ID ${storeId}.`,
      );
    }

    if (!requiredRoles.includes(membership.role)) {
      this.logger.warn(
        `Permission denied: User ${userId} has role ${membership.role} in Store ${storeId}, requires one of [${requiredRoles.join(', ')}].`,
      );
      throw new ForbiddenException(
        `You require one of the following roles for this action: ${requiredRoles.join(', ')}.`,
      );
    }

    this.logger.verbose(
      `User ${userId} authorized with role ${membership.role} (requires ${requiredRoles.join(', ')}) for Store ${storeId}.`,
    );
    return membership; // Return membership details (role) if needed by caller
  }

  /**
   * Creates a new store and assigns the creator as OWNER atomically.
   */
  async createStore(userId: number, dto: CreateStoreDto): Promise<Store> {
    this.logger.log(`User ${userId} attempting to create store: ${dto.name}`);

    // Use transaction to ensure both creations succeed or fail together
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the store
      const store = await tx.store.create({
        data: {
          name: dto.name,
          address: dto.address,
          phone: dto.phone,
          // email can be added if needed
        },
      });
      this.logger.log(
        `Store '${store.name}' (ID: ${store.id}) created within transaction.`,
      );

      // 2. Assign the user as OWNER in UserStore pivot
      await tx.userStore.create({
        data: {
          userId,
          storeId: store.id,
          role: Role.OWNER, // Assign OWNER role
        },
      });
      this.logger.log(
        `User ${userId} assigned as OWNER for new Store ID: ${store.id}.`,
      );

      return store; // Return the created store data
    });

    return result;
  }

  /**
   * Updates store details. Requires OWNER or ADMIN role.
   * @throws NotFoundException if store not found.
   * @throws ForbiddenException if user lacks permission.
   */
  async updateStore(
    userId: number,
    storeId: number,
    dto: UpdateStoreDto,
  ): Promise<Store> {
    this.logger.log(
      `User ${userId} attempting to update Store ID: ${storeId}.`,
    );

    // 1. Check permission (Owner or Admin)
    await this.checkStorePermission(userId, storeId, [Role.OWNER, Role.ADMIN]);

    // 2. Verify store exists (optional but good practice for clear error)
    const storeExists = await this.prisma.store.count({
      where: { id: storeId },
    });
    if (storeExists === 0) {
      this.logger.warn(`Update failed: Store ID ${storeId} not found.`);
      throw new NotFoundException(`Store with ID ${storeId} not found.`);
    }

    // 3. Perform update (Prisma handles partial updates based on DTO fields)
    const updatedStore = await this.prisma.store.update({
      where: { id: storeId },
      // Only include fields present in DTO, Prisma handles this automatically
      // No need for ?? checks unless you want to explicitly prevent nulling fields
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        // email: dto.email, // Add if needed
      },
    });
    this.logger.log(
      `Store ID ${storeId} updated successfully by User ${userId}.`,
    );
    return updatedStore;
  }

  /**
   * Invites an existing user or assigns/updates a role for them in a store.
   * - Requires acting user to be OWNER or ADMIN of the store.
   * - OWNER can assign any role.
   * - ADMIN can only assign STAFF or CHEF roles.
   * @throws NotFoundException if target user email doesn't exist.
   * @throws ForbiddenException if acting user lacks permission or tries to assign invalid role.
   * @throws BadRequestException if trying to assign OWNER role (should be handled differently).
   */
  async inviteOrAssignRoleByEmail(
    actingUserId: number,
    storeId: number,
    dto: InviteOrAssignRoleDto,
  ): Promise<UserStore> {
    this.logger.log(
      `User ${actingUserId} attempting to assign role ${dto.role} to email ${dto.email} in Store ${storeId}.`,
    );

    // 0. Basic validation (e.g., cannot assign OWNER role this way)
    if (dto.role === Role.OWNER) {
      this.logger.warn(
        `Attempt by User ${actingUserId} to assign OWNER role via invite/assign method denied for Store ${storeId}.`,
      );
      throw new BadRequestException(
        'Cannot assign OWNER role using this method. Store ownership transfer requires a different process.',
      );
    }

    // 1. Check acting user's permission and get their role
    const actingUserMembership = await this.checkStorePermission(
      actingUserId,
      storeId,
      [Role.OWNER, Role.ADMIN],
    );
    const isOwner = actingUserMembership.role === Role.OWNER;
    const isAdmin = actingUserMembership.role === Role.ADMIN;

    // 2. Enforce role hierarchy restrictions
    // ADMIN can only assign STAFF or CHEF
    if (isAdmin && !([Role.SALE, Role.CHEF] as Role[]).includes(dto.role)) {
      this.logger.warn(
        `Permission denied: ADMIN User ${actingUserId} attempted to assign restricted role ${dto.role} in Store ${storeId}.`,
      );
      throw new ForbiddenException(
        `ADMIN users can only assign STAFF or CHEF roles.`,
      );
    }
    // OWNER can assign any role (except OWNER via this method, checked above)

    // 3. Find the target user by email
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true }, // Only need the ID
    });

    if (!targetUser) {
      this.logger.warn(
        `Assign role failed: Target user with email ${dto.email} not found.`,
      );
      throw new NotFoundException(
        `No user found with email ${dto.email}. User must register first.`,
      );
      // NOTE: If you want to *invite* non-existing users, this logic needs significant change:
      // - Generate an invite token
      // - Store the pending invite (target email, role, storeId, inviterId, token, expiry)
      // - Send an email with an invite link (using EmailService)
      // - User clicks link, registers (if needed), confirms invite, then UserStore record is created.
    }

    // 4. Upsert UserStore to assign/update the role
    this.logger.log(
      `Assigning role ${dto.role} to User ID ${targetUser.id} in Store ${storeId}.`,
    );
    const userStore = await this.prisma.userStore.upsert({
      where: {
        userId_storeId: {
          userId: targetUser.id,
          storeId,
        },
      },
      update: { role: dto.role },
      create: {
        userId: targetUser.id,
        storeId,
        role: dto.role,
      },
    });

    this.logger.log(
      `Role ${dto.role} successfully assigned to User ID ${targetUser.id} in Store ID ${storeId}. Membership ID: ${userStore.id}`,
    );
    // Optional: Send notification email to the target user about their new role?
    // if (this.emailService) {
    //     await this.emailService.sendRoleAssignmentNotification(dto.email, storeName, dto.role);
    // }

    return userStore;
  }
}
