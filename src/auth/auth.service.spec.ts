import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { AuthService } from "./auth.service";
import { Auth0Service } from "./services/auth0.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";
import { UserService } from "../user/user.service";

describe("AuthService", () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let prismaService: PrismaMock;

  const mockUser = {
    id: "01234567-89ab-cdef-0123-456789abcdef",
    email: "test@example.com",
    password: "$2b$12$hashedpassword",
    name: "Test User",
    auth0Id: null,
    isEmailVerified: true,
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
        {
          provide: Auth0Service,
          useValue: {
            validateToken: jest.fn(),
            getUserInfo: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
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

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateAccessTokenNoStore", () => {
    it("should generate JWT token with user ID", async () => {
      const mockToken = "mock.jwt.token";
      jwtService.sign.mockReturnValue(mockToken);
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        jwtVersion: 0,
      } as any);

      const result = await service.generateAccessTokenNoStore({
        id: mockUser.id,
      });

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, jwtVersion: 0 },
        { expiresIn: "1d" },
      );
    });
  });

  describe("generateAccessTokenWithStore", () => {
    const mockMembership = {
      id: "membership-id",
      userId: mockUser.id,
      storeId: "store-id",
      role: Role.ADMIN,
      user: mockUser,
      store: {} as any,
    };

    it("should generate JWT token with store context", async () => {
      const mockToken = "mock.jwt.token";
      userService.getUserStores.mockResolvedValue([mockMembership]);
      jwtService.sign.mockReturnValue(mockToken);
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        jwtVersion: 0,
      } as any);

      const result = await service.generateAccessTokenWithStore(
        mockUser.id,
        "store-id",
      );

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, storeId: "store-id", jwtVersion: 0 },
        { expiresIn: "1d" },
      );
    });

    it("should throw NotFoundException when user has no memberships", async () => {
      userService.getUserStores.mockResolvedValue([] as any);

      await expect(
        service.generateAccessTokenWithStore(mockUser.id, "store-id"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when user is not member of specified store", async () => {
      const otherStoreMembership = {
        ...mockMembership,
        storeId: "other-store-id",
      };
      userService.getUserStores.mockResolvedValue([otherStoreMembership]);

      await expect(
        service.generateAccessTokenWithStore(mockUser.id, "store-id"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("getUserStoreRole", () => {
    it("should return user role for valid membership", async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: "membership-id",
        userId: mockUser.id,
        storeId: "store-id",
        role: Role.ADMIN,
      });

      const result = await service.getUserStoreRole(mockUser.id, "store-id");

      expect(result).toBe(Role.ADMIN);
    });

    it("should throw ForbiddenException when user is not member", async () => {
      prismaService.userStore.findUnique.mockResolvedValue(null);

      await expect(
        service.getUserStoreRole(mockUser.id, "store-id"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("checkPermission", () => {
    it("should not throw when role is authorized", () => {
      expect(() => {
        service.checkPermission(Role.ADMIN, [Role.ADMIN, Role.OWNER]);
      }).not.toThrow();
    });

    it("should throw ForbiddenException when role is not authorized", () => {
      expect(() => {
        service.checkPermission(Role.SERVER, [Role.ADMIN, Role.OWNER]);
      }).toThrow(ForbiddenException);
    });
  });

  describe("checkStorePermission", () => {
    it("should pass when user has required role", async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: "membership-id",
        userId: mockUser.id,
        storeId: "store-id",
        role: Role.OWNER,
      });

      await expect(
        service.checkStorePermission(mockUser.id, "store-id", [
          Role.OWNER,
          Role.ADMIN,
        ]),
      ).resolves.not.toThrow();
    });

    it("should throw ForbiddenException when user lacks required role", async () => {
      prismaService.userStore.findUnique.mockResolvedValue({
        id: "membership-id",
        userId: mockUser.id,
        storeId: "store-id",
        role: Role.SERVER,
      });

      await expect(
        service.checkStorePermission(mockUser.id, "store-id", [
          Role.OWNER,
          Role.ADMIN,
        ]),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
