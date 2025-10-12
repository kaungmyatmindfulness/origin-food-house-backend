import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as passwordUtil from '../common/utils/password.util';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';

// Mock the password utility module
jest.mock('../common/utils/password.util');

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: PrismaMock;

  const mockUser = {
    id: '01234567-89ab-cdef-0123-456789abcdef',
    email: 'test@example.com',
    password: '$2b$12$hashedpassword',
    name: 'Test User',
    verified: true,
    verificationToken: null,
    verificationExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findUserForAuth: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findPasswordById: jest.fn(),
            findByVerificationToken: jest.fn(),
            findByResetToken: jest.fn(),
            getUserStores: jest.fn(),
            markUserVerified: jest.fn(),
            setResetToken: jest.fn(),
            updatePasswordAndClearResetToken: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    prismaService = module.get(PrismaService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      userService.findUserForAuth.mockResolvedValue(mockUser);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('password');
      expect(result?.email).toBe('test@example.com');
      expect(userService.findUserForAuth).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(passwordUtil.comparePassword).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
    });

    it('should return null when user is not found', async () => {
      userService.findUserForAuth.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(userService.findUserForAuth).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      const unverifiedUser = { ...mockUser, verified: false };
      userService.findUserForAuth.mockResolvedValue(unverifiedUser);

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return null when password does not match', async () => {
      userService.findUserForAuth.mockResolvedValue(mockUser);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('generateAccessTokenNoStore', () => {
    it('should generate JWT token with user ID', () => {
      const mockToken = 'mock.jwt.token';
      jwtService.sign.mockReturnValue(mockToken);

      const result = service.generateAccessTokenNoStore({ id: mockUser.id });

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id },
        { expiresIn: '1d' },
      );
    });
  });

  describe('generateAccessTokenWithStore', () => {
    const mockMembership = {
      id: 'membership-id',
      userId: mockUser.id,
      storeId: 'store-id',
      role: Role.ADMIN,
      user: mockUser,
      store: {} as any,
    };

    it('should generate JWT token with store context', async () => {
      const mockToken = 'mock.jwt.token';
      userService.getUserStores.mockResolvedValue([mockMembership]);
      jwtService.sign.mockReturnValue(mockToken);

      const result = await service.generateAccessTokenWithStore(
        mockUser.id,
        'store-id',
      );

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, storeId: 'store-id' },
        { expiresIn: '1d' },
      );
    });

    it('should throw NotFoundException when user has no memberships', async () => {
      userService.getUserStores.mockResolvedValue([] as any);

      await expect(
        service.generateAccessTokenWithStore(mockUser.id, 'store-id'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not member of specified store', async () => {
      const otherStoreMembership = {
        ...mockMembership,
        storeId: 'other-store-id',
      };
      userService.getUserStores.mockResolvedValue([otherStoreMembership]);

      await expect(
        service.generateAccessTokenWithStore(mockUser.id, 'store-id'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserStoreRole', () => {
    it('should return user role for valid membership', async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: mockUser.id,
        storeId: 'store-id',
        role: Role.ADMIN,
      });

      const result = await service.getUserStoreRole(mockUser.id, 'store-id');

      expect(result).toBe(Role.ADMIN);
    });

    it('should throw ForbiddenException when user is not member', async () => {
      prismaService.userStore.findUnique.mockResolvedValue(null);

      await expect(
        service.getUserStoreRole(mockUser.id, 'store-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkPermission', () => {
    it('should not throw when role is authorized', () => {
      expect(() => {
        service.checkPermission(Role.ADMIN, [Role.ADMIN, Role.OWNER]);
      }).not.toThrow();
    });

    it('should throw ForbiddenException when role is not authorized', () => {
      expect(() => {
        service.checkPermission(Role.SERVER, [Role.ADMIN, Role.OWNER]);
      }).toThrow(ForbiddenException);
    });
  });

  describe('checkStorePermission', () => {
    it('should pass when user has required role', async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: mockUser.id,
        storeId: 'store-id',
        role: Role.OWNER,
      });

      await expect(
        service.checkStorePermission(mockUser.id, 'store-id', [
          Role.OWNER,
          Role.ADMIN,
        ]),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when user lacks required role', async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: mockUser.id,
        storeId: 'store-id',
        role: Role.SERVER,
      });

      await expect(
        service.checkStorePermission(mockUser.id, 'store-id', [
          Role.OWNER,
          Role.ADMIN,
        ]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and return user', async () => {
      const userWithToken = {
        ...mockUser,
        verified: false,
        verificationToken: 'valid-token',
        verificationExpiry: new Date(Date.now() + 10000),
      };
      const verifiedUser = { ...mockUser, verified: true };
      userService.findByVerificationToken.mockResolvedValue(userWithToken);
      userService.markUserVerified.mockResolvedValue(verifiedUser as any);

      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual(userWithToken);
      expect(userService.markUserVerified).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null when token is not found', async () => {
      userService.findByVerificationToken.mockResolvedValue(null);

      const result = await service.verifyEmail('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when token is expired', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        verified: false,
        verificationToken: 'expired-token',
        verificationExpiry: new Date(Date.now() - 10000),
      };
      userService.findByVerificationToken.mockResolvedValue(
        userWithExpiredToken,
      );

      const result = await service.verifyEmail('expired-token');

      expect(result).toBeNull();
      expect(userService.markUserVerified).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for existing user', async () => {
      const mockUserWithStores = { ...mockUser, userStores: [] };
      userService.findByEmail.mockResolvedValue(mockUserWithStores as any);
      userService.setResetToken.mockResolvedValue(undefined);
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain(
        'If an account with that email address exists',
      );
      expect(result.resetInfo).toBeDefined();
      expect(result.resetInfo?.email).toBe('test@example.com');
      expect(userService.setResetToken).toHaveBeenCalled();
    });

    it('should return generic message for non-existent user', async () => {
      userService.findByEmail.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result.message).toContain(
        'If an account with that email address exists',
      );
      expect(result.resetInfo).toBeUndefined();
      expect(userService.setResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const userWithToken = {
        ...mockUser,
        resetToken: 'valid-token',
        resetTokenExpiry: new Date(Date.now() + 10000),
      };
      userService.findByResetToken.mockResolvedValue(userWithToken);
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue(
        '$2b$12$newhash',
      );
      userService.updatePasswordAndClearResetToken.mockResolvedValue(undefined);

      const result = await service.resetPassword(
        'valid-token',
        'newPassword123',
      );

      expect(result.message).toContain('reset successfully');
      expect(userService.updatePasswordAndClearResetToken).toHaveBeenCalledWith(
        mockUser.id,
        '$2b$12$newhash',
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      userService.findByResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      const userWithExpiredToken = {
        ...mockUser,
        resetToken: 'expired-token',
        resetTokenExpiry: new Date(Date.now() - 10000),
      };
      userService.findByResetToken.mockResolvedValue(userWithExpiredToken);

      await expect(
        service.resetPassword('expired-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    const mockUserWithStores = {
      ...mockUser,
      userStores: [],
    };

    it('should change password successfully', async () => {
      userService.findById.mockResolvedValue(mockUserWithStores as any);
      userService.findPasswordById.mockResolvedValue(mockUser as any);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue(
        '$2b$12$newhash',
      );
      userService.updatePassword.mockResolvedValue(undefined);

      const result = await service.changePassword(
        mockUser.id,
        'oldPassword',
        'newPassword',
      );

      expect(result.message).toContain('changed successfully');
      expect(userService.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        '$2b$12$newhash',
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword(mockUser.id, 'oldPassword', 'newPassword'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when old password is incorrect', async () => {
      userService.findById.mockResolvedValue(mockUserWithStores as any);
      userService.findPasswordById.mockResolvedValue(mockUser as any);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, 'wrongPassword', 'newPassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when new password is same as old', async () => {
      userService.findById.mockResolvedValue(mockUserWithStores as any);
      userService.findPasswordById.mockResolvedValue(mockUser as any);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(mockUser.id, 'samePassword', 'samePassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
