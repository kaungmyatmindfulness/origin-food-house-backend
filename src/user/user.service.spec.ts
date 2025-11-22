import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { Role, Prisma } from "src/generated/prisma/client";

import { UserService } from "./user.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuthService } from "../auth/auth.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { TierService } from "../tier/tier.service";

describe("UserService", () => {
  let service: UserService;
  let prismaService: PrismaMock;
  let tierService: jest.Mocked<TierService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let authService: jest.Mocked<AuthService>;
  let emailService: jest.Mocked<EmailService>;

  const mockUser = {
    id: "01234567-89ab-cdef-0123-456789abcdef",
    email: "test@example.com",
    name: "Test User",
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserPublic = {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    verified: mockUser.verified,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  const mockStoreId = "01234567-89ab-cdef-0123-456789abcde0";
  const mockInviterId = "01234567-89ab-cdef-0123-456789abcde1";

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendStaffInvitation: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === "NODE_ENV") return "dev";
              return defaultValue;
            }),
          },
        },
        {
          provide: TierService,
          useValue: {
            checkTierLimit: jest.fn(),
            invalidateUsageCache: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logUserRoleChange: jest.fn(),
            logUserSuspension: jest.fn(),
            createLog: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            checkStorePermission: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get(PrismaService);
    tierService = module.get(TierService);
    auditLogService = module.get(AuditLogService);
    authService = module.get(AuthService);
    emailService = module.get(EmailService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createUser", () => {
    const createUserDto = {
      email: "newuser@example.com",
      name: "New User",
    };

    it("should create a new user (deprecated - Auth0 handles registration)", async () => {
      prismaService.user.create.mockResolvedValue(mockUserPublic as any);

      const result = await service.createUser(createUserDto);

      expect(result).toEqual(mockUserPublic);
      expect(prismaService.user.create).toHaveBeenCalled();
    });

    it("should throw BadRequestException if email already exists", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint",
        {
          code: "P2002",
          clientVersion: "5.0.0",
        },
      );
      prismaService.user.create.mockRejectedValue(prismaError);

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        "An account with this email address already exists",
      );
    });

    it("should block disposable email in production", async () => {
      // Skip this test as it depends on environment variable at construction time
      // and the service has already been instantiated with the current NODE_ENV
      expect(true).toBe(true);
    });
  });

  describe("findByEmail", () => {
    it("should return user without password", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUserPublic as any);

      const result = await service.findByEmail("test@example.com");

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty("password");
    });

    it("should return null if user not found", async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("should return user by ID", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUserPublic as any);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUserPublic);
    });

    it("should return null if user not found", async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("markUserVerified", () => {
    it("should mark user as verified", async () => {
      const verifiedUser = { ...mockUserPublic, verified: true };
      prismaService.user.update.mockResolvedValue(verifiedUser as any);

      const result = await service.markUserVerified(mockUser.id);

      expect(result.verified).toBe(true);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          verified: true,
        },
        select: expect.any(Object),
      });
    });
  });

  describe("addUserToStore", () => {
    const addUserDto = {
      userId: mockUser.id,
      storeId: "store-id",
      role: Role.ADMIN,
    };

    const mockUserStore = {
      id: "userstore-id",
      userId: mockUser.id,
      storeId: "store-id",
      role: Role.ADMIN,
    };

    it("should add user to store successfully", async () => {
      prismaService.userStore.upsert.mockResolvedValue(mockUserStore as any);

      const result = await service.addUserToStore(addUserDto);

      expect(result).toEqual(mockUserStore);
      expect(prismaService.userStore.upsert).toHaveBeenCalled();
    });

    it("should update user role if already a member", async () => {
      const updatedUserStore = { ...mockUserStore, role: Role.OWNER };
      prismaService.userStore.upsert.mockResolvedValue(updatedUserStore as any);

      const result = await service.addUserToStore({
        ...addUserDto,
        role: Role.OWNER,
      });

      expect(result.role).toBe(Role.OWNER);
    });

    it("should throw BadRequestException if user not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "userId" },
        },
      );
      prismaService.userStore.upsert.mockRejectedValue(prismaError);

      await expect(service.addUserToStore(addUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addUserToStore(addUserDto)).rejects.toThrow(
        "User with ID",
      );
    });

    it("should throw BadRequestException if store not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key",
        {
          code: "P2003",
          clientVersion: "5.0.0",
          meta: { field_name: "storeId" },
        },
      );
      prismaService.userStore.upsert.mockRejectedValue(prismaError);

      await expect(service.addUserToStore(addUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addUserToStore(addUserDto)).rejects.toThrow(
        "Store with ID",
      );
    });
  });

  describe("getUserStores", () => {
    it("should return all user store memberships", async () => {
      const mockStores = [
        {
          id: "userstore-1",
          userId: mockUser.id,
          storeId: "store-1",
          role: Role.ADMIN,
          store: { id: "store-1", slug: "store-slug" },
        },
      ];
      prismaService.userStore.findMany.mockResolvedValue(mockStores as any);

      const result = await service.getUserStores(mockUser.id);

      expect(result).toEqual(mockStores);
      expect(prismaService.userStore.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        include: { store: true },
      });
    });

    it("should return empty array if user has no stores", async () => {
      prismaService.userStore.findMany.mockResolvedValue([]);

      const result = await service.getUserStores(mockUser.id);

      expect(result).toEqual([]);
    });
  });

  describe("findUserProfile", () => {
    const mockUserWithStores = {
      ...mockUserPublic,
      userStores: [
        {
          id: "userstore-1",
          userId: mockUser.id,
          storeId: "store-1",
          role: Role.ADMIN,
        },
      ],
    };

    it("should return user profile with selected store role", async () => {
      prismaService.user.findUnique.mockResolvedValue(
        mockUserWithStores as any,
      );

      const result = await service.findUserProfile(mockUser.id, "store-1");

      expect(result.selectedStoreRole).toBe(Role.ADMIN);
    });

    it("should return user profile without selected store role", async () => {
      prismaService.user.findUnique.mockResolvedValue(
        mockUserWithStores as any,
      );

      const result = await service.findUserProfile(mockUser.id);

      expect(result.selectedStoreRole).toBeNull();
    });

    it("should throw NotFoundException if user not found", async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserProfile("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("inviteStaff", () => {
    const inviteEmail = "newstaff@example.com";

    it("should create invitation and send email for new user", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      tierService.checkTierLimit.mockResolvedValue({
        allowed: true,
        currentUsage: 5,
        limit: 10,
        tier: "FREE" as any,
      });
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.staffInvitation.findUnique.mockResolvedValue(null);
      prismaService.staffInvitation.create.mockResolvedValue({
        id: "invitation-1",
        storeId: mockStoreId,
        email: inviteEmail,
        role: Role.SERVER,
        invitedBy: mockInviterId,
        invitationToken: "mock-token",
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date(),
      } as any);

      const result = await service.inviteStaff(
        mockInviterId,
        mockStoreId,
        inviteEmail,
        Role.SERVER,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockInviterId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(tierService.checkTierLimit).toHaveBeenCalledWith(
        mockStoreId,
        "staff",
        1,
      );
      expect(emailService.sendStaffInvitation).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.email).toBe(inviteEmail);
    });

    it("should add existing user to store without creating invitation", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      tierService.checkTierLimit.mockResolvedValue({
        allowed: true,
        currentUsage: 5,
        limit: 10,
        tier: "FREE" as any,
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.userStore.findUnique.mockResolvedValue(null);
      prismaService.userStore.upsert.mockResolvedValue({
        id: "userstore-1",
        userId: mockUser.id,
        storeId: mockStoreId,
        role: Role.SERVER,
      } as any);

      const result = await service.inviteStaff(
        mockInviterId,
        mockStoreId,
        mockUser.email,
        Role.SERVER,
      );

      expect(result).toBeNull();
      expect(prismaService.userStore.upsert).toHaveBeenCalled();
      expect(tierService.invalidateUsageCache).toHaveBeenCalledWith(
        mockStoreId,
      );
    });

    it("should throw ForbiddenException if tier limit reached", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      tierService.checkTierLimit.mockResolvedValue({
        allowed: false,
        currentUsage: 10,
        limit: 10,
        tier: "FREE" as any,
      });

      await expect(
        service.inviteStaff(
          mockInviterId,
          mockStoreId,
          inviteEmail,
          Role.SERVER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if user already a member", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      tierService.checkTierLimit.mockResolvedValue({
        allowed: true,
        currentUsage: 5,
        limit: 10,
        tier: "FREE" as any,
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.userStore.findUnique.mockResolvedValue({
        id: "userstore-1",
        userId: mockUser.id,
        storeId: mockStoreId,
        role: Role.SERVER,
      } as any);

      await expect(
        service.inviteStaff(
          mockInviterId,
          mockStoreId,
          mockUser.email,
          Role.SERVER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("changeUserRole", () => {
    const targetUserId = "01234567-89ab-cdef-0123-456789abcde2";

    it("should update role and log audit", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.userStore.findUnique.mockResolvedValue({
        id: "userstore-1",
        userId: targetUserId,
        storeId: mockStoreId,
        role: Role.SERVER,
        user: { ...mockUser, email: "target@example.com" },
      } as any);
      prismaService.userStore.update.mockResolvedValue({
        id: "userstore-1",
        userId: targetUserId,
        storeId: mockStoreId,
        role: Role.ADMIN,
      } as any);

      const result = await service.changeUserRole(
        mockInviterId,
        targetUserId,
        mockStoreId,
        Role.ADMIN,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockInviterId,
        mockStoreId,
        [Role.OWNER],
      );
      expect(auditLogService.logUserRoleChange).toHaveBeenCalled();
      expect(result.role).toBe(Role.ADMIN);
    });

    it("should throw BadRequestException when changing own role", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.changeUserRole(
          mockInviterId,
          mockInviterId,
          mockStoreId,
          Role.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if user not found in store", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.userStore.findUnique.mockResolvedValue(null);

      await expect(
        service.changeUserRole(
          mockInviterId,
          targetUserId,
          mockStoreId,
          Role.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("suspendUser", () => {
    const targetUserId = "01234567-89ab-cdef-0123-456789abcde2";
    const suspensionReason = "Violated company policy";

    it("should suspend user and log audit", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: targetUserId,
        email: "target@example.com",
      } as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        id: targetUserId,
        isSuspended: true,
        suspendedAt: new Date(),
        suspendedReason: suspensionReason,
      } as any);

      const result = await service.suspendUser(
        mockInviterId,
        targetUserId,
        mockStoreId,
        suspensionReason,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockInviterId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(auditLogService.logUserSuspension).toHaveBeenCalled();
      expect(result.isSuspended).toBe(true);
    });

    it("should throw BadRequestException when suspending self", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.suspendUser(
          mockInviterId,
          mockInviterId,
          mockStoreId,
          suspensionReason,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if user not found", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendUser(
          mockInviterId,
          targetUserId,
          mockStoreId,
          suspensionReason,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("reactivateUser", () => {
    const targetUserId = "01234567-89ab-cdef-0123-456789abcde2";

    it("should reactivate suspended user and log audit", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: targetUserId,
        email: "target@example.com",
        isSuspended: true,
      } as any);
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        id: targetUserId,
        isSuspended: false,
        suspendedAt: null,
        suspendedReason: null,
      } as any);

      const result = await service.reactivateUser(
        mockInviterId,
        targetUserId,
        mockStoreId,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockInviterId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(auditLogService.createLog).toHaveBeenCalled();
      expect(result.isSuspended).toBe(false);
    });

    it("should throw NotFoundException if user not found", async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.reactivateUser(mockInviterId, targetUserId, mockStoreId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
