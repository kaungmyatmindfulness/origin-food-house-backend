import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as disposableDomains from 'disposable-email-domains'; // Consider making this list configurable

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger, // Added Logger
  NotFoundException,
} from '@nestjs/common';
import { User, UserStore, Prisma, Role } from '@prisma/client'; // Import Prisma types

import { EmailService } from '../email/email.service'; // Assuming path
import { PrismaService } from '../prisma.service'; // Assuming path
import { AddUserToStoreDto } from './dto/add-user-to-store.dto'; // Assuming path
import { CreateUserDto } from './dto/create-user.dto'; // Assuming path
import {
  UserPublicPayload,
  userSelectPublic,
  userSelectWithStores,
  UserWithStoresPublicPayload,
} from 'src/user/types/user-payload.types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  // --- Configuration (Ideally use ConfigService) ---
  private readonly BCRYPT_SALT_ROUNDS = 12; // Standardized salt rounds
  private readonly EMAIL_VERIFICATION_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24h
  private readonly PASSWORD_RESET_EXPIRY_MS = 1000 * 60 * 60; // 1h
  private readonly ALLOW_DISPOSABLE_EMAILS = process.env.NODE_ENV === 'dev'; // Example config check

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    // private configService: ConfigService // Optional
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

    // 1. Validate Email Domain
    const domain = dto.email.split('@')[1];
    if (!this.ALLOW_DISPOSABLE_EMAILS && disposableDomains.includes(domain)) {
      this.logger.warn(
        `Registration blocked for disposable email domain: ${domain}`,
      );
      throw new BadRequestException(
        'Disposable email addresses are not allowed.',
      );
    }

    // 2. Check Existing User
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true }, // Only need to check existence
    });
    if (existing) {
      this.logger.warn(
        `Registration failed: Email ${dto.email} already in use.`,
      );
      throw new BadRequestException(
        'An account with this email address already exists.',
      );
    }

    // 3. Hash Password
    const hashedPassword = await this.hashPassword(dto.password);

    // 4. Generate Token & Expiry
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(
      Date.now() + this.EMAIL_VERIFICATION_EXPIRY_MS,
    );

    // 5. Create User in DB
    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name, // Optional name
        verified: false,
        verificationToken: verificationToken,
        verificationExpiry: verificationExpiry,
      },
      select: userSelectPublic, // Use select to return only public fields
    });
    this.logger.log(`User created successfully with ID: ${newUser.id}`);

    // 6. Send Verification Email (handle potential errors)
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
      // Decide strategy: Should user creation fail if email fails?
      // Option A: Throw error, user needs to potentially re-register or request verification again.
      // Option B: Log error but return user (user exists but needs manual verification / resend)
      // Choosing Option A for stricter flow:
      // Optional: Could attempt to delete the created user here if email failure is critical
      // await this.prisma.user.delete({ where: { id: newUser.id }});
      throw new InternalServerErrorException(
        'User created, but failed to send verification email. Please contact support or try registering again later.',
      );
    }

    return newUser; // Return user data (without password)
  }

  /**
   * Finds a user by email FOR AUTHENTICATION PURPOSES.
   * Includes the password hash. Should only be called by AuthService.
   * @param email User's email
   * @returns Full User object including password, or null if not found.
   */
  async findUserForAuth(email: string): Promise<User | null> {
    this.logger.verbose(`Auth lookup requested for email: ${email}`);
    // No 'select' clause here, returns all fields including password
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
    // **Use the defined type**
    return this.prisma.user.findUnique({
      where: { email },
      select: userSelectWithStores, // Use the select object directly
    });
  }

  /**
   * Finds a user by ID, excluding the password. Includes store memberships.
   */
  async findById(id: number): Promise<UserWithStoresPublicPayload | null> {
    // **Use the defined type**
    return this.prisma.user.findUnique({
      where: { id },
      select: userSelectWithStores, // Use the select object directly
    });
  }

  /**
   * Finds a user by ID, selecting only the password hash. Used for internal checks.
   * @throws NotFoundException if user not found.
   */
  async findPasswordById(id: number): Promise<{ password: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { password: true },
    });
    if (!user) {
      // This should ideally not be hit if called after existence check, but safeguard anyway.
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
    // No select needed here as the full user object might be useful after verification
    return this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        // Optional: Add check for expiry > now? Maybe not, let AuthService handle expiry logic
      },
    });
  }

  /**
   * Marks a user as verified and clears verification details.
   * @returns Public user data.
   */
  async markUserVerified(userId: number): Promise<UserPublicPayload> {
    this.logger.log(`Marking user ID ${userId} as verified.`);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
      select: userSelectPublic, // Return public fields
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

    // 1. Check User and Store existence efficiently
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

    // 2. Upsert the membership
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
      // Optionally include related user/store if needed in return value
      // include: { user: { select: userSelectPublic }, store: true }
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
    userId: number,
  ): Promise<Array<UserStore & { store: Prisma.StoreGetPayload<true> }>> {
    // Type definition helps ensure store is included
    return this.prisma.userStore.findMany({
      where: { userId },
      include: { store: true }, // Include store details
    });
  }

  /**
   * Finds user profile including all store memberships and highlights the current one if ID provided.
   * Excludes password.
   * @throws NotFoundException if user not found.
   */
  async findUserProfile(userId: number, currentStoreId?: number) {
    // Consider defining a specific Profile DTO/Interface
    this.logger.log(
      `Workspaceing profile for User ID: ${userId}, Current Store ID: ${currentStoreId ?? 'None'}`,
    );

    // Use the select object defined earlier
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelectWithStores, // Includes public fields and userStores with nested store
    });

    if (!userProfile) {
      this.logger.warn(`findUserProfile failed: User ID ${userId} not found.`);
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // Find current store info from the already fetched data
    let currentStoreInfo = null;
    let currentRole: Role | null = null; // Use Role enum type

    if (currentStoreId && userProfile.userStores) {
      const membership = userProfile.userStores.find(
        (us) => us.storeId === currentStoreId,
      );
      if (membership) {
        currentStoreInfo = membership.store; // Access nested store
        currentRole = membership.role;
      } else {
        this.logger.warn(
          `User ID ${userId} requested profile with Store ID ${currentStoreId}, but is not a member.`,
        );
        // Depending on requirements, you might throw an error here or just return null for current info
      }
    }

    // Structure the final return object
    return {
      ...userProfile, // Contains id, email, name, verified, createdAt, updatedAt, userStores[]
      currentStore: currentStoreInfo,
      currentRole,
    };
  }

  /**
   * Sets the password reset token and expiry for a user.
   */
  async setResetToken(
    userId: number,
    token: string,
    expiry: Date,
  ): Promise<void> {
    // No need to return user data here
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
    // No select needed, potentially sensitive operation follows
    return this.prisma.user.findFirst({
      where: {
        resetToken: token,
        // Let AuthService validate expiry
      },
    });
  }

  /**
   * Updates user password and clears reset token details atomically.
   */
  async updatePasswordAndClearResetToken(
    userId: number,
    hashedPassword: string,
  ): Promise<void> {
    // No need to return user data
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
  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    // No need to return user data
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
