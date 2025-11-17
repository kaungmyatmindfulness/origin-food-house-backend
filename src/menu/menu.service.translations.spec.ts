import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { MenuService } from "./menu.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuthService } from "../auth/auth.service";
import { createPrismaMock } from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";
import { TierService } from "../tier/tier.service";

describe("MenuService - Translation Management", () => {
  let service: MenuService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let authServiceMock: jest.Mocked<AuthService>;
  let auditLogServiceMock: jest.Mocked<AuditLogService>;
  let tierServiceMock: jest.Mocked<TierService>;

  const userId = "user-123";
  const storeId = "store-456";
  const itemId = "item-789";

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    authServiceMock = {
      checkStorePermission: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    auditLogServiceMock = {
      logMenuPriceChange: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    tierServiceMock = {
      trackResourceUsage: jest.fn(),
    } as unknown as jest.Mocked<TierService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: AuditLogService, useValue: auditLogServiceMock },
        { provide: TierService, useValue: tierServiceMock },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  describe("updateMenuItemTranslations", () => {
    const translations = [
      { locale: "th", name: "ผัดไทย", description: "ก๋วยเตี๋ยวผัดไทย" },
      { locale: "zh", name: "泰式炒河粉", description: "美味的泰国炒面" },
    ];

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.menuItem.findFirst.mockResolvedValue({
        id: itemId,
        storeId,
        name: "Pad Thai",
        description: "Thai stir-fried noodles",
      } as any);
    });

    it("should update menu item translations successfully", async () => {
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );

      await service.updateMenuItemTranslations(
        userId,
        storeId,
        itemId,
        translations,
      );

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.menuItem.findFirst).toHaveBeenCalledWith({
        where: { id: itemId, storeId, deletedAt: null },
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should require OWNER or ADMIN role", async () => {
      authServiceMock.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Access denied"),
      );

      await expect(
        service.updateMenuItemTranslations(
          userId,
          storeId,
          itemId,
          translations,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if menu item not found", async () => {
      prismaMock.menuItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMenuItemTranslations(
          userId,
          storeId,
          itemId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should enforce store isolation", async () => {
      prismaMock.menuItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMenuItemTranslations(
          userId,
          "wrong-store-id",
          itemId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle null descriptions in translations", async () => {
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );

      const translationsWithNull = [
        { locale: "th", name: "ผัดไทย", description: null },
      ];

      await service.updateMenuItemTranslations(
        userId,
        storeId,
        itemId,
        translationsWithNull,
      );

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe("deleteMenuItemTranslation", () => {
    const locale = "th";

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.menuItem.findFirst.mockResolvedValue({
        id: itemId,
        storeId,
      } as any);
      prismaMock.menuItemTranslation.deleteMany.mockResolvedValue({
        count: 1,
      } as any);
    });

    it("should delete menu item translation successfully", async () => {
      await service.deleteMenuItemTranslation(userId, storeId, itemId, locale);

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.menuItemTranslation.deleteMany).toHaveBeenCalledWith({
        where: { menuItemId: itemId, locale },
      });
    });

    it("should require OWNER or ADMIN role", async () => {
      authServiceMock.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Access denied"),
      );

      await expect(
        service.deleteMenuItemTranslation(userId, storeId, itemId, locale),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if menu item not found", async () => {
      prismaMock.menuItem.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteMenuItemTranslation(userId, storeId, itemId, locale),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateCustomizationGroupTranslations", () => {
    const groupId = "group-123";
    const translations = [
      { locale: "th", name: "ขนาด" },
      { locale: "zh", name: "尺寸" },
    ];

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.customizationGroup.findFirst.mockResolvedValue({
        id: groupId,
        name: "Size",
      } as any);
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );
    });

    it("should update customization group translations successfully", async () => {
      await service.updateCustomizationGroupTranslations(
        userId,
        storeId,
        groupId,
        translations,
      );

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.customizationGroup.findFirst).toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException if group not found in store", async () => {
      prismaMock.customizationGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomizationGroupTranslations(
          userId,
          storeId,
          groupId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateCustomizationOptionTranslations", () => {
    const optionId = "option-123";
    const translations = [
      { locale: "th", name: "ใหญ่" },
      { locale: "zh", name: "大" },
    ];

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.customizationOption.findFirst.mockResolvedValue({
        id: optionId,
        name: "Large",
      } as any);
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );
    });

    it("should update customization option translations successfully", async () => {
      await service.updateCustomizationOptionTranslations(
        userId,
        storeId,
        optionId,
        translations,
      );

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.customizationOption.findFirst).toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException if option not found in store", async () => {
      prismaMock.customizationOption.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomizationOptionTranslations(
          userId,
          storeId,
          optionId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
