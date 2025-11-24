import { Test, TestingModule } from "@nestjs/testing";

import { Role } from "src/generated/prisma/client";

import { StoreService } from "./store.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { AuthService } from "../auth/auth.service";
import { CategoryService } from "../category/category.service";
import { S3Service } from "../common/infra/s3.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { UploadService } from "../common/upload/upload.service";
import { PrismaService } from "../prisma/prisma.service";

// Mock nanoid module
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "abc123"),
}));

// Mock the seed image processing
jest.mock("./helpers/process-seed-images.helper", () => ({
  processSeedImagesInParallel: jest.fn().mockResolvedValue(new Map()),
}));

/**
 * Integration tests for sortOrder consistency between StoreService seeding
 * and CategoryService user creation.
 *
 * These tests verify that:
 * 1. Default categories created by StoreService have sequential sortOrder (0, 1, 2)
 * 2. CategoryService calculates correct next sortOrder for user-created categories
 * 3. Both approaches are compatible (users can add categories after seeding)
 * 4. Soft-deleted items don't interfere with sortOrder calculation
 */
describe("StoreService + CategoryService Integration (sortOrder)", () => {
  let storeService: StoreService;
  let categoryService: CategoryService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = "user-123";
  const mockStoreId = "store-123";

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const mockAuthService = {
      checkStorePermission: jest.fn().mockResolvedValue(undefined),
      getUserStoreRole: jest.fn().mockResolvedValue(Role.OWNER),
    };

    const mockAuditLogService = {
      logStoreSettingChange: jest.fn().mockResolvedValue(undefined),
    };

    const mockS3Service = {
      uploadFile: jest.fn().mockResolvedValue("uploads/test-path"),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const mockUploadService = {
      uploadImage: jest.fn().mockResolvedValue({
        basePath: "uploads/test-image",
        availableSizes: ["small", "medium", "large"],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: UploadService, useValue: mockUploadService },
      ],
    }).compile();

    storeService = module.get<StoreService>(StoreService);
    categoryService = module.get<CategoryService>(CategoryService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(storeService).toBeDefined();
    expect(categoryService).toBeDefined();
  });

  describe("Default Category SortOrder (Store Seeding)", () => {
    it("should create default categories with sequential sortOrder (0, 1, 2)", async () => {
      // Mock base store creation
      prismaService.store.create.mockResolvedValue({
        id: mockStoreId,
        slug: "test-store-abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      prismaService.store.findUnique.mockResolvedValue(null); // Slug available

      // Mock transaction callback
      const mockTx = {
        userStore: {
          create: jest.fn().mockResolvedValue({
            id: "user-store-123",
            userId: mockUserId,
            storeId: mockStoreId,
            role: Role.OWNER,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        category: {
          create: jest.fn().mockImplementation((args) => {
            return Promise.resolve({
              id: `category-${args.data.sortOrder}`,
              name: args.data.name,
              storeId: mockStoreId,
              sortOrder: args.data.sortOrder, // Return the provided sortOrder
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            });
          }),
        },
        menuItem: {
          create: jest.fn().mockResolvedValue({
            id: "item-123",
            name: "Test Item",
            storeId: mockStoreId,
            sortOrder: 0,
            deletedAt: null,
          }),
        },
        table: {
          createMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        customizationGroup: {
          create: jest.fn().mockResolvedValue({
            id: "group-123",
            name: "Test Group",
            menuItemId: "item-123",
            minSelectable: 0,
            maxSelectable: 1,
            deletedAt: null,
          }),
        },
        customizationOption: {
          create: jest.fn().mockResolvedValue({
            id: "option-123",
            name: "Test Option",
            customizationGroupId: "group-123",
            additionalPrice: 0,
            sortOrder: 0,
            deletedAt: null,
          }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act
      const result = await storeService.createStore(mockUserId, {
        name: "Test Store",
        address: "123 Test St",
        phone: "123-456-7890",
        email: "test@test.com",
        website: "https://test.com",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStoreId);

      // Verify categories were created with sortOrder 0, 1, 2
      const categoryCreateCalls = mockTx.category.create.mock.calls;
      expect(categoryCreateCalls.length).toBeGreaterThanOrEqual(3);

      // Check that sortOrders are sequential
      const sortOrders = categoryCreateCalls.map(
        (call) => call[0].data.sortOrder,
      );
      expect(sortOrders).toContain(0);
      expect(sortOrders).toContain(1);
      expect(sortOrders).toContain(2);
    });
  });

  describe("User-Created Category SortOrder (CategoryService)", () => {
    it("should calculate next sortOrder correctly for first user category", async () => {
      const mockTx = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null), // No duplicate
          aggregate: jest.fn().mockResolvedValue({
            _max: { sortOrder: 2 }, // Existing max from seeding (0, 1, 2)
          }),
          create: jest.fn().mockResolvedValue({
            id: "user-category-123",
            name: "User Category",
            storeId: mockStoreId,
            sortOrder: 3, // Next sequential value
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act
      const result = await categoryService.create(mockUserId, mockStoreId, {
        name: "User Category",
      });

      // Assert
      expect(result.sortOrder).toBe(3);
      expect(mockTx.category.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: { storeId: mockStoreId, deletedAt: null },
      });
    });

    it("should return sortOrder 0 when no categories exist", async () => {
      const mockTx = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({
            _max: { sortOrder: null }, // No existing categories
          }),
          create: jest.fn().mockResolvedValue({
            id: "category-123",
            name: "First Category",
            storeId: mockStoreId,
            sortOrder: 0, // First category
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act
      const result = await categoryService.create(mockUserId, mockStoreId, {
        name: "First Category",
      });

      // Assert
      expect(result.sortOrder).toBe(0);
    });

    it("should exclude soft-deleted categories from sortOrder calculation", async () => {
      const mockTx = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({
            _max: { sortOrder: 5 }, // Max sortOrder excluding deleted items
          }),
          create: jest.fn().mockResolvedValue({
            id: "category-123",
            name: "New Category",
            storeId: mockStoreId,
            sortOrder: 6, // Next after max(5)
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act
      const result = await categoryService.create(mockUserId, mockStoreId, {
        name: "New Category",
      });

      // Assert
      expect(result.sortOrder).toBe(6);

      // Verify aggregate query excluded soft-deleted items
      expect(mockTx.category.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: { storeId: mockStoreId, deletedAt: null },
      });
    });
  });

  describe("Cross-Service Compatibility", () => {
    it("should allow users to add categories after store seeding", async () => {
      // Scenario: Store created with 3 default categories (sortOrder: 0, 1, 2)
      // User adds 2 more categories (sortOrder should be 3, 4)

      const mockTx = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _max: { sortOrder: 2 } }) // First user category
            .mockResolvedValueOnce({ _max: { sortOrder: 3 } }), // Second user category
          create: jest
            .fn()
            .mockResolvedValueOnce({
              id: "user-cat-1",
              name: "User Cat 1",
              storeId: mockStoreId,
              sortOrder: 3,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            })
            .mockResolvedValueOnce({
              id: "user-cat-2",
              name: "User Cat 2",
              storeId: mockStoreId,
              sortOrder: 4,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
            }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act - Create first user category
      const cat1 = await categoryService.create(mockUserId, mockStoreId, {
        name: "User Cat 1",
      });

      // Act - Create second user category
      const cat2 = await categoryService.create(mockUserId, mockStoreId, {
        name: "User Cat 2",
      });

      // Assert - Sequential sortOrder after seeding
      expect(cat1.sortOrder).toBe(3);
      expect(cat2.sortOrder).toBe(4);
    });
  });

  describe("RBAC Integration", () => {
    it("should verify user permissions before creating category", async () => {
      const mockTx = {
        category: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
          create: jest.fn().mockResolvedValue({
            id: "cat-123",
            name: "Test",
            storeId: mockStoreId,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        },
      };

      prismaService.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      // Act
      await categoryService.create(mockUserId, mockStoreId, {
        name: "Test Category",
      });

      // Assert - checkStorePermission was called
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
    });
  });
});
