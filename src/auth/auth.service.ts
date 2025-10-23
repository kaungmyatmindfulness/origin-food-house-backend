import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';

import { UserService } from '../user/user.service';
import { Auth0Service } from './services/auth0.service';
import { Auth0UserInfo, Auth0TokenPayload } from './types/auth0.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly JWT_EXPIRATION_TIME = '1d';

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly auth0Service: Auth0Service,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves the role of a user within a specific store.
   * Throws ForbiddenException if the user is not a member of the store.
   * @param userId - The ID (UUID) of the user.
   * @param storeId - The ID (UUID) of the store.
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
   * @param userId - The ID (UUID) of the user.
   * @param storeId - The ID (UUID) of the store.
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
   * Validates an Auth0 token and returns user information
   */
  async validateAuth0Token(token: string): Promise<Auth0TokenPayload> {
    try {
      const decoded = await this.auth0Service.validateToken(token);
      return decoded;
    } catch (error) {
      this.logger.error('Failed to validate Auth0 token', error);
      throw new UnauthorizedException('Invalid Auth0 token');
    }
  }

  /**
   * Creates or updates a user based on Auth0 information
   */
  async syncAuth0User(auth0UserInfo: Auth0UserInfo): Promise<User> {
    const { sub: auth0Id, email, email_verified, name } = auth0UserInfo;

    try {
      // Check if user exists by Auth0 ID
      let user = await this.prisma.user.findUnique({
        where: { auth0Id },
      });

      if (!user && email) {
        // Check if user exists by email
        user = await this.prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          // Update existing user with Auth0 ID
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              auth0Id,
              isEmailVerified: email_verified,
              verified: email_verified,
            },
          });
        } else {
          // Create new user
          user = await this.prisma.user.create({
            data: {
              auth0Id,
              email,
              name: name ?? email.split('@')[0],
              isEmailVerified: email_verified,
              verified: email_verified,
            },
          });
        }
      } else if (user && email_verified && !user.isEmailVerified) {
        // Update email verification status
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            isEmailVerified: email_verified,
            verified: email_verified,
          },
        });
      }

      if (!user) {
        throw new Error('Failed to sync Auth0 user');
      }

      this.logger.log(
        `Auth0 user synced successfully: ${user.email} (ID: ${user.id})`,
      );
      return user;
    } catch (error) {
      this.logger.error('Failed to sync Auth0 user', error);
      throw new InternalServerErrorException('Failed to sync user from Auth0');
    }
  }

  /**
   * Gets user information from Auth0 access token
   */
  async getAuth0UserInfo(accessToken: string): Promise<Auth0UserInfo> {
    try {
      return await this.auth0Service.getUserInfo(accessToken);
    } catch (error) {
      this.logger.error('Failed to get Auth0 user info', error);
      throw new UnauthorizedException(
        'Failed to get user information from Auth0',
      );
    }
  }

  /**
   * Generates a standard JWT for Auth0-authenticated users
   * This allows Auth0 users to work with existing JWT-based endpoints
   */
  generateJwtForAuth0User(user: User): string {
    const payload = { sub: user.id };
    this.logger.log(`Generating JWT for Auth0 user ID: ${user.id}`);
    return this.jwtService.sign(payload, {
      expiresIn: this.JWT_EXPIRATION_TIME,
    });
  }
}
