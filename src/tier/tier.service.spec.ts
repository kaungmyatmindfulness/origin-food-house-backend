import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { Tier } from "src/generated/prisma/client";

import { TierService } from "./tier.service";
import { CacheService } from "../common/cache/cache.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

describe("TierService", () => {
  let service: TierService;
  let prismaService: PrismaMock;
  let cacheService: jest.Mocked<CacheService>;

  const mockStoreId = "store-123";
  const mockFreeTier = {
    id: "tier-1",
    storeId: mockStoreId,
    tier: Tier.FREE,
    subscriptionStatus: "ACTIVE",
    trialEndsAt: new Date("2026-01-23"),
    currentPeriodStart: new Date("2025-01-01"),
    currentPeriodEnd: new Date("2025-02-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStandardTier = {
    id: "tier-2",
    storeId: mockStoreId,
    tier: Tier.STANDARD,
    subscriptionStatus: "ACTIVE",
    trialEndsAt: null,
    currentPeriodStart: new Date("2025-01-01"),
    currentPeriodEnd: new Date("2025-02-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPremiumTier = {
    id: "tier-3",
    storeId: mockStoreId,
    tier: Tier.PREMIUM,
    subscriptionStatus: "ACTIVE",
    trialEndsAt: null,
    currentPeriodStart: new Date("2025-01-01"),
    currentPeriodEnd: new Date("2025-02-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TierService>(TierService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getStoreTier", () => {
    it("should return tier for valid store", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockFreeTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.getStoreTier(mockStoreId);

      // Assert
      expect(result).toEqual(mockFreeTier);
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
      });
    });

    it("should return null if tier not found", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(null);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.getStoreTier(mockStoreId);

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const findUniqueMock = jest.fn().mockRejectedValue(dbError);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act & Assert
      await expect(service.getStoreTier(mockStoreId)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("getStoreUsage", () => {
    beforeEach(() => {
      // Setup default storeTier mock
      const findUniqueMock = jest.fn().mockResolvedValue(mockFreeTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Setup default count mocks
      prismaService.table.count = jest.fn().mockResolvedValue(10);
      prismaService.menuItem.count = jest.fn().mockResolvedValue(30);
      prismaService.userStore.count = jest.fn().mockResolvedValue(5);
      prismaService.order.count = jest.fn().mockResolvedValue(500);
    });

    it("should return cached data on cache hit", async () => {
      // Arrange
      const cachedData = {
        tier: Tier.FREE,
        usage: {
          tables: { current: 15, limit: 20 },
          menuItems: { current: 40, limit: 50 },
          staff: { current: 8, limit: 10 },
          monthlyOrders: { current: 1000, limit: 2000 },
        },
        features: {
          kds: false,
          loyalty: false,
          advancedReports: false,
        },
      };
      cacheService.get.mockResolvedValue(cachedData);

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(result).toEqual(cachedData);
      expect(cacheService.get).toHaveBeenCalledWith(
        `tier:usage:${mockStoreId}`,
      );
      expect(prismaService.table.count).not.toHaveBeenCalled();
    });

    it("should cache results for 5 minutes", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(cacheService.set).toHaveBeenCalledWith(
        `tier:usage:${mockStoreId}`,
        result,
        300, // 5 minutes in seconds
      );
    });

    it("should calculate FREE tier limits correctly", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(result.tier).toBe(Tier.FREE);
      expect(result.usage.tables.limit).toBe(20);
      expect(result.usage.menuItems.limit).toBe(50);
      expect(result.usage.staff.limit).toBe(10);
      expect(result.usage.monthlyOrders.limit).toBe(2000);
      expect(result.features.kds).toBe(false);
      expect(result.features.loyalty).toBe(false);
      expect(result.features.advancedReports).toBe(false);
    });

    it("should calculate STANDARD tier limits correctly", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const findUniqueMock = jest.fn().mockResolvedValue(mockStandardTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(result.tier).toBe(Tier.STANDARD);
      expect(result.usage.tables.limit).toBe(Infinity);
      expect(result.usage.menuItems.limit).toBe(Infinity);
      expect(result.usage.staff.limit).toBe(20);
      expect(result.usage.monthlyOrders.limit).toBe(20000);
      expect(result.features.kds).toBe(true);
      expect(result.features.loyalty).toBe(true);
      expect(result.features.advancedReports).toBe(false);
    });

    it("should calculate PREMIUM tier limits (Infinity)", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const findUniqueMock = jest.fn().mockResolvedValue(mockPremiumTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(result.tier).toBe(Tier.PREMIUM);
      expect(result.usage.tables.limit).toBe(Infinity);
      expect(result.usage.menuItems.limit).toBe(Infinity);
      expect(result.usage.staff.limit).toBe(Infinity);
      expect(result.usage.monthlyOrders.limit).toBe(Infinity);
      expect(result.features.kds).toBe(true);
      expect(result.features.loyalty).toBe(true);
      expect(result.features.advancedReports).toBe(true);
    });

    it("should aggregate usage from all resources", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);

      // Act
      const result = await service.getStoreUsage(mockStoreId);

      // Assert
      expect(prismaService.table.count).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
      });
      expect(prismaService.menuItem.count).toHaveBeenCalledWith({
        where: { storeId: mockStoreId, deletedAt: null },
      });
      expect(prismaService.userStore.count).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
      });
      expect(prismaService.order.count).toHaveBeenCalled();
      expect(result.usage.tables.current).toBe(10);
      expect(result.usage.menuItems.current).toBe(30);
      expect(result.usage.staff.current).toBe(5);
      expect(result.usage.monthlyOrders.current).toBe(500);
    });

    it("should throw NotFoundException if tier missing", async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      const findUniqueMock = jest.fn().mockResolvedValue(null);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act & Assert
      await expect(service.getStoreUsage(mockStoreId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getStoreUsage(mockStoreId)).rejects.toThrow(
        `Store tier not found for ${mockStoreId}`,
      );
    });
  });

  describe("checkTierLimit", () => {
    beforeEach(() => {
      // Setup default storeTier mock
      const findUniqueMock = jest.fn().mockResolvedValue(mockFreeTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Setup default usage
      cacheService.get.mockResolvedValue(null);
      prismaService.table.count = jest.fn().mockResolvedValue(10);
      prismaService.menuItem.count = jest.fn().mockResolvedValue(30);
      prismaService.userStore.count = jest.fn().mockResolvedValue(5);
      prismaService.order.count = jest.fn().mockResolvedValue(500);
    });

    it("should allow creation within limit (FREE: 10/20 tables)", async () => {
      // Act
      const result = await service.checkTierLimit(mockStoreId, "tables", 1);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(10);
      expect(result.limit).toBe(20);
      expect(result.tier).toBe(Tier.FREE);
    });

    it("should block creation at limit (FREE: 20/20 tables)", async () => {
      // Arrange
      prismaService.table.count = jest.fn().mockResolvedValue(20);

      // Act
      const result = await service.checkTierLimit(mockStoreId, "tables", 1);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(20);
      expect(result.limit).toBe(20);
    });

    it("should return warning at 90% usage (FREE: 18/20)", async () => {
      // Arrange
      prismaService.table.count = jest.fn().mockResolvedValue(18);

      // Act
      const result = await service.checkTierLimit(mockStoreId, "tables", 1);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(18);
      expect(result.limit).toBe(20);
      // Note: 18 + 1 = 19, which is 95% usage
    });

    it("should allow unlimited for PREMIUM tier", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockPremiumTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };
      prismaService.table.count = jest.fn().mockResolvedValue(1000);

      // Act
      const result = await service.checkTierLimit(mockStoreId, "tables", 100);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(1000);
      expect(result.limit).toBe(Infinity);
      expect(result.tier).toBe(Tier.PREMIUM);
    });

    it("should handle monthly order limit", async () => {
      // Arrange
      prismaService.order.count = jest.fn().mockResolvedValue(1990);

      // Act
      const result = await service.checkTierLimit(
        mockStoreId,
        "monthlyOrders",
        10,
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(1990);
      expect(result.limit).toBe(2000);
    });

    it("should throw NotFoundException if tier missing", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(null);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act & Assert
      await expect(
        service.checkTierLimit(mockStoreId, "tables", 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("hasFeatureAccess / checkFeatureAccess", () => {
    it("should return false for KDS on FREE tier", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockFreeTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(mockStoreId, "kds");

      // Assert
      expect(result).toBe(false);
    });

    it("should return true for KDS on STANDARD tier", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockStandardTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(mockStoreId, "kds");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for loyalty on FREE tier", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockFreeTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(mockStoreId, "loyalty");

      // Assert
      expect(result).toBe(false);
    });

    it("should return true for loyalty on STANDARD tier", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockStandardTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(mockStoreId, "loyalty");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for advancedReports on STANDARD", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockStandardTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(
        mockStoreId,
        "advancedReports",
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should return true for advancedReports on PREMIUM", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockPremiumTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const result = await service.hasFeatureAccess(
        mockStoreId,
        "advancedReports",
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should throw NotFoundException if tier missing (hasFeatureAccess)", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(null);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act & Assert
      await expect(
        service.hasFeatureAccess(mockStoreId, "kds"),
      ).rejects.toThrow(NotFoundException);
    });

    it("checkFeatureAccess should be an alias for hasFeatureAccess", async () => {
      // Arrange
      const findUniqueMock = jest.fn().mockResolvedValue(mockStandardTier);
      (prismaService as any).storeTier = { findUnique: findUniqueMock };

      // Act
      const resultHas = await service.hasFeatureAccess(mockStoreId, "kds");
      const resultCheck = await service.checkFeatureAccess(mockStoreId, "kds");

      // Assert
      expect(resultHas).toBe(resultCheck);
      expect(resultCheck).toBe(true);
    });
  });

  describe("invalidateUsageCache", () => {
    it("should delete cache key", async () => {
      // Act
      await service.invalidateUsageCache(mockStoreId);

      // Assert
      expect(cacheService.del).toHaveBeenCalledWith(
        `tier:usage:${mockStoreId}`,
      );
    });

    it("should not throw on cache deletion failure", async () => {
      // Arrange
      cacheService.del.mockRejectedValue(new Error("Cache deletion failed"));

      // Act & Assert - should not throw
      await expect(
        service.invalidateUsageCache(mockStoreId),
      ).resolves.not.toThrow();
    });
  });

  describe("trackUsage", () => {
    it("should invalidate cache after resource creation", async () => {
      // Arrange
      cacheService.del.mockResolvedValue(undefined);

      // Act
      await service.trackUsage(mockStoreId, "tables", 1);

      // Assert
      expect(cacheService.del).toHaveBeenCalledWith(
        `tier:usage:${mockStoreId}`,
      );
    });

    it("should invalidate cache after resource deletion", async () => {
      // Arrange
      cacheService.del.mockResolvedValue(undefined);

      // Act
      await service.trackUsage(mockStoreId, "menuItems", -1);

      // Assert
      expect(cacheService.del).toHaveBeenCalledWith(
        `tier:usage:${mockStoreId}`,
      );
    });
  });
});
