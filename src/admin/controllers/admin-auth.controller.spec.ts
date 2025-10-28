import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { AdminRole } from "@prisma/client";

import { createPrismaMock } from "src/common/testing/prisma-mock.helper";
import { PrismaService } from "src/prisma/prisma.service";

import { AdminAuthController } from "./admin-auth.controller";
import { ValidateAdminTokenDto } from "../dto/validate-admin-token.dto";
import { AdminAuthService } from "../services/admin-auth.service";
import { AdminAuth0Service } from "../services/admin-auth0.service";

describe("AdminAuthController (Integration)", () => {
  let controller: AdminAuthController;
  let adminAuthService: AdminAuthService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

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
      validateToken: jest.fn().mockResolvedValue({
        sub: "auth0|123456789",
        email: "admin@test.com",
        name: "Test Admin",
        email_verified: true,
        aud: "https://api.admin.test.com",
        iss: "https://admin-test.auth0.com/",
        iat: 1234567890,
        exp: 1234567890,
      }),
      getUserInfo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
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

    controller = module.get<AdminAuthController>(AdminAuthController);
    adminAuthService = module.get<AdminAuthService>(AdminAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /admin/auth/validate", () => {
    const dto: ValidateAdminTokenDto = {
      auth0Token: "valid-auth0-token",
    };

    it("should validate token and return admin user with JWT and permissions", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      prismaMock.adminUser.update.mockResolvedValue(mockAdminUser);

      const result = await controller.validateToken(dto);

      expect(result.adminUser).toBeDefined();
      expect(result.adminUser.id).toBe("admin1");
      expect(result.adminUser.email).toBe("admin@test.com");
      expect(result.jwt).toBe("mock-jwt-token");
      expect(result.permissions).toBeDefined();
      expect(result.permissions.length).toBeGreaterThan(0);
    });

    it("should create new inactive admin user on first login", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      const newInactiveAdmin = {
        ...mockAdminUser,
        role: AdminRole.SUPPORT_AGENT,
        isActive: false,
      };

      prismaMock.adminUser.create.mockResolvedValue(newInactiveAdmin);

      await expect(controller.validateToken(dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.validateToken(dto)).rejects.toThrow(
        "Admin account is inactive",
      );
    });

    it("should throw UnauthorizedException for invalid Auth0 token", async () => {
      jest
        .spyOn(adminAuthService, "validateAndSyncAdmin")
        .mockRejectedValue(new UnauthorizedException("Invalid token"));

      await expect(controller.validateToken(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should update lastLoginAt for existing admin", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);
      prismaMock.adminUser.update.mockResolvedValue({
        ...mockAdminUser,
        lastLoginAt: new Date(),
      });

      await controller.validateToken(dto);

      expect(prismaMock.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockAdminUser.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe("GET /admin/auth/profile", () => {
    it("should return admin profile", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const result = await controller.getProfile("admin1");

      expect(result.id).toBe("admin1");
      expect(result.email).toBe("admin@test.com");
      expect(result.role).toBe(AdminRole.PLATFORM_ADMIN);
    });

    it("should throw NotFoundException when admin not found", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      await expect(controller.getProfile("invalid-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("GET /admin/auth/permissions", () => {
    it("should return permissions for SUPER_ADMIN", async () => {
      const superAdmin = {
        ...mockAdminUser,
        role: AdminRole.SUPER_ADMIN,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(superAdmin);

      const result = await controller.getPermissions("admin1");

      expect(result.permissions).toEqual(["*"]);
    });

    it("should return permissions for PLATFORM_ADMIN", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(mockAdminUser);

      const result = await controller.getPermissions("admin1");

      expect(result.permissions).toContain("stores:read");
      expect(result.permissions).toContain("stores:suspend");
      expect(result.permissions).toContain("users:read");
      expect(result.permissions).toContain("payments:verify");
    });

    it("should return permissions for SUPPORT_AGENT", async () => {
      const supportAgent = {
        ...mockAdminUser,
        role: AdminRole.SUPPORT_AGENT,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(supportAgent);

      const result = await controller.getPermissions("admin1");

      expect(result.permissions).toEqual([
        "stores:read",
        "users:read",
        "users:password-reset",
      ]);
    });

    it("should throw ForbiddenException for inactive admin", async () => {
      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);

      await expect(controller.getPermissions("admin1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException when admin not found", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      await expect(controller.getPermissions("invalid-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("Role-Based Permission Tests", () => {
    it("should verify FINANCE_ADMIN has payment permissions", async () => {
      const financeAdmin = {
        ...mockAdminUser,
        role: AdminRole.FINANCE_ADMIN,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(financeAdmin);

      const result = await controller.getPermissions("admin1");

      expect(result.permissions).toContain("payments:verify");
      expect(result.permissions).toContain("payments:reject");
      expect(result.permissions).toContain("audit-logs:read");
    });

    it("should verify COMPLIANCE_OFFICER has audit and GDPR permissions", async () => {
      const complianceOfficer = {
        ...mockAdminUser,
        role: AdminRole.COMPLIANCE_OFFICER,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(complianceOfficer);

      const result = await controller.getPermissions("admin1");

      expect(result.permissions).toContain("audit-logs:read");
      expect(result.permissions).toContain("gdpr:process");
      expect(result.permissions).toContain("stores:read");
    });
  });

  describe("Security Tests", () => {
    it("should validate that inactive admins cannot get permissions", async () => {
      const inactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
      };

      prismaMock.adminUser.findUnique.mockResolvedValue(inactiveAdmin);

      await expect(controller.getPermissions("admin1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should validate that new admins start as inactive", async () => {
      prismaMock.adminUser.findUnique.mockResolvedValue(null);

      const newInactiveAdmin = {
        ...mockAdminUser,
        isActive: false,
        role: AdminRole.SUPPORT_AGENT,
      };

      prismaMock.adminUser.create.mockResolvedValue(newInactiveAdmin);

      const dto: ValidateAdminTokenDto = {
        auth0Token: "new-user-token",
      };

      await expect(controller.validateToken(dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
