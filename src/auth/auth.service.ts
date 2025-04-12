import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { UserService } from '../user/user.service';
import { Role, User } from '@prisma/client'; // Import User type

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException, // Added for potential issues
  Logger,
  ForbiddenException, // Added for logging
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // --- Configuration Values (Ideally from ConfigService) ---
  // Example: Inject ConfigService in constructor: constructor(private configService: ConfigService) {}
  // Then use: this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12)
  private readonly BCRYPT_SALT_ROUNDS = 12;
  private readonly JWT_EXPIRATION_TIME = '1d'; // Matches previous cookie maxAge logic
  private readonly JWT_EXPIRATION_MS = 1000 * 60 * 60 * 24; // For potential cookie maxAge alignment
  private readonly EMAIL_VERIFICATION_EXPIRY_MS = 1000 * 60 * 60 * 24; // Example: 1 day
  private readonly PASSWORD_RESET_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService, // PrismaService for DB access
    // private configService: ConfigService, // Uncomment if using ConfigService
  ) {}

  /**
   * Retrieves the role of a user within a specific store.
   * Throws ForbiddenException if the user is not a member of the store.
   * @param userId - The ID of the user.
   * @param storeId - The ID of the store.
   * @returns The user's role in the store.
   */
  async getUserStoreRole(userId: string, storeId: string): Promise<Role> {
    const membership = await this.prisma.userStore.findUnique({
      where: { userId_storeId: { userId, storeId } },
      select: { role: true }, // Optimization: Only select the role
    });

    if (!membership) {
      // If no membership record exists, the user isn't part of the store.
      throw new ForbiddenException(
        `User (ID: ${userId}) is not a member of store (ID: ${storeId}). Access denied.`,
      );
    }
    return membership.role;
  }

  /**
   * Checks if a given role is included in the list of authorized roles.
   * Throws ForbiddenException if the role is not authorized.
   * @param currentRole - The role to check.
   * @param authorizedRoles - An array of roles that grant permission.
   * @throws {ForbiddenException} If currentRole is not in authorizedRoles.
   */
  checkPermission(currentRole: Role, authorizedRoles: Role[]): void {
    if (!authorizedRoles.includes(currentRole)) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${authorizedRoles.join(' or ')}. User role: ${currentRole}.`,
      );
    }
    // If role is included, function completes silently (permission granted)
  }

  /**
   * Convenience function combining getUserStoreRole and checkPermission.
   * Verifies if a user has one of the required roles within a specific store.
   * @param userId - The ID of the user.
   * @param storeId - The ID of the store.
   * @param authorizedRoles - An array of roles that grant permission.
   * @throws {ForbiddenException} If the user is not a member or does not have the required role.
   */
  async checkStorePermission(
    userId: string,
    storeId: string,
    authorizedRoles: Role[],
  ): Promise<void> {
    // Step 1: Get the user's role (throws if not a member)
    const currentRole = await this.getUserStoreRole(userId, storeId);

    // Step 2: Check if the fetched role has permission
    this.checkPermission(currentRole, authorizedRoles);
  }

  /**
   * Validates user credentials against the database.
   * Checks for user existence, email verification status, and password match.
   * @param email User's email
   * @param password User's raw password
   * @returns The validated User object (excluding password) or null if validation fails.
   * @throws UnauthorizedException if email is not verified.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    // ** Call the new service method that includes the password **
    const user = await this.userService.findUserForAuth(email);

    // Important: Check existence *before* verification status for security (less information leakage)
    if (!user) {
      this.logger.warn(`Validation failed: User not found for email: ${email}`);
      return null; // User not found
    }

    // Check if email is verified
    if (!user.verified) {
      this.logger.warn(
        `Validation failed: Email not verified for user ID: ${user.id}`,
      );
      throw new UnauthorizedException(
        `Please verify your email address: ${email}`,
      );
    }

    // Compare password - user.password now exists
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(
        `Validation failed: Invalid password for user ID: ${user.id}`,
      );
      return null; // Invalid password
    }

    this.logger.log(
      `User validated successfully: ${user.email} (ID: ${user.id})`,
    );

    // ** Exclude password before returning **
    const { password: _, ...result } = user;
    return result; // Return user data without password hash
  }

  /**
   * Generates a standard JWT access token without store context.
   * @param user User object (requires at least 'id')
   * @returns Signed JWT string.
   */
  generateAccessTokenNoStore(user: { id: string }): string {
    const payload = { sub: user.id };
    this.logger.log(`Generating basic access token for user ID: ${user.id}`);
    return this.jwtService.sign(payload, {
      expiresIn: this.JWT_EXPIRATION_TIME,
    });
  }

  /**
   * Generates a JWT access token including store context (storeId, role).
   * Verifies user's membership in the specified store.
   * @param userId The user's ID.
   * @param storeId The chosen store's ID.
   * @returns Signed JWT string containing user ID, store ID, and role.
   * @throws UnauthorizedException if user is not a member of the store.
   * @throws NotFoundException if user or store membership cannot be resolved.
   */
  async generateAccessTokenWithStore(
    userId: string,
    storeId: string,
  ): Promise<string> {
    this.logger.log(
      `Attempting to generate store-context token for User ID: ${userId}, Store ID: ${storeId}`,
    );
    const memberships = await this.userService.getUserStores(userId); // Reuse existing UserService method
    if (!memberships) {
      // This case might indicate an issue fetching memberships for a valid user ID
      this.logger.error(
        `Failed to retrieve store memberships for User ID: ${userId}`,
      );
      throw new NotFoundException(
        `Could not retrieve store memberships for user.`,
      );
    }

    const membership = memberships.find((m) => m.storeId === storeId);
    if (!membership) {
      this.logger.warn(
        `User ID ${userId} is not a member of Store ID ${storeId}.`,
      );
      throw new UnauthorizedException(
        `Access denied: User is not a member of the selected store (ID: ${storeId}).`,
      );
    }

    const payload = {
      sub: userId,
      storeId: membership.storeId,
    };
    this.logger.log(
      `Generating store-context access token for User ID: ${userId}, Store ID: ${storeId}, Role: ${membership.role}`,
    );
    return this.jwtService.sign(payload, {
      expiresIn: this.JWT_EXPIRATION_TIME,
    });
  }

  /**
   * Verifies an email verification token, marks the user as verified if valid.
   * @param token The verification token.
   * @returns The verified User object or null if token is invalid/expired.
   */
  async verifyEmail(token: string): Promise<User | null> {
    this.logger.log(
      `Attempting email verification with token: ${token.substring(0, 10)}...`,
    );
    const user = await this.userService.findByVerificationToken(token);

    if (!user) {
      this.logger.warn(`Email verification failed: Token not found.`);
      return null;
    }

    const now = new Date();
    if (!user.verificationExpiry || user.verificationExpiry < now) {
      this.logger.warn(
        `Email verification failed: Token expired for user ID ${user.id}. Expiry: ${user.verificationExpiry?.toISOString()}`,
      );
      // Optional: Consider deleting the expired token here or in a scheduled job
      // await this.userService.clearVerificationToken(user.id);
      return null;
    }

    await this.userService.markUserVerified(user.id);
    this.logger.log(`Email verified successfully for User ID: ${user.id}`);
    return user; // Return the now-verified user
  }

  /**
   * Initiates the password reset process: generates a token and prepares data for email sending.
   * Does not send the email itself (separation of concerns).
   * @param email User's email address.
   * @returns Object containing a success message and necessary info for email sending.
   */
  async forgotPassword(email: string): Promise<{
    message: string;
    resetInfo?: { userId: string; token: string; email: string; expiry: Date };
  }> {
    this.logger.log(`Password reset requested for email: ${email}`);
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Security: Do not reveal if the email exists in the system.
      this.logger.warn(
        `Password reset request for non-existent email: ${email}`,
      );
      return {
        message:
          'If an account with that email address exists, a password reset link has been sent.',
      };
    }

    // Proceed only if user exists
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + this.PASSWORD_RESET_EXPIRY_MS);

    try {
      await this.userService.setResetToken(user.id, token, expiry);
      this.logger.log(`Password reset token generated for User ID: ${user.id}`);

      // Return necessary info for the email sending mechanism (e.g., MailService)
      // IMPORTANT: Do NOT include the token directly in the API response payload itself.
      // The caller (e.g., controller -> mail service) should handle this info.
      return {
        message:
          'If an account with that email address exists, a password reset link has been sent.',
        resetInfo: { userId: user.id, token, email: user.email, expiry },
      };
    } catch (error) {
      this.logger.error(
        `Failed to set reset token for User ID: ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to initiate password reset. Please try again later.',
      );
    }
  }

  /**
   * Resets the user's password using a valid reset token.
   * @param token The password reset token.
   * @param newPassword The desired new password.
   * @returns Success message.
   * @throws BadRequestException if token is invalid or expired.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Attempting password reset with token: ${token.substring(0, 10)}...`,
    );
    const user = await this.userService.findByResetToken(token);

    if (!user) {
      this.logger.warn(`Password reset failed: Invalid token.`);
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      this.logger.warn(
        `Password reset failed: Token expired for User ID ${user.id}. Expiry: ${user.resetTokenExpiry?.toISOString()}`,
      );
      // Optional: Clear expired token here?
      // await this.userService.clearResetToken(user.id);
      throw new BadRequestException('Password reset token has expired.');
    }

    // Hash the new password
    const hashedPass = await this.hashPassword(newPassword);

    try {
      // Update password and clear the token atomically
      await this.userService.updatePasswordAndClearResetToken(
        user.id,
        hashedPass,
      );
      this.logger.log(`Password successfully reset for User ID: ${user.id}`);
      return {
        message:
          'Your password has been reset successfully. You can now log in.',
      };
    } catch (error) {
      this.logger.error(
        `Failed to update password/clear reset token for User ID: ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to reset password. Please try again later.',
      );
    }
  }

  /**
   * Allows a logged-in user to change their password.
   * @param userId The ID of the user changing their password.
   * @param oldPassword The user's current password.
   * @param newPassword The desired new password.
   * @returns Success message.
   * @throws NotFoundException if user not found.
   * @throws UnauthorizedException if old password doesn't match.
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Password change requested for User ID: ${userId}`);
    const user = await this.userService.findById(userId); // findById should only return essential fields ideally
    if (!user) {
      // Should generally not happen if userId comes from a validated JWT, but good practice.
      this.logger.error(
        `Password change failed: User not found for ID: ${userId}`,
      );
      throw new NotFoundException('User not found.');
    }

    // Fetch the password separately if findById doesn't include it
    const userWithPassword = await this.userService.findPasswordById(userId); // Need this method in UserService
    if (!userWithPassword) {
      this.logger.error(
        `Password change failed: Could not retrieve password for User ID: ${userId}`,
      );
      throw new InternalServerErrorException(
        'Could not verify user credentials.',
      );
    }

    const isMatch = await bcrypt.compare(
      oldPassword,
      userWithPassword.password,
    );
    if (!isMatch) {
      this.logger.warn(
        `Password change failed: Old password mismatch for User ID: ${userId}`,
      );
      throw new UnauthorizedException(
        'The current password you entered is incorrect.',
      );
    }

    if (oldPassword === newPassword) {
      this.logger.warn(
        `Password change failed: New password is the same as the old one for User ID: ${userId}`,
      );
      throw new BadRequestException(
        'New password cannot be the same as the old password.',
      );
    }

    const hashedNewPassword = await this.hashPassword(newPassword);
    await this.userService.updatePassword(userId, hashedNewPassword); // Assumes updatePassword only changes the password field

    this.logger.log(`Password changed successfully for User ID: ${userId}`);
    return { message: 'Password changed successfully.' };
  }

  // --- Private Helper Methods ---

  /**
   * Hashes a password using bcrypt.
   * @param password The plain text password.
   * @returns The hashed password string.
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);
  }
}
