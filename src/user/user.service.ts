import { randomBytes } from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UserStore,
  Prisma,
  Role,
  StaffInvitation,
  User,
  AuditAction,
} from '@prisma/client';
import * as disposableDomains from 'disposable-email-domains';

import { UserProfileResponseDto } from 'src/user/dto/user-profile-response.dto';
import {
  UserPublicPayload,
  userSelectPublic,
  userSelectWithStores,
  UserWithStoresPublicPayload,
} from 'src/user/types/user-payload.types';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { TierService } from '../tier/tier.service';
import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  private readonly ALLOW_DISPOSABLE_EMAILS: boolean;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private tierService: TierService,
    private auditLogService: AuditLogService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'production');
    this.ALLOW_DISPOSABLE_EMAILS = nodeEnv === 'dev';
  }

  /**
   * @deprecated This method is deprecated. Auth0 handles user registration.
   * Creates a new user, sends verification email.
   * @throws BadRequestException if email is disposable (in production), already in use.
   * @throws InternalServerErrorException on email sending failure.
   */
  async createUser(dto: CreateUserDto): Promise<UserPublicPayload> {
    this.logger.warn(
      'createUser called - this method is deprecated. Auth0 handles registration.',
    );
    this.logger.log(`Attempting to create user with email: ${dto.email}`);

    const domain = dto.email.split('@')[1];
    if (!this.ALLOW_DISPOSABLE_EMAILS && disposableDomains.includes(domain)) {
      this.logger.warn(
        `Registration blocked for disposable email domain: ${domain}`,
      );
      throw new BadRequestException(
        'Disposable email addresses are not allowed.',
      );
    }

    let newUser: UserPublicPayload;
    try {
      newUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          verified: false,
        },
        select: userSelectPublic,
      });
      this.logger.log(`User created successfully with ID: ${newUser.id}`);
    } catch (error) {
      // Handle unique constraint violation for email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Registration failed: Email ${dto.email} already in use.`,
        );
        throw new BadRequestException(
          'An account with this email address already exists.',
        );
      }
      throw error;
    }

    return newUser;
  }

  /**
   * Finds a user by email, excluding the password. Includes store memberships.
   */
  async findByEmail(
    email: string,
  ): Promise<UserWithStoresPublicPayload | null> {
    return await this.prisma.user.findUnique({
      where: { email },
      select: userSelectWithStores,
    });
  }

  /**
   * Finds a user by ID, excluding the password. Includes store memberships.
   */
  async findById(id: string): Promise<UserWithStoresPublicPayload | null> {
    return await this.prisma.user.findUnique({
      where: { id },
      select: userSelectWithStores,
    });
  }

  /**
   * Marks a user as verified.
   * @returns Public user data.
   */
  async markUserVerified(userId: string): Promise<UserPublicPayload> {
    this.logger.log(`Marking user ID ${userId} as verified.`);
    return await this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
      },
      select: userSelectPublic,
    });
  }

  /**
   * Adds a user to a store or updates their role if already a member.
   * @throws BadRequestException if user or store not found.
   */
  async addUserToStore(dto: AddUserToStoreDto): Promise<UserStore> {
    this.logger.log(
      `Attempting to add/update User ID ${dto.userId} in Store ID ${dto.storeId} with Role ${dto.role}`,
    );

    try {
      const userStore = await this.prisma.userStore.upsert({
        where: {
          userId_storeId: { userId: dto.userId, storeId: dto.storeId },
        },
        update: { role: dto.role },
        create: {
          userId: dto.userId,
          storeId: dto.storeId,
          role: dto.role,
        },
      });

      this.logger.log(
        `User ID ${dto.userId} successfully assigned Role ${dto.role} in Store ID ${dto.storeId}. Membership ID: ${userStore.id}`,
      );
      return userStore;
    } catch (error) {
      // Handle foreign key constraint violations
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          // Foreign key constraint failed
          const target = error.meta?.field_name as string;
          if (target?.includes('userId')) {
            this.logger.warn(
              `addUserToStore failed: User ID ${dto.userId} not found.`,
            );
            throw new BadRequestException(
              `User with ID ${dto.userId} not found.`,
            );
          }
          if (target?.includes('storeId')) {
            this.logger.warn(
              `addUserToStore failed: Store ID ${dto.storeId} not found.`,
            );
            throw new BadRequestException(
              `Store with ID ${dto.storeId} not found.`,
            );
          }
        }
      }
      throw error;
    }
  }

  /**
   * Gets all store memberships (including store details) for a given user.
   */
  async getUserStores(
    userId: string,
  ): Promise<Array<UserStore & { store: Prisma.StoreGetPayload<true> }>> {
    return await this.prisma.userStore.findMany({
      where: { userId },
      include: { store: true },
    });
  }

  /**
   * Finds user profile including all store memberships and highlights the current one if ID provided.
   * Excludes password.
   * @throws NotFoundException if user not found.
   */
  async findUserProfile(
    userId: string,
    currentStoreId?: string,
  ): Promise<UserProfileResponseDto> {
    this.logger.log(
      `Fetching profile for User ID: ${userId}, Current Store ID: ${currentStoreId ?? 'None'}`,
    );

    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelectWithStores,
    });

    if (!userProfile) {
      this.logger.warn(`findUserProfile failed: User ID ${userId} not found.`);
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    let currentRole: Role | null = null;

    if (currentStoreId && userProfile.userStores) {
      const membership = userProfile.userStores.find(
        (us) => us.storeId === currentStoreId,
      );
      if (membership) {
        currentRole = membership.role;
      } else {
        this.logger.warn(
          `User ID ${userId} requested profile with Store ID ${currentStoreId}, but is not a member.`,
        );
      }
    }

    return {
      ...userProfile,
      selectedStoreRole: currentRole,
    };
  }

  /**
   * Invite a staff member to join a store
   * Creates an invitation if user doesn't exist, or directly adds existing user to store
   * @throws ForbiddenException if tier staff limit reached or insufficient permissions
   */
  async inviteStaff(
    inviterUserId: string,
    storeId: string,
    email: string,
    role: Role,
  ): Promise<StaffInvitation | null> {
    const method = this.inviteStaff.name;

    // RBAC: Only Owner/Admin can invite
    await this.authService.checkStorePermission(inviterUserId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Tier enforcement: Check staff limit
    const tierCheck = await this.tierService.checkTierLimit(
      storeId,
      'staff',
      1,
    );
    if (!tierCheck.allowed) {
      this.logger.warn(
        `[${method}] Staff limit reached for store ${storeId} (${tierCheck.tier} tier: ${tierCheck.currentUsage}/${tierCheck.limit})`,
      );
      throw new ForbiddenException(
        `Staff limit reached for your ${tierCheck.tier} tier (${tierCheck.currentUsage}/${tierCheck.limit})`,
      );
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // If user exists, check if already in store
      const existingMembership = await this.prisma.userStore.findUnique({
        where: {
          userId_storeId: { userId: existingUser.id, storeId },
        },
      });

      if (existingMembership) {
        this.logger.warn(
          `[${method}] User ${email} is already a member of store ${storeId}`,
        );
        throw new BadRequestException(
          'This user is already a member of the store',
        );
      }

      // Add user to store directly
      await this.addUserToStore({
        userId: existingUser.id,
        storeId,
        role,
      });

      this.logger.log(
        `[${method}] Existing user ${email} added to store ${storeId} with role ${role}`,
      );

      // Invalidate tier usage cache
      await this.tierService.invalidateUsageCache(storeId);

      return null; // No invitation needed
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.staffInvitation.findUnique({
      where: {
        storeId_email: { storeId, email },
      },
    });

    if (existingInvitation && !existingInvitation.acceptedAt) {
      // Update existing invitation
      const updatedInvitation = await this.prisma.staffInvitation.update({
        where: { id: existingInvitation.id },
        data: {
          role,
          invitedBy: inviterUserId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          invitationToken: randomBytes(32).toString('hex'),
        },
      });

      this.logger.log(
        `[${method}] Updated existing invitation for ${email} to store ${storeId}`,
      );

      // Send invitation email
      await this.emailService.sendStaffInvitation(
        email,
        updatedInvitation.invitationToken,
        storeId,
      );

      return updatedInvitation;
    }

    // Create new invitation (7-day expiry)
    const invitation = await this.prisma.staffInvitation.create({
      data: {
        storeId,
        email,
        role,
        invitedBy: inviterUserId,
        invitationToken: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Send invitation email
    await this.emailService.sendStaffInvitation(
      email,
      invitation.invitationToken,
      storeId,
    );

    this.logger.log(
      `[${method}] Staff invitation sent to ${email} for role ${role} in store ${storeId}`,
    );

    return invitation;
  }

  /**
   * Change a user's role within a store
   * @throws ForbiddenException if insufficient permissions
   * @throws BadRequestException if trying to change own role
   */
  async changeUserRole(
    changerUserId: string,
    targetUserId: string,
    storeId: string,
    newRole: Role,
  ): Promise<UserStore> {
    const method = this.changeUserRole.name;

    // RBAC: Only Owner can change roles
    await this.authService.checkStorePermission(changerUserId, storeId, [
      Role.OWNER,
    ]);

    // Cannot change own role
    if (changerUserId === targetUserId) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Get current role and user details for audit logging
    const userStore = await this.prisma.userStore.findUnique({
      where: { userId_storeId: { userId: targetUserId, storeId } },
      include: { user: true },
    });

    if (!userStore) {
      throw new NotFoundException('User not found in store');
    }

    const oldRole = userStore.role;

    // Update role
    const updated = await this.prisma.userStore.update({
      where: { userId_storeId: { userId: targetUserId, storeId } },
      data: { role: newRole },
    });

    // Audit log
    await this.auditLogService.logUserRoleChange(
      storeId,
      changerUserId,
      targetUserId,
      {
        targetUserEmail: userStore.user.email,
        oldRole,
        newRole,
      },
      undefined,
      undefined,
    );

    this.logger.log(
      `[${method}] User ${targetUserId} role changed from ${oldRole} to ${newRole} in store ${storeId}`,
    );

    return updated;
  }

  /**
   * Suspend a user account
   * @throws ForbiddenException if insufficient permissions
   * @throws BadRequestException if trying to suspend self
   */
  async suspendUser(
    suspenderUserId: string,
    targetUserId: string,
    storeId: string,
    reason: string,
  ): Promise<User> {
    const method = this.suspendUser.name;

    // RBAC: Only Owner/Admin can suspend
    await this.authService.checkStorePermission(suspenderUserId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Cannot suspend self
    if (suspenderUserId === targetUserId) {
      throw new BadRequestException('Cannot suspend yourself');
    }

    // Get user details
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Update user suspension fields and increment JWT version to invalidate existing tokens
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedReason: reason,
        jwtVersion: { increment: 1 }, // Invalidate all existing JWTs
      },
    });

    this.logger.log(
      `[${method}] User ${targetUserId} suspended. JWT version incremented to ${user.jwtVersion}. All existing tokens invalidated.`,
    );

    // Audit log
    await this.auditLogService.logUserSuspension(
      storeId,
      suspenderUserId,
      targetUserId,
      {
        targetUserEmail: targetUser.email,
        reason,
      },
      undefined,
      undefined,
    );

    this.logger.warn(
      `[${method}] User ${targetUserId} (${targetUser.email}) suspended by ${suspenderUserId}. Reason: ${reason}`,
    );

    return user;
  }

  /**
   * Reactivate a suspended user account
   * @throws ForbiddenException if insufficient permissions
   */
  async reactivateUser(
    reactivatorUserId: string,
    targetUserId: string,
    storeId: string,
  ): Promise<User> {
    const method = this.reactivateUser.name;

    // RBAC: Only Owner/Admin can reactivate
    await this.authService.checkStorePermission(reactivatorUserId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Get user details
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Update user
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuspended: false,
        suspendedAt: null,
        suspendedReason: null,
      },
    });

    // Audit log
    await this.auditLogService.createLog({
      storeId,
      userId: reactivatorUserId,
      action: AuditAction.USER_REACTIVATED,
      entityType: 'User',
      entityId: targetUserId,
      details: { targetUserEmail: targetUser.email },
      ipAddress: undefined,
      userAgent: undefined,
    });

    this.logger.log(
      `[${method}] User ${targetUserId} (${targetUser.email}) reactivated by ${reactivatorUserId}`,
    );

    return user;
  }
}
