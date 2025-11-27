import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { getErrorDetails } from "src/common/utils/error.util";
import { Prisma, User } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { SuspensionService } from "./suspension.service";
import { ListUsersDto } from "../dto/list-users.dto";

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly suspensionService: SuspensionService,
  ) {}

  /**
   * Common include configuration for user queries with store details
   */
  private readonly userWithStoresInclude = {
    userStores: {
      include: {
        store: {
          select: {
            id: true,
            slug: true,
            information: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    },
    _count: {
      select: {
        userStores: true,
      },
    },
  } as const;

  /**
   * Lists users with pagination and filtering options.
   *
   * @param query - Pagination and filter parameters
   * @returns Paginated list of users with their store associations
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async listUsers(query: ListUsersDto): Promise<{
    data: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const method = this.listUsers.name;
    this.logger.log(
      `[${method}] Listing users with query: ${JSON.stringify(query)}`,
    );

    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const skip = (page - 1) * limit;

      const where = this.buildUserWhereClause(query);

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: this.userWithStoresInclude,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where }),
      ]);

      this.logger.log(
        `[${method}] Retrieved ${users.length} users (total: ${total})`,
      );

      return {
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to list users`,
        getErrorDetails(error).stack,
      );
      throw new InternalServerErrorException(
        "An unexpected error occurred while listing users",
      );
    }
  }

  /**
   * Builds the Prisma where clause for user queries based on filter parameters.
   *
   * @param query - Filter parameters
   * @returns Prisma where clause for user queries
   */
  private buildUserWhereClause(query: ListUsersDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.isSuspended !== undefined) {
      where.isSuspended = query.isSuspended;
    }

    if (query.storeId) {
      where.userStores = {
        some: {
          storeId: query.storeId,
        },
      };
    }

    return where;
  }

  /**
   * Retrieves detailed information for a specific user.
   *
   * @param userId - The ID of the user to retrieve
   * @returns User with store associations and counts
   * @throws {NotFoundException} If user does not exist
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async getUserDetail(userId: string): Promise<User> {
    const method = this.getUserDetail.name;
    this.logger.log(`[${method}] Fetching user detail for ${userId}`);

    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: this.userWithStoresInclude,
      });

      this.logger.log(`[${method}] User detail retrieved for ${userId}`);

      return user;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to fetch user ${userId}`,
        getErrorDetails(error).stack,
      );

      if (this.isPrismaNotFoundError(error)) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while fetching user details",
      );
    }
  }

  /**
   * Checks if an error is a Prisma not found error.
   *
   * @param error - The error to check
   * @returns True if the error is a Prisma not found error
   */
  private isPrismaNotFoundError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    );
  }

  /**
   * Suspends a user account.
   *
   * @param adminUserId - The ID of the admin performing the action
   * @param userId - The ID of the user to suspend
   * @param reason - The reason for suspension
   * @returns Result of the suspension operation
   */
  async suspendUser(
    adminUserId: string,
    userId: string,
    reason: string,
  ): Promise<User | null> {
    return await this.suspensionService.suspendUser(
      adminUserId,
      userId,
      reason,
    );
  }

  /**
   * Permanently bans a user account.
   *
   * @param adminUserId - The ID of the admin performing the action
   * @param userId - The ID of the user to ban
   * @param reason - The reason for the ban
   * @returns Result of the ban operation
   */
  async banUser(
    adminUserId: string,
    userId: string,
    reason: string,
  ): Promise<User | null> {
    return await this.suspensionService.banUser(adminUserId, userId, reason);
  }

  /**
   * Reactivates a suspended or banned user account.
   *
   * @param adminUserId - The ID of the admin performing the action
   * @param userId - The ID of the user to reactivate
   * @param note - Optional note for the reactivation
   * @returns Result of the reactivation operation
   */
  async reactivateUser(
    adminUserId: string,
    userId: string,
    note?: string,
  ): Promise<User | null> {
    return await this.suspensionService.reactivateUser(
      adminUserId,
      userId,
      note,
    );
  }

  /**
   * Forces a password reset for a user by incrementing their JWT version.
   * This invalidates all existing tokens and forces re-authentication.
   *
   * @param adminUserId - The ID of the admin performing the action
   * @param userId - The ID of the user to force password reset
   * @returns Confirmation of the password reset action
   * @throws {NotFoundException} If user does not exist
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async forcePasswordReset(
    adminUserId: string,
    userId: string,
  ): Promise<{ userId: string; message: string }> {
    const method = this.forcePasswordReset.name;
    this.logger.log(
      `[${method}] Admin ${adminUserId} forcing password reset for user ${userId}`,
    );

    try {
      await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          jwtVersion: { increment: 1 },
        },
      });

      this.logger.log(
        `[${method}] Password reset forced for user ${userId} by admin ${adminUserId}`,
      );

      return {
        userId,
        message:
          "JWT version incremented - user will be forced to re-authenticate",
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to force password reset for user ${userId}`,
        getErrorDetails(error).stack,
      );

      if (this.isPrismaNotFoundError(error)) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while forcing password reset",
      );
    }
  }

  /**
   * Retrieves activity information for a user including suspension history.
   *
   * @param userId - The ID of the user to retrieve activity for
   * @returns User activity data including suspension history and store count
   * @throws {NotFoundException} If user does not exist
   * @throws {InternalServerErrorException} On unexpected database errors
   */
  async getUserActivity(userId: string): Promise<{
    user: {
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      isSuspended: boolean;
      suspendedAt: Date | null;
    };
    storeCount: number;
    suspensionHistory: unknown[];
  }> {
    const method = this.getUserActivity.name;
    this.logger.log(`[${method}] Fetching activity for user ${userId}`);

    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      const [suspensionHistory, storeCount] = await Promise.all([
        this.prisma.userSuspension.findMany({
          where: { userId },
          include: {
            suspendedByAdmin: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            reactivatedByAdmin: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { suspendedAt: "desc" },
          take: 10,
        }),
        this.prisma.userStore.count({
          where: { userId },
        }),
      ]);

      const activity = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          isSuspended: user.isSuspended,
          suspendedAt: user.suspendedAt,
        },
        storeCount,
        suspensionHistory,
      };

      this.logger.log(`[${method}] Activity retrieved for user ${userId}`);

      return activity;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to fetch activity for user ${userId}`,
        getErrorDetails(error).stack,
      );

      if (this.isPrismaNotFoundError(error)) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      throw new InternalServerErrorException(
        "An unexpected error occurred while fetching user activity",
      );
    }
  }
}
