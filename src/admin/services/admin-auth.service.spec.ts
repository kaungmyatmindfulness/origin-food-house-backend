import {
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";

import { createPrismaMock } from "src/common/testing/prisma-mock.helper";
import { AdminRole } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { AdminAuthService } from "./admin-auth.service";
import { AdminAuth0Service, AdminAuth0UserInfo } from "./admin-auth0.service";

describe("AdminAuthService", () => {
  let service: AdminAuthService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;
  let adminAuth0Service: AdminAuth0Service;

  const mockAuth0UserInfo: AdminAuth0UserInfo = {
    sub: "auth0|123456789",
    email: "admin@test.com",
    name: "Test Admin",
    email_verified: true,
  };

  const mockAdminUser = {
    id: "admin1",
    email: "admin@test.com",
    name: "Test Admin",
    auth0Id: "auth0|123456789",
    role: AdminRole.PLATFORM_ADMIN,
    isActive: true,
    lastLoginAt: new Date("2025-10-28"),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-10-28"),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const mockJwtService = {
      sign: jest.fn().mockReturnValue("mock-jwt-token"),
    };

    const mockAdminAuth0Service = {
      validateToken: jest.fn(),
      getUserInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AdminAuth0Service,
          useValue: mockAdminAuth0Service,
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    jwtService = module.get<JwtService>(JwtService);
    adminAuth0Service = module.get<AdminAuth0Service>(AdminAuth0Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateAuth0Token", () => {
    it("should validate Auth0 token successfully", async () => {
      const mockTokenPayload = {
        sub: mockAuth0UserInfo.sub,
        email: mockAuth0UserInfo.email,
        name: mockAuth0UserInfo.name,
        email_verified: true,
        aud: "https://api.admin.originfoodhouse.com",
        iss: "https://admin-originfoodhouse.auth0.com/",
        iat: 1234567890,
        exp: 1234567890,
      };

      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockResolvedValue(mockTokenPayload);

      const result = await service.validateAuth0Token("valid-token");

      expect(result).toEqual({
        sub: mockAuth0UserInfo.sub,
        email: mockAuth0UserInfo.email,
        name: mockAuth0UserInfo.name,
        email_verified: true,
      });
      expect(adminAuth0Service.validateToken).toHaveBeenCalledWith(
        "valid-token",
      );
    });

    it("should throw UnauthorizedException for invalid token", async () => {
      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockRejectedValue(new UnauthorizedException("Invalid token"));

      await expect(service.validateAuth0Token("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("syncAdminUser", () => {
    it("should update existing admin user and lastLoginAt", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const updatedAdmin = {
        ...mockAdminUser,
        lastLoginAt: new Date(),
      };

      prismaMock.adminUser.update.mockResolvedValue(updatedAdmin);

      const result = await service.syncAdminUser(mockAuth0UserInfo);

      expect(result.id).toBe(mockAdminUser.id);
      expect(prismaMock.adminUser.findUnique).toHaveBeenCalledWith({
        where: { auth0Id: mockAuth0UserInfo.sub },
      });
      expect(prismaMock.adminUser.update).toHaveBeenCalled();
    });

    it("should create new admin user with isActive=false by default", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      const newAdmin = {
        ...mockAdminUser,
        role: AdminRole.SUPPORT_AGENT,
        isActive: false,
      };

      prismaMock.adminUser.create.mockResolvedValue(newAdmin);

      const result = await service.syncAdminUser(mockAuth0UserInfo);

      expect(result.role).toBe(AdminRole.SUPPORT_AGENT);
      expect(result.isActive).toBe(false);
      expect(prismaMock.adminUser.create).toHaveBeenCalledWith({
        data: {
          email: mockAuth0UserInfo.email,
          name: mockAuth0UserInfo.name,
          auth0Id: mockAuth0UserInfo.sub,
          role: AdminRole.SUPPORT_AGENT,
          isActive: false,
          lastLoginAt: expect.any(Date),
        },
      });
    });

    it("should use email as name fallback when name is missing", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      const userInfoWithoutName = {
        ...mockAuth0UserInfo,
        name: undefined,
      };

      const newAdmin = {
        ...mockAdminUser,
        name: mockAuth0UserInfo.email,
        role: AdminRole.SUPPORT_AGENT,
        isActive: false,
      };

      prismaMock.adminUser.create.mockResolvedValue(newAdmin);

      await service.syncAdminUser(userInfoWithoutName);

      expect(prismaMock.adminUser.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: mockAuth0UserInfo.email,
        }),
      });
    });
  });

  describe("getOrCreateAdminUser", () => {
    it("should return active admin user", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      prismaMock.adminUser.update.mockResolvedValue(mockAdminUser);

      const result = await service.getOrCreateAdminUser(mockAuth0UserInfo);

      expect(result.id).toBe(mockAdminUser.id);
      expect(result.isActive).toBe(true);
    });

    it("should throw ForbiddenException for inactive admin user", async () => {
      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);
      prismaMock.adminUser.update.mockResolvedValue(inactiveAdmin);

      await expect(
        service.getOrCreateAdminUser(mockAuth0UserInfo),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getOrCreateAdminUser(mockAuth0UserInfo),
      ).rejects.toThrow("Admin account is inactive");
    });
  });

  describe("generateJwtForAdmin", () => {
    it("should generate JWT with correct payload", () => {
      const result = service.generateJwtForAdmin(mockAdminUser);

      expect(result).toBe("mock-jwt-token");
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockAdminUser.auth0Id,
        email: mockAdminUser.email,
        role: mockAdminUser.role,
        adminId: mockAdminUser.id,
      });
    });

    it("should use adminId as sub fallback when auth0Id is null", () => {
      const adminWithoutAuth0Id = {
        ...mockAdminUser,
        auth0Id: null,
      };

      service.generateJwtForAdmin(adminWithoutAuth0Id);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: adminWithoutAuth0Id.id,
        }),
      );
    });
  });

  describe("getAdminProfile", () => {
    it("should return admin profile", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const result = await service.getAdminProfile("admin1");

      expect(result.id).toBe("admin1");
      expect(result.email).toBe("admin@test.com");
      expect(prismaMock.adminUser.findUnique).toHaveBeenCalledWith({
        where: { id: "admin1" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });
    });

    it("should throw NotFoundException when admin not found", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.getAdminProfile("invalid-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getAdminPermissions", () => {
    it("should return permissions for SUPER_ADMIN", async () => {
      const superAdmin = {
        ...mockAdminUser,
        role: AdminRole.SUPER_ADMIN,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(superAdmin);

      const result = await service.getAdminPermissions("admin1");

      expect(result).toEqual(["*"]);
    });

    it("should return permissions for PLATFORM_ADMIN", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const result = await service.getAdminPermissions("admin1");

      expect(result).toContain("stores:read");
      expect(result).toContain("stores:suspend");
      expect(result).toContain("users:read");
      expect(result).toContain("payments:verify");
      expect(result.length).toBeGreaterThan(5);
    });

    it("should return permissions for SUPPORT_AGENT", async () => {
      const supportAgent = {
        ...mockAdminUser,
        role: AdminRole.SUPPORT_AGENT,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(supportAgent);

      const result = await service.getAdminPermissions("admin1");

      expect(result).toEqual([
        "stores:read",
        "users:read",
        "users:password-reset",
      ]);
    });

    it("should return permissions for FINANCE_ADMIN", async () => {
      const financeAdmin = {
        ...mockAdminUser,
        role: AdminRole.FINANCE_ADMIN,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(financeAdmin);

      const result = await service.getAdminPermissions("admin1");

      expect(result).toContain("payments:verify");
      expect(result).toContain("payments:reject");
      expect(result).toContain("audit-logs:read");
    });

    it("should return permissions for COMPLIANCE_OFFICER", async () => {
      const complianceOfficer = {
        ...mockAdminUser,
        role: AdminRole.COMPLIANCE_OFFICER,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(complianceOfficer);

      const result = await service.getAdminPermissions("admin1");

      expect(result).toContain("audit-logs:read");
      expect(result).toContain("gdpr:process");
    });

    it("should throw NotFoundException when admin not found", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.getAdminPermissions("invalid-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ForbiddenException when admin is inactive", async () => {
      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);

      await expect(service.getAdminPermissions("admin1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("getPermissionsByRole", () => {
    it("should return all permissions for SUPER_ADMIN", () => {
      const result = service.getPermissionsByRole(AdminRole.SUPER_ADMIN);
      expect(result).toEqual(["*"]);
    });

    it("should return specific permissions for each role", () => {
      const platformAdminPerms = service.getPermissionsByRole(
        AdminRole.PLATFORM_ADMIN,
      );
      const financeAdminPerms = service.getPermissionsByRole(
        AdminRole.FINANCE_ADMIN,
      );
      const supportAgentPerms = service.getPermissionsByRole(
        AdminRole.SUPPORT_AGENT,
      );
      const compliancePerms = service.getPermissionsByRole(
        AdminRole.COMPLIANCE_OFFICER,
      );

      expect(platformAdminPerms.length).toBeGreaterThan(5);
      expect(financeAdminPerms.length).toBeGreaterThan(2);
      expect(supportAgentPerms.length).toBe(3);
      expect(compliancePerms.length).toBeGreaterThan(3);
    });
  });

  describe("checkAdminRole", () => {
    it("should pass for admin with allowed role", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      await expect(
        service.checkAdminRole("admin1", [
          AdminRole.PLATFORM_ADMIN,
          AdminRole.SUPER_ADMIN,
        ]),
      ).resolves.not.toThrow();
    });

    it("should throw ForbiddenException for admin without allowed role", async () => {
      const supportAgent = {
        ...mockAdminUser,
        role: AdminRole.SUPPORT_AGENT,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(supportAgent);

      await expect(
        service.checkAdminRole("admin1", [AdminRole.PLATFORM_ADMIN]),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException when admin not found", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      await expect(
        service.checkAdminRole("invalid-id", [AdminRole.SUPER_ADMIN]),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when admin is inactive", async () => {
      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);

      await expect(
        service.checkAdminRole("admin1", [AdminRole.PLATFORM_ADMIN]),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("validateAndSyncAdmin", () => {
    it("should validate, sync, and return admin user with JWT and permissions", async () => {
      const mockTokenPayload = {
        sub: mockAuth0UserInfo.sub,
        email: mockAuth0UserInfo.email,
        name: mockAuth0UserInfo.name,
        email_verified: true,
        aud: "https://api.admin.originfoodhouse.com",
        iss: "https://admin-originfoodhouse.auth0.com/",
        iat: 1234567890,
        exp: 1234567890,
      };

      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockResolvedValue(mockTokenPayload);
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      prismaMock.adminUser.update.mockResolvedValue(mockAdminUser);

      const result = await service.validateAndSyncAdmin("valid-token");

      expect(result.adminUser.id).toBe("admin1");
      expect(result.adminUser.email).toBe("admin@test.com");
      expect(result.jwt).toBe("mock-jwt-token");
      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result.permissions).toContain("stores:read");
    });

    it("should throw ForbiddenException for inactive admin during sync", async () => {
      const mockTokenPayload = {
        sub: mockAuth0UserInfo.sub,
        email: mockAuth0UserInfo.email,
        name: mockAuth0UserInfo.name,
        email_verified: true,
        aud: "https://api.admin.originfoodhouse.com",
        iss: "https://admin-originfoodhouse.auth0.com/",
        iat: 1234567890,
        exp: 1234567890,
      };

      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockResolvedValue(mockTokenPayload);
      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);
      prismaMock.adminUser.update.mockResolvedValue(inactiveAdmin);

      await expect(service.validateAndSyncAdmin("valid-token")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw UnauthorizedException for invalid Auth0 token", async () => {
      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockRejectedValue(new UnauthorizedException("Invalid token"));

      await expect(
        service.validateAndSyncAdmin("invalid-token"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("Edge Cases", () => {
    it("should handle database errors gracefully in syncAdminUser", async () => {
      prismaMock.adminUser.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.syncAdminUser(mockAuth0UserInfo)).rejects.toThrow(
        "Database error",
      );
    });

    it("should handle missing email in Auth0 token payload", async () => {
      const tokenWithoutEmail = {
        sub: "auth0|123",
        aud: "https://api.admin.originfoodhouse.com",
        iss: "https://admin-originfoodhouse.auth0.com/",
        iat: 1234567890,
        exp: 1234567890,
      };

      jest
        .spyOn(adminAuth0Service, "validateToken")
        .mockResolvedValue(tokenWithoutEmail);

      const result = await service.validateAuth0Token("token");

      expect(result.email).toBe("");
    });
  });
});
