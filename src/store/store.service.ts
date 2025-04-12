import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import {
  Prisma,
  Role,
  Store,
  StoreInformation,
  UserStore,
} from '@prisma/client';
import { UpdateStoreInformationDto } from 'src/store/dto/update-store-information.dto';
import slugify from 'slugify';
import { CreateStoreDto } from 'src/store/dto/create-store.dto';
import { AuthService } from 'src/auth/auth.service';
@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

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
        const slug =
          slugify(dto.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g,
          }) + `-${nanoid(6)}`;

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
            slug: slug,

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
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose information is being updated.
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
        where: { storeId: storeId },
        data: {
          name: dto.name,
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

    const targetUser = await this.prisma.user.findUnique({
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

    return userStore;
  }
}
