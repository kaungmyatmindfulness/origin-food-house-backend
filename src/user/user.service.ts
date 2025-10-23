import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStore, Prisma, Role } from '@prisma/client';
import * as disposableDomains from 'disposable-email-domains';

import { UserProfileResponseDto } from 'src/user/dto/user-profile-response.dto';
import {
  UserPublicPayload,
  userSelectPublic,
  userSelectWithStores,
  UserWithStoresPublicPayload,
} from 'src/user/types/user-payload.types';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
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
}
