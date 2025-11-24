import { calculateNextSortOrder } from "./sort-order.util";

describe("sort-order.util", () => {
  describe("calculateNextSortOrder", () => {
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        category: {
          aggregate: jest.fn(),
        },
        menuItem: {
          aggregate: jest.fn(),
        },
      };
    });

    it("should return 0 when no items exist (max sortOrder is null)", async () => {
      mockTx.category.aggregate.mockResolvedValue({
        _max: { sortOrder: null },
      });

      const result = await calculateNextSortOrder(mockTx, "category", {
        storeId: "store-123",
        deletedAt: null,
      });

      expect(result).toBe(0);
      expect(mockTx.category.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: { storeId: "store-123", deletedAt: null },
      });
    });

    it("should return next sequential value when items exist", async () => {
      mockTx.category.aggregate.mockResolvedValue({
        _max: { sortOrder: 5 },
      });

      const result = await calculateNextSortOrder(mockTx, "category", {
        storeId: "store-123",
        deletedAt: null,
      });

      expect(result).toBe(6);
    });

    it("should handle menuItem model correctly", async () => {
      mockTx.menuItem.aggregate.mockResolvedValue({
        _max: { sortOrder: 10 },
      });

      const result = await calculateNextSortOrder(mockTx, "menuItem", {
        storeId: "store-123",
        categoryId: "cat-456",
        deletedAt: null,
      });

      expect(result).toBe(11);
      expect(mockTx.menuItem.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: {
          storeId: "store-123",
          categoryId: "cat-456",
          deletedAt: null,
        },
      });
    });

    it("should exclude soft-deleted items when deletedAt: null in where clause", async () => {
      // Simulate max sortOrder of 3 (excluding deleted items)
      mockTx.category.aggregate.mockResolvedValue({
        _max: { sortOrder: 3 },
      });

      const result = await calculateNextSortOrder(mockTx, "category", {
        storeId: "store-123",
        deletedAt: null,
      });

      expect(result).toBe(4);
      expect(mockTx.category.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: { storeId: "store-123", deletedAt: null },
      });
    });

    it("should handle max sortOrder of 0 correctly", async () => {
      mockTx.category.aggregate.mockResolvedValue({
        _max: { sortOrder: 0 },
      });

      const result = await calculateNextSortOrder(mockTx, "category", {
        storeId: "store-123",
        deletedAt: null,
      });

      expect(result).toBe(1);
    });

    it("should throw error for invalid model name", async () => {
      await expect(
        calculateNextSortOrder(mockTx, "invalidModel", {
          storeId: "store-123",
        }),
      ).rejects.toThrow(
        'Invalid model name: "invalidModel". Model must exist in Prisma schema with aggregate support.',
      );
    });

    it("should throw error when model lacks aggregate method", async () => {
      mockTx.someModel = {}; // Model exists but no aggregate method

      await expect(
        calculateNextSortOrder(mockTx, "someModel", {
          storeId: "store-123",
        }),
      ).rejects.toThrow(
        'Invalid model name: "someModel". Model must exist in Prisma schema with aggregate support.',
      );
    });

    it("should pass complex where clauses correctly", async () => {
      mockTx.menuItem.aggregate.mockResolvedValue({
        _max: { sortOrder: 7 },
      });

      const complexWhere = {
        storeId: "store-123",
        categoryId: "cat-456",
        deletedAt: null,
        isHidden: false,
      };

      const result = await calculateNextSortOrder(
        mockTx,
        "menuItem",
        complexWhere,
      );

      expect(result).toBe(8);
      expect(mockTx.menuItem.aggregate).toHaveBeenCalledWith({
        _max: { sortOrder: true },
        where: complexWhere,
      });
    });
  });
});
