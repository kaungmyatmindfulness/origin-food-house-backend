import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";

import { AdminAuth0Service } from "./admin-auth0.service";
import { AdminAuth0Config } from "../config/admin-auth0.config";

describe("AdminAuth0Service", () => {
  let service: AdminAuth0Service;
  let configService: ConfigService;

  const mockAdminAuth0Config: AdminAuth0Config = {
    domain: "admin-test.auth0.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    audience: "https://api.admin.test.com",
    issuer: "https://admin-test.auth0.com/",
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(mockAdminAuth0Config),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuth0Service,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AdminAuth0Service>(AdminAuth0Service);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with admin Auth0 config", () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith("adminAuth0");
    });

    it("should throw error if admin Auth0 config is missing", () => {
      const mockConfigServiceWithoutConfig = {
        get: jest.fn().mockReturnValue(null),
      };

      expect(() => {
        new AdminAuth0Service(
          mockConfigServiceWithoutConfig as unknown as ConfigService,
        );
      }).toThrow("Admin Auth0 configuration is missing");
    });
  });

  describe("getConfig", () => {
    it("should return admin Auth0 configuration", () => {
      const config = service.getConfig();

      expect(config).toEqual(mockAdminAuth0Config);
    });
  });

  describe("validateToken", () => {
    it("should reject invalid tokens", async () => {
      await expect(service.validateToken("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle malformed tokens", async () => {
      await expect(service.validateToken("malformed.token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle expired tokens", async () => {
      const expiredToken =
        "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature";

      await expect(service.validateToken(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("getUserInfo", () => {
    const mockAccessToken = "valid-access-token";

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should fetch user info from Auth0", async () => {
      const mockUserInfo = {
        sub: "auth0|123",
        email: "admin@test.com",
        name: "Test Admin",
        email_verified: true,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUserInfo,
      });

      const result = await service.getUserInfo(mockAccessToken);

      expect(result).toEqual(mockUserInfo);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://${mockAdminAuth0Config.domain}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${mockAccessToken}`,
          },
        },
      );
    });

    it("should throw UnauthorizedException for invalid access token", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(service.getUserInfo("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(service.getUserInfo(mockAccessToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle non-OK HTTP responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(service.getUserInfo(mockAccessToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
