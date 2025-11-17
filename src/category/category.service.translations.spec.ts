import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";

import { CategoryService } from "./category.service";
import { AuthService } from "../auth/auth.service";
import { createPrismaMock } from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

describe("CategoryService - Translation Management", () => {
  let service: CategoryService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let authServiceMock: jest.Mocked<AuthService>;

  const userId = "user-123";
  const storeId = "store-456";
  const categoryId = "cat-789";

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    authServiceMock = {
      checkStorePermission: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe("updateCategoryTranslations", () => {
    const translations = [
      { locale: "th", name: "อาหารเรียกน้ำย่อย" },
      { locale: "zh", name: "开胃菜" },
    ];

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.category.findFirst.mockResolvedValue({
        id: categoryId,
        storeId,
        name: "Appetizers",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );
    });

    it("should update category translations successfully", async () => {
      await service.updateCategoryTranslations(
        userId,
        storeId,
        categoryId,
        translations,
      );

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
        where: { id: categoryId, storeId, deletedAt: null },
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should require OWNER or ADMIN role", async () => {
      authServiceMock.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Access denied"),
      );

      await expect(
        service.updateCategoryTranslations(
          userId,
          storeId,
          categoryId,
          translations,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if category not found", async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategoryTranslations(
          userId,
          storeId,
          categoryId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should enforce store isolation", async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCategoryTranslations(
          userId,
          "wrong-store-id",
          categoryId,
          translations,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should handle empty translations array", async () => {
      await service.updateCategoryTranslations(userId, storeId, categoryId, []);

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should upsert translations in a transaction", async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          ...prismaMock,
          categoryTranslation: {
            upsert: mockUpsert,
          },
        };
        return callback(txMock);
      });

      await service.updateCategoryTranslations(
        userId,
        storeId,
        categoryId,
        translations,
      );

      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId_locale: { categoryId, locale: "th" },
          }),
          update: { name: "อาหารเรียกน้ำย่อย" },
          create: expect.objectContaining({
            categoryId,
            locale: "th",
            name: "อาหารเรียกน้ำย่อย",
          }),
        }),
      );
    });
  });

  describe("deleteCategoryTranslation", () => {
    const locale = "th";

    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.category.findFirst.mockResolvedValue({
        id: categoryId,
        storeId,
      } as any);
      prismaMock.categoryTranslation.deleteMany.mockResolvedValue({
        count: 1,
      } as any);
    });

    it("should delete category translation successfully", async () => {
      await service.deleteCategoryTranslation(
        userId,
        storeId,
        categoryId,
        locale,
      );

      expect(authServiceMock.checkStorePermission).toHaveBeenCalledWith(
        userId,
        storeId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaMock.categoryTranslation.deleteMany).toHaveBeenCalledWith({
        where: { categoryId, locale },
      });
    });

    it("should require OWNER or ADMIN role", async () => {
      authServiceMock.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Access denied"),
      );

      await expect(
        service.deleteCategoryTranslation(userId, storeId, categoryId, locale),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if category not found", async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCategoryTranslation(userId, storeId, categoryId, locale),
      ).rejects.toThrow(NotFoundException);
    });

    it("should enforce store isolation", async () => {
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCategoryTranslation(
          userId,
          "wrong-store-id",
          categoryId,
          locale,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      authServiceMock.checkStorePermission.mockResolvedValue(undefined);
      prismaMock.category.findFirst.mockResolvedValue({
        id: categoryId,
        storeId,
        name: "Test Category",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    });

    it("should handle empty translations array", async () => {
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(prismaMock),
      );

      await service.updateCategoryTranslations(userId, storeId, categoryId, []);

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("should handle concurrent translation updates idempotently", async () => {
      const mockUpsert = jest.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          ...prismaMock,
          categoryTranslation: {
            upsert: mockUpsert,
          },
        };
        return callback(txMock);
      });

      const translations = [{ locale: "th", name: "Test" }];

      // Simulate concurrent calls
      await Promise.all([
        service.updateCategoryTranslations(
          userId,
          storeId,
          categoryId,
          translations,
        ),
        service.updateCategoryTranslations(
          userId,
          storeId,
          categoryId,
          translations,
        ),
      ]);

      // Both should succeed without conflict due to upsert
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it("should handle deletion of non-existent translation gracefully", async () => {
      prismaMock.categoryTranslation.deleteMany.mockResolvedValue({
        count: 0,
      } as any);

      // Should not throw error even if translation doesn't exist
      await expect(
        service.deleteCategoryTranslation(
          userId,
          storeId,
          categoryId,
          "nonexistent",
        ),
      ).resolves.not.toThrow();
    });
  });
});
