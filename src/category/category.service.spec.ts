import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { calculateNextSortOrder } from "src/common/utils/sort-order.util";
import { Role, Prisma } from "src/generated/prisma/client";

import { CategoryService } from "./category.service";
import { AuthService } from "../auth/auth.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

// Mock the sortOrder utility
jest.mock("src/common/utils/sort-order.util", () => ({
  calculateNextSortOrder: jest.fn(),
}));

// Type assertion for the mocked function
const mockCalculateNextSortOrder =
  calculateNextSortOrder as jest.MockedFunction<typeof calculateNextSortOrder>;

describe("CategoryService", () => {
  let service: CategoryService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = "user-123";
  const mockStoreId = "store-123";
  const mockCategoryId = "category-123";

  const mockCategory = {
    id: mockCategoryId,
    name: "Appetizers",
    storeId: mockStoreId,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    translations: [],
  };

  const mockCategoryWithItems = {
    ...mockCategory,
    menuItems: [
      {
        id: "item-123",
        name: "Spring Rolls",
        description: "Delicious spring rolls",
        basePrice: { toString: () => "9.99" },
        imagePath: undefined,
        storeId: mockStoreId,
        categoryId: mockCategoryId,
        sortOrder: 0,
        deletedAt: null,
        customizationGroups: [],
        translations: [],
      },
    ],
  };

  const mockTransaction = {
    category: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      aggregate: jest.fn(),
    },
    menuItem: {
      count: jest.fn(),
      update: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AuthService,
          useValue: {
            checkStorePermission: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const createDto = { name: "New Category" };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should create category successfully", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(null);
      // Mock the utility to return next sortOrder
      mockCalculateNextSortOrder.mockResolvedValue(6);
      mockTransaction.category.create.mockResolvedValue({
        ...mockCategory,
        name: createDto.name,
        sortOrder: 6,
      } as any);

      const result = await service.create(mockUserId, mockStoreId, createDto);

      expect(result.name).toBe(createDto.name);
      expect(result.sortOrder).toBe(6);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      // Verify utility was called with correct parameters
      expect(mockCalculateNextSortOrder).toHaveBeenCalledWith(
        mockTransaction,
        "category",
        { storeId: mockStoreId, deletedAt: null },
      );
    });

    it("should throw BadRequestException if category name already exists", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(mockCategory as any);

      await expect(
        service.create(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should check permissions before creating", async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Insufficient permissions"),
      );

      await expect(
        service.create(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should assign sortOrder 0 for first category", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(null);
      // Mock the utility to return 0 for first category
      mockCalculateNextSortOrder.mockResolvedValue(0);
      mockTransaction.category.create.mockResolvedValue({
        ...mockCategory,
        sortOrder: 0,
      } as any);

      const result = await service.create(mockUserId, mockStoreId, createDto);

      expect(result.sortOrder).toBe(0);
      // Verify utility was called
      expect(mockCalculateNextSortOrder).toHaveBeenCalledWith(
        mockTransaction,
        "category",
        { storeId: mockStoreId, deletedAt: null },
      );
    });
  });

  describe("findAll", () => {
    it("should return all categories for store by ID", async () => {
      prismaService.store.count.mockResolvedValue(1);
      prismaService.category.findMany.mockResolvedValue([mockCategory] as any);

      const result = await service.findAll({ storeId: mockStoreId }, false);

      expect(result).toEqual([
        {
          id: mockCategory.id,
          name: mockCategory.name,
          storeId: mockCategory.storeId,
          sortOrder: mockCategory.sortOrder,
          createdAt: mockCategory.createdAt,
          updatedAt: mockCategory.updatedAt,
          menuItems: [],
          translations: [],
        },
      ]);
      expect(prismaService.category.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, storeId: mockStoreId },
        include: undefined,
        orderBy: { sortOrder: "asc" },
      });
    });

    it("should return categories with menu items when includeItems is true", async () => {
      prismaService.store.count.mockResolvedValue(1);
      prismaService.category.findMany.mockResolvedValue([
        mockCategoryWithItems,
      ] as any);

      const result = await service.findAll({ storeId: mockStoreId }, true);

      expect(result).toEqual([
        {
          id: mockCategory.id,
          name: mockCategory.name,
          storeId: mockCategory.storeId,
          sortOrder: mockCategory.sortOrder,
          createdAt: mockCategory.createdAt,
          updatedAt: mockCategory.updatedAt,
          translations: [],
          menuItems: [
            {
              id: "item-123",
              name: "Spring Rolls",
              description: "Delicious spring rolls",
              basePrice: "9.99",
              imagePath: undefined,
              sortOrder: 0,
              translations: [],
              customizationGroups: [],
            },
          ],
        },
      ]);
      expect(prismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.any(Object),
        }),
      );
    });

    it("should find categories by store slug", async () => {
      prismaService.store.count.mockResolvedValue(1);
      prismaService.category.findMany.mockResolvedValue([mockCategory] as any);

      const result = await service.findAll({ storeSlug: "test-store" }, false);

      expect(result).toBeDefined();
    });

    it("should throw BadRequestException if neither storeId nor storeSlug provided", async () => {
      await expect(service.findAll({}, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw NotFoundException if store not found", async () => {
      prismaService.store.count.mockResolvedValue(0);

      await expect(
        service.findAll({ storeId: mockStoreId }, false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("should return category by ID", async () => {
      prismaService.category.findFirstOrThrow.mockResolvedValue(
        mockCategory as any,
      );

      const result = await service.findOne(mockCategoryId, mockStoreId);

      expect(result).toEqual(mockCategory);
      expect(prismaService.category.findFirstOrThrow).toHaveBeenCalledWith({
        where: {
          id: mockCategoryId,
          storeId: mockStoreId,
          deletedAt: null,
        },
      });
    });

    it("should throw NotFoundException if category not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Not found",
        {
          code: "P2025",
          clientVersion: "5.0.0",
        },
      );
      prismaService.category.findFirstOrThrow.mockRejectedValue(prismaError);

      await expect(
        service.findOne(mockCategoryId, mockStoreId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    const updateDto = { name: "Updated Category" };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should update category name successfully", async () => {
      mockTransaction.category.findFirst
        .mockResolvedValueOnce(mockCategory as any)
        .mockResolvedValueOnce(null);
      mockTransaction.category.update.mockResolvedValue({
        ...mockCategory,
        name: updateDto.name,
      } as any);

      const result = await service.update(
        mockUserId,
        mockStoreId,
        mockCategoryId,
        updateDto,
      );

      expect(result.name).toBe(updateDto.name);
      expect(mockTransaction.category.update).toHaveBeenCalledWith({
        where: { id: mockCategoryId },
        data: { name: updateDto.name },
      });
    });

    it("should throw NotFoundException if category not found", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, mockStoreId, mockCategoryId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if name conflicts with another category", async () => {
      mockTransaction.category.findFirst
        .mockResolvedValueOnce(mockCategory as any)
        .mockResolvedValueOnce({
          id: "other-category",
          name: updateDto.name,
        } as any);

      await expect(
        service.update(mockUserId, mockStoreId, mockCategoryId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should soft delete category successfully when no active menu items", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(mockCategory as any);
      mockTransaction.menuItem.count.mockResolvedValue(0);
      mockTransaction.category.update.mockResolvedValue(mockCategory as any);

      const result = await service.remove(
        mockUserId,
        mockStoreId,
        mockCategoryId,
      );

      expect(result).toEqual({ id: mockCategoryId });
      expect(mockTransaction.category.update).toHaveBeenCalledWith({
        where: { id: mockCategoryId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should throw NotFoundException if category not found", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockUserId, mockStoreId, mockCategoryId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if category has active menu items", async () => {
      mockTransaction.category.findFirst.mockResolvedValue(mockCategory as any);
      mockTransaction.menuItem.count.mockResolvedValue(5);

      await expect(
        service.remove(mockUserId, mockStoreId, mockCategoryId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.remove(mockUserId, mockStoreId, mockCategoryId),
      ).rejects.toThrow("contains 5 active menu item");
    });
  });

  describe("sortCategoriesAndMenuItems", () => {
    const sortPayload = {
      categories: [
        {
          id: "cat-1",
          sortOrder: 0,
          menuItems: [
            { id: "item-1", sortOrder: 0 },
            { id: "item-2", sortOrder: 1 },
          ],
        },
        {
          id: "cat-2",
          sortOrder: 1,
          menuItems: [],
        },
      ],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
    });

    it("should sort categories and menu items successfully", async () => {
      const validEntities = {
        categories: [{ id: "cat-1" }, { id: "cat-2" }],
        menuItems: [{ id: "item-1" }, { id: "item-2" }],
      };
      prismaService.store.findUnique.mockResolvedValue(validEntities as any);
      prismaService.$transaction.mockResolvedValue(undefined);

      const result = await service.sortCategoriesAndMenuItems(
        mockUserId,
        mockStoreId,
        sortPayload,
      );

      expect(result.message).toContain("reordered successfully");
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException if store not found", async () => {
      prismaService.store.findUnique.mockResolvedValue(null);

      await expect(
        service.sortCategoriesAndMenuItems(
          mockUserId,
          mockStoreId,
          sortPayload,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if category does not belong to store", async () => {
      const validEntities = {
        categories: [{ id: "cat-2" }], // cat-1 is missing
        menuItems: [{ id: "item-1" }, { id: "item-2" }],
      };
      prismaService.store.findUnique.mockResolvedValue(validEntities as any);

      await expect(
        service.sortCategoriesAndMenuItems(
          mockUserId,
          mockStoreId,
          sortPayload,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sortCategoriesAndMenuItems(
          mockUserId,
          mockStoreId,
          sortPayload,
        ),
      ).rejects.toThrow("does not belong to your store");
    });

    it("should throw BadRequestException if menu item does not belong to store", async () => {
      const validEntities = {
        categories: [{ id: "cat-1" }, { id: "cat-2" }],
        menuItems: [{ id: "item-2" }], // item-1 is missing
      };
      prismaService.store.findUnique.mockResolvedValue(validEntities as any);

      await expect(
        service.sortCategoriesAndMenuItems(
          mockUserId,
          mockStoreId,
          sortPayload,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should return success message if no operations needed", async () => {
      const emptyPayload = { categories: [] };
      const validEntities = {
        categories: [],
        menuItems: [],
      };
      prismaService.store.findUnique.mockResolvedValue(validEntities as any);

      const result = await service.sortCategoriesAndMenuItems(
        mockUserId,
        mockStoreId,
        emptyPayload,
      );

      expect(result.message).toContain("No categories or items to reorder");
    });
  });
});
