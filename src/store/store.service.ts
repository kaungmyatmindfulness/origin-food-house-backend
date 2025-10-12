import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  Store,
  StoreInformation,
  StoreSetting,
  UserStore,
} from '@prisma/client';
import slugify from 'slugify';

import { AuthService } from 'src/auth/auth.service';
import { CreateStoreDto } from 'src/store/dto/create-store.dto';
import { UpdateStoreInformationDto } from 'src/store/dto/update-store-information.dto';
import { UpdateStoreSettingDto } from 'src/store/dto/update-store-setting.dto';

import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { PrismaService } from '../prisma/prisma.service';

const storeWithDetailsInclude = Prisma.validator<Prisma.StoreInclude>()({
  information: true,
  setting: true,
});
type StoreWithDetailsPayload = Prisma.StoreGetPayload<{
  include: typeof storeWithDetailsInclude;
}>;

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /**
   * Retrieves PUBLIC details for a specific store, including information and settings.
   * Does not require authentication or membership.
   * @param storeId The ID (UUID) of the store to retrieve.
   * @returns The Store object with nested information and setting.
   * @throws {NotFoundException} If the store is not found.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async getStoreDetails(storeId: string): Promise<StoreWithDetailsPayload> {
    // Removed userId parameter
    const method = this.getStoreDetails.name;
    // Updated log message
    this.logger.log(
      `[${method}] Fetching public details for Store ID: ${storeId}`,
    );

    // REMOVED: Membership check (await this.checkStoreMembership(userId, storeId);)

    try {
      // Fetch store details directly by ID
      const storeDetails = await this.prisma.store.findUniqueOrThrow({
        where: { id: storeId },
        include: storeWithDetailsInclude, // Use defined include { information: true, setting: true }
      });
      // NOTE: If settings/info contain sensitive data visible only to members,
      // you might need separate public/private fetch methods or use Prisma $omit / DTO mapping.
      // Assuming information/setting are safe for public view here.
      return storeDetails;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // P2025 from findUniqueOrThrow
        this.logger.warn(`[${method}] Store ${storeId} not found.`);
        throw new NotFoundException(`Store with ID ${storeId} not found.`);
      }
      this.logger.error(
        `[${method}] Error fetching store details for ${storeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not retrieve store details.',
      );
    }
  }

  /**
   * Creates a new store with its information and assigns the creator as OWNER.
   * Handles potential slug conflicts.
   */
  async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
    this.logger.log(
      `User ${userId} attempting to create store with slug: ${dto.name}`,
    );

    try {
      const { nanoid } = await import('nanoid');
      const result = await this.prisma.$transaction(async (tx) => {
        const slug = `${slugify(dto.name, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        })}-${nanoid(6)}`;

        const existingStore = await tx.store.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existingStore) {
          throw new BadRequestException(
            `Store slug "${slug}" is already taken.`,
          );
        }

        const store = await tx.store.create({
          data: {
            slug,

            information: {
              create: {
                name: dto.name,
              },
            },

            setting: {
              create: {},
            },
          },
        });
        this.logger.log(
          `Store '${dto.name}' (ID: ${store.id}, Slug: ${store.slug}) created within transaction.`,
        );

        await tx.userStore.create({
          data: {
            userId,
            storeId: store.id,
            role: Role.OWNER,
          },
        });
        this.logger.log(
          `User ${userId} assigned as OWNER for new Store ID: ${store.id}.`,
        );

        return store;
      });
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Failed to create store with name ${dto.name}`, error);
      throw new InternalServerErrorException('Could not create store.');
    }
  }

  /**
   * Updates store information details. Requires OWNER or ADMIN role for the associated Store.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the Store whose information is being updated.
   * @param dto DTO containing the fields to update.
   * @returns The updated StoreInformation object.
   * @throws {NotFoundException} If StoreInformation for the storeId is not found.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateStoreInformation(
    userId: string,
    storeId: string,
    dto: UpdateStoreInformationDto,
  ): Promise<StoreInformation> {
    const method = this.updateStoreInformation.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update StoreInformation for Store ID: ${storeId}.`,
    );

    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      const result = await this.prisma.storeInformation.update({
        where: { storeId },
        data: {
          name: dto.name,
          logoUrl: dto.logoUrl,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          website: dto.website,
        },
      });
      this.logger.log(
        `[${method}] StoreInformation for Store ID ${storeId} updated successfully by User ${userId}.`,
      );
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreInformation for Store ID ${storeId} not found.`,
          error.meta,
        );
        throw new NotFoundException(
          `Information for store with ID ${storeId} not found. Cannot update.`,
        );
      }
      this.logger.error(
        `[${method}] Failed to update StoreInformation for Store ID ${storeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not update store information.',
      );
    }
  }

  /**
   * Updates store settings (currency, rates). Requires OWNER or ADMIN role.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose settings are being updated.
   * @param dto DTO containing the fields to update.
   * @returns The updated StoreSetting object.
   * @throws {NotFoundException} If StoreSetting for the storeId is not found.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateStoreSettings(
    userId: string,
    storeId: string,
    dto: UpdateStoreSettingDto,
  ): Promise<StoreSetting> {
    const method = this.updateStoreSettings.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update StoreSetting for Store ID: ${storeId}.`,
    );

    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      const updatedSettings = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          currency: dto.currency,
          vatRate: dto.vatRate,
          serviceChargeRate: dto.serviceChargeRate,
        },
      });

      this.logger.log(
        `[${method}] StoreSetting for Store ID ${storeId} updated successfully by User ${userId}.`,
      );
      return updatedSettings;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreSetting for Store ID ${storeId} not found. Ensure settings were created with the store.`,
          error.meta,
        );
        throw new NotFoundException(
          `Settings for store with ID ${storeId} not found. Cannot update.`,
        );
      }

      this.logger.error(
        `[${method}] Failed to update StoreSetting for Store ID ${storeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not update store settings.',
      );
    }
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
    actingUserId: string,
    storeId: string,
    dto: InviteOrAssignRoleDto,
  ): Promise<UserStore> {
    this.logger.log(
      `User ${actingUserId} attempting to assign role ${dto.role} to email ${dto.email} in Store ${storeId}.`,
    );

    if (dto.role === Role.OWNER) {
      this.logger.warn(
        `Attempt by User ${actingUserId} to assign OWNER role via invite/assign method denied for Store ${storeId}.`,
      );
      throw new BadRequestException(
        'Cannot assign OWNER role using this method. Store ownership transfer requires a different process.',
      );
    }

    const actingUserMembership = await this.authService.getUserStoreRole(
      actingUserId,
      storeId,
    );
    const isOwner = actingUserMembership === Role.OWNER;

    if (!isOwner) {
      this.logger.warn(
        `Permission denied: User ${actingUserId} lacks OWNER role in Store ${storeId}.`,
      );
      throw new ForbiddenException(
        `You do not have permission to assign roles in Store ${storeId}.`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        });

        if (!targetUser) {
          this.logger.warn(
            `Assign role failed: Target user with email ${dto.email} not found.`,
          );
          throw new NotFoundException(
            `No user found with email ${dto.email}. User must register first.`,
          );
        }

        this.logger.log(
          `Assigning role ${dto.role} to User ID ${targetUser.id} in Store ${storeId}.`,
        );
        const userStore = await tx.userStore.upsert({
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

        return userStore;
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to assign role ${dto.role} to email ${dto.email} in Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not assign role to user.');
    }
  }
}
