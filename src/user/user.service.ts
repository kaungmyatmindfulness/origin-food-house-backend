import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as disposableDomains from 'disposable-email-domains';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User, UserStore, Prisma, Role } from '@prisma/client';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
import { CreateUserDto } from './dto/create-user.dto';
import {
  UserPublicPayload,
  userSelectPublic,
  userSelectWithStores,
  UserWithStoresPublicPayload,
} from 'src/user/types/user-payload.types';
import { UserProfileResponse } from 'src/user/types/user-profile.response';
import { UserProfileResponseDto } from 'src/user/dto/user-profile-response.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  private readonly BCRYPT_SALT_ROUNDS = 12;
  private readonly EMAIL_VERIFICATION_EXPIRY_MS = 1000 * 60 * 60 * 24;
  private readonly PASSWORD_RESET_EXPIRY_MS = 1000 * 60 * 60;
  private readonly ALLOW_DISPOSABLE_EMAILS = process.env.NODE_ENV === 'dev';

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Hashes a password using bcrypt.
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);
  }

  /**
   * Creates a new user, hashes password, sends verification email.
   * @throws BadRequestException if email is disposable (in production), already in use.
   * @throws InternalServerErrorException on email sending failure.
   */
  async createUser(dto: CreateUserDto): Promise<UserPublicPayload> {
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

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      this.logger.warn(
        `Registration failed: Email ${dto.email} already in use.`,
      );
      throw new BadRequestException(
        'An account with this email address already exists.',
      );
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(
      Date.now() + this.EMAIL_VERIFICATION_EXPIRY_MS,
    );

    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        verified: false,
        verificationToken: verificationToken,
        verificationExpiry: verificationExpiry,
      },
      select: userSelectPublic,
    });
    this.logger.log(`User created successfully with ID: ${newUser.id}`);

    try {
      await this.emailService.sendVerificationEmail(
        newUser.email,
        verificationToken,
      );
      this.logger.log(`Verification email sent to ${newUser.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${newUser.email}`,
        error,
      );

      throw new InternalServerErrorException(
        'User created, but failed to send verification email. Please contact support or try registering again later.',
      );
    }

    return newUser;
  }

  /**
   * Finds a user by email FOR AUTHENTICATION PURPOSES.
   * Includes the password hash. Should only be called by AuthService.
   * @param email User's email
   * @returns Full User object including password, or null if not found.
   */
  async findUserForAuth(email: string): Promise<User | null> {
    this.logger.verbose(`Auth lookup requested for email: ${email}`);

    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Finds a user by email, excluding the password. Includes store memberships.
   */
  async findByEmail(
    email: string,
  ): Promise<UserWithStoresPublicPayload | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: userSelectWithStores,
    });
  }

  /**
   * Finds a user by ID, excluding the password. Includes store memberships.
   */
  async findById(id: string): Promise<UserWithStoresPublicPayload | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelectWithStores,
    });
  }

  /**
   * Finds a user by ID, selecting only the password hash. Used for internal checks.
   * @throws NotFoundException if user not found.
   */
  async findPasswordById(id: string): Promise<{ password: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { password: true },
    });
    if (!user) {
      this.logger.error(
        `findPasswordById failed: User not found for ID: ${id}`,
      );
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  /**
   * Finds a user by their active email verification token.
   */
  async findByVerificationToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });
  }

  /**
   * Marks a user as verified and clears verification details.
   * @returns Public user data.
   */
  async markUserVerified(userId: string): Promise<UserPublicPayload> {
    this.logger.log(`Marking user ID ${userId} as verified.`);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verificationToken: null,
        verificationExpiry: null,
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

    const [userExists, storeExists] = await Promise.all([
      this.prisma.user.count({ where: { id: dto.userId } }),
      this.prisma.store.count({ where: { id: dto.storeId } }),
    ]);

    if (userExists === 0) {
      this.logger.warn(
        `addUserToStore failed: User ID ${dto.userId} not found.`,
      );
      throw new BadRequestException(`User with ID ${dto.userId} not found.`);
    }
    if (storeExists === 0) {
      this.logger.warn(
        `addUserToStore failed: Store ID ${dto.storeId} not found.`,
      );
      throw new BadRequestException(`Store with ID ${dto.storeId} not found.`);
    }

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
  }

  /**
   * Gets all store memberships (including store details) for a given user.
   */
  async getUserStores(
    userId: string,
  ): Promise<Array<UserStore & { store: Prisma.StoreGetPayload<true> }>> {
    return this.prisma.userStore.findMany({
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
      `Workspaceing profile for User ID: ${userId}, Current Store ID: ${currentStoreId ?? 'None'}`,
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
   * Sets the password reset token and expiry for a user.
   */
  async setResetToken(
    userId: string,
    token: string,
    expiry: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });
    this.logger.log(`Reset token set for User ID ${userId}.`);
  }

  /**
   * Finds a user by their active password reset token.
   */
  async findByResetToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        resetToken: token,
      },
    });
  }

  /**
   * Updates user password and clears reset token details atomically.
   */
  async updatePasswordAndClearResetToken(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
    this.logger.log(
      `Password updated and reset token cleared for User ID ${userId}.`,
    );
  }

  /**
   * Updates only the user's password.
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });
    this.logger.log(
      `Password updated via changePassword for User ID ${userId}.`,
    );
  }
}
