import { InternalServerErrorException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { Decimal } from "src/common/types/decimal.type";
import { OrderStatus, PaymentMethod } from "src/generated/prisma/client";

import { ReportService } from "./report.service";
import { CacheService } from "../common/cache/cache.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

describe("ReportService", () => {
  let service: ReportService;
  let prismaService: PrismaMock;

  const mockStoreId = "store-123";
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-01-31");

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getSalesSummary", () => {
    describe("successful report generation", () => {
      it("should calculate total sales with Decimal precision", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("1250.75"),
            vatAmount: new Decimal("87.55"),
            serviceChargeAmount: new Decimal("62.54"),
          },
          _count: 50,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        const result = await service.getSalesSummary(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.totalSales).toBeInstanceOf(Decimal);
        expect(result.totalSales.toString()).toBe("1250.75");
        expect(result.orderCount).toBe(50);
        expect(result.totalVat.toString()).toBe("87.55");
        expect(result.totalServiceCharge.toString()).toBe("62.54");
      });

      it("should calculate average order value correctly", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("1000.00"),
            vatAmount: new Decimal("70.00"),
            serviceChargeAmount: new Decimal("50.00"),
          },
          _count: 20,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        const result = await service.getSalesSummary(
          mockStoreId,
          startDate,
          endDate,
        );

        // 1000.00 / 20 = 50.00
        expect(result.averageOrderValue).toBeInstanceOf(Decimal);
        expect(result.averageOrderValue.toString()).toBe("50");
      });

      it("should return date range in response", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("500.00"),
            vatAmount: new Decimal("35.00"),
            serviceChargeAmount: new Decimal("25.00"),
          },
          _count: 10,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        const result = await service.getSalesSummary(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.startDate).toEqual(startDate);
        expect(result.endDate).toEqual(endDate);
      });
    });

    describe("empty result handling", () => {
      it("should handle empty results with zero values", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: null,
            vatAmount: null,
            serviceChargeAmount: null,
          },
          _count: 0,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        const result = await service.getSalesSummary(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.totalSales.toString()).toBe("0");
        expect(result.orderCount).toBe(0);
        expect(result.averageOrderValue.toString()).toBe("0");
        expect(result.totalVat.toString()).toBe("0");
        expect(result.totalServiceCharge.toString()).toBe("0");
      });

      it("should set average to zero when no orders exist", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: null,
            vatAmount: null,
            serviceChargeAmount: null,
          },
          _count: 0,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        const result = await service.getSalesSummary(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.averageOrderValue.toString()).toBe("0");
      });
    });

    describe("store isolation", () => {
      it("should filter by storeId", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("100.00"),
            vatAmount: new Decimal("7.00"),
            serviceChargeAmount: new Decimal("5.00"),
          },
          _count: 5,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        await service.getSalesSummary(mockStoreId, startDate, endDate);

        expect(prismaService.order.aggregate).toHaveBeenCalledWith({
          where: expect.objectContaining({ storeId: mockStoreId }),
          _sum: expect.any(Object),
          _count: true,
        });
      });

      it("should only include COMPLETED orders", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("100.00"),
            vatAmount: new Decimal("7.00"),
            serviceChargeAmount: new Decimal("5.00"),
          },
          _count: 5,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        await service.getSalesSummary(mockStoreId, startDate, endDate);

        expect(prismaService.order.aggregate).toHaveBeenCalledWith({
          where: expect.objectContaining({ status: OrderStatus.COMPLETED }),
          _sum: expect.any(Object),
          _count: true,
        });
      });

      it("should filter by date range", async () => {
        const aggregationResult = {
          _sum: {
            grandTotal: new Decimal("100.00"),
            vatAmount: new Decimal("7.00"),
            serviceChargeAmount: new Decimal("5.00"),
          },
          _count: 5,
        };

        prismaService.order.aggregate.mockResolvedValue(aggregationResult);

        await service.getSalesSummary(mockStoreId, startDate, endDate);

        expect(prismaService.order.aggregate).toHaveBeenCalledWith({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
          _sum: expect.any(Object),
          _count: true,
        });
      });
    });

    describe("error handling", () => {
      it("should throw InternalServerErrorException on database error", async () => {
        prismaService.order.aggregate.mockRejectedValue(
          new Error("Database connection failed"),
        );

        await expect(
          service.getSalesSummary(mockStoreId, startDate, endDate),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it("should throw InternalServerErrorException with generic message", async () => {
        prismaService.order.aggregate.mockRejectedValue(
          new Error("Unexpected error"),
        );

        await expect(
          service.getSalesSummary(mockStoreId, startDate, endDate),
        ).rejects.toThrow("Failed to generate sales summary");
      });
    });
  });

  describe("getPaymentBreakdown", () => {
    describe("successful report generation", () => {
      it("should aggregate payments by method", async () => {
        const groupedPayments = [
          {
            paymentMethod: PaymentMethod.CASH,
            _sum: { amount: new Decimal("500.00") },
            _count: 20,
          },
          {
            paymentMethod: PaymentMethod.CREDIT_CARD,
            _sum: { amount: new Decimal("750.00") },
            _count: 30,
          },
          {
            paymentMethod: PaymentMethod.MOBILE_PAYMENT,
            _sum: { amount: new Decimal("250.00") },
            _count: 10,
          },
        ];

        prismaService.payment.groupBy = jest
          .fn()
          .mockResolvedValue(groupedPayments);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.breakdown).toHaveLength(3);
        expect(result.breakdown[0].paymentMethod).toBe(
          PaymentMethod.CREDIT_CARD,
        );
        expect(result.breakdown[0].totalAmount.toFixed(2)).toBe("750.00");
        expect(result.breakdown[1].paymentMethod).toBe(PaymentMethod.CASH);
        expect(result.breakdown[1].totalAmount.toFixed(2)).toBe("500.00");
        expect(result.breakdown[2].paymentMethod).toBe(
          PaymentMethod.MOBILE_PAYMENT,
        );
        expect(result.breakdown[2].totalAmount.toFixed(2)).toBe("250.00");
      });

      it("should calculate percentages correctly", async () => {
        const groupedPayments = [
          {
            paymentMethod: PaymentMethod.CASH,
            _sum: { amount: new Decimal("600.00") },
            _count: 20,
          },
          {
            paymentMethod: PaymentMethod.CREDIT_CARD,
            _sum: { amount: new Decimal("400.00") },
            _count: 15,
          },
        ];

        prismaService.payment.groupBy = jest
          .fn()
          .mockResolvedValue(groupedPayments);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        // Total = 1000, CASH = 600 (60%), CARD = 400 (40%)
        expect(result.breakdown[0].percentage).toBe(60.0);
        expect(result.breakdown[1].percentage).toBe(40.0);
      });

      it("should sort breakdown by total amount descending", async () => {
        const groupedPayments = [
          {
            paymentMethod: PaymentMethod.CASH,
            _sum: { amount: new Decimal("100.00") },
            _count: 5,
          },
          {
            paymentMethod: PaymentMethod.CREDIT_CARD,
            _sum: { amount: new Decimal("900.00") },
            _count: 30,
          },
          {
            paymentMethod: PaymentMethod.MOBILE_PAYMENT,
            _sum: { amount: new Decimal("500.00") },
            _count: 15,
          },
        ];

        prismaService.payment.groupBy = jest
          .fn()
          .mockResolvedValue(groupedPayments);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.breakdown[0].totalAmount.toFixed(2)).toBe("900.00");
        expect(result.breakdown[1].totalAmount.toFixed(2)).toBe("500.00");
        expect(result.breakdown[2].totalAmount.toFixed(2)).toBe("100.00");
      });

      it("should include transaction counts", async () => {
        const groupedPayments = [
          {
            paymentMethod: PaymentMethod.CASH,
            _sum: { amount: new Decimal("500.00") },
            _count: 25,
          },
        ];

        prismaService.payment.groupBy = jest
          .fn()
          .mockResolvedValue(groupedPayments);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.breakdown[0].transactionCount).toBe(25);
      });
    });

    describe("empty result handling", () => {
      it("should handle empty payment data", async () => {
        prismaService.payment.groupBy = jest.fn().mockResolvedValue([]);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.breakdown).toHaveLength(0);
      });

      it("should handle null amounts gracefully", async () => {
        const groupedPayments = [
          {
            paymentMethod: PaymentMethod.CASH,
            _sum: { amount: null },
            _count: 0,
          },
        ];

        prismaService.payment.groupBy = jest
          .fn()
          .mockResolvedValue(groupedPayments);

        const result = await service.getPaymentBreakdown(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.breakdown[0].totalAmount.toString()).toBe("0");
        expect(result.breakdown[0].percentage).toBe(0);
      });
    });

    describe("store isolation", () => {
      it("should filter by storeId through order relation", async () => {
        prismaService.payment.groupBy = jest.fn().mockResolvedValue([]);

        await service.getPaymentBreakdown(mockStoreId, startDate, endDate);

        expect(prismaService.payment.groupBy).toHaveBeenCalledWith({
          by: ["paymentMethod"],
          where: expect.objectContaining({
            order: expect.objectContaining({ storeId: mockStoreId }),
          }),
          _sum: expect.any(Object),
          _count: true,
        });
      });

      it("should only include payments for COMPLETED orders", async () => {
        prismaService.payment.groupBy = jest.fn().mockResolvedValue([]);

        await service.getPaymentBreakdown(mockStoreId, startDate, endDate);

        expect(prismaService.payment.groupBy).toHaveBeenCalledWith({
          by: ["paymentMethod"],
          where: expect.objectContaining({
            order: expect.objectContaining({ status: OrderStatus.COMPLETED }),
          }),
          _sum: expect.any(Object),
          _count: true,
        });
      });
    });

    describe("error handling", () => {
      it("should throw InternalServerErrorException on database error", async () => {
        prismaService.payment.groupBy = jest
          .fn()
          .mockRejectedValue(new Error("Database error"));

        await expect(
          service.getPaymentBreakdown(mockStoreId, startDate, endDate),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe("getPopularItems", () => {
    describe("successful report generation", () => {
      it("should return top selling items by quantity", async () => {
        const itemStats = [
          {
            menuItemId: "item-1",
            _sum: { quantity: 100, finalPrice: new Decimal("1000.00") },
            _count: { orderId: 50 },
          },
          {
            menuItemId: "item-2",
            _sum: { quantity: 75, finalPrice: new Decimal("750.00") },
            _count: { orderId: 40 },
          },
        ];

        const menuItems = [
          { id: "item-1", name: "Burger" },
          { id: "item-2", name: "Pizza" },
        ];

        prismaService.orderItem.groupBy = jest
          .fn()
          .mockResolvedValue(itemStats);
        prismaService.menuItem.findMany.mockResolvedValue(menuItems);

        const result = await service.getPopularItems(
          mockStoreId,
          10,
          startDate,
          endDate,
        );

        expect(result.items).toHaveLength(2);
        expect(result.items[0].menuItemName).toBe("Burger");
        expect(result.items[0].quantitySold).toBe(100);
        expect(result.items[1].menuItemName).toBe("Pizza");
        expect(result.items[1].quantitySold).toBe(75);
      });

      it("should include revenue totals", async () => {
        const itemStats = [
          {
            menuItemId: "item-1",
            _sum: { quantity: 50, finalPrice: new Decimal("1250.00") },
            _count: { orderId: 25 },
          },
        ];

        const menuItems = [{ id: "item-1", name: "Steak" }];

        prismaService.orderItem.groupBy = jest
          .fn()
          .mockResolvedValue(itemStats);
        prismaService.menuItem.findMany.mockResolvedValue(menuItems);

        const result = await service.getPopularItems(
          mockStoreId,
          10,
          startDate,
          endDate,
        );

        expect(result.items[0].totalRevenue.toFixed(2)).toBe("1250.00");
      });

      it("should respect limit parameter", async () => {
        const itemStats = Array.from({ length: 5 }, (_, i) => ({
          menuItemId: `item-${i}`,
          _sum: { quantity: 100 - i * 10, finalPrice: new Decimal("100.00") },
          _count: { orderId: 10 },
        }));

        prismaService.orderItem.groupBy = jest
          .fn()
          .mockResolvedValue(itemStats);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        await service.getPopularItems(mockStoreId, 5, startDate, endDate);

        expect(prismaService.orderItem.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({ take: 5 }),
        );
      });

      it("should default to 10 items when limit not specified", async () => {
        prismaService.orderItem.groupBy = jest.fn().mockResolvedValue([]);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        await service.getPopularItems(
          mockStoreId,
          undefined,
          startDate,
          endDate,
        );

        expect(prismaService.orderItem.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({ take: 10 }),
        );
      });
    });

    describe("empty result handling", () => {
      it("should handle no order items gracefully", async () => {
        prismaService.orderItem.groupBy = jest.fn().mockResolvedValue([]);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        const result = await service.getPopularItems(
          mockStoreId,
          10,
          startDate,
          endDate,
        );

        expect(result.items).toHaveLength(0);
      });

      it("should handle missing menu item names", async () => {
        const itemStats = [
          {
            menuItemId: "item-1",
            _sum: { quantity: 50, finalPrice: new Decimal("500.00") },
            _count: { orderId: 25 },
          },
        ];

        prismaService.orderItem.groupBy = jest
          .fn()
          .mockResolvedValue(itemStats);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        const result = await service.getPopularItems(
          mockStoreId,
          10,
          startDate,
          endDate,
        );

        expect(result.items[0].menuItemName).toBe("Unknown Item");
      });

      it("should filter out null menuItemIds", async () => {
        const itemStats = [
          {
            menuItemId: null,
            _sum: { quantity: 10, finalPrice: new Decimal("100.00") },
            _count: { orderId: 5 },
          },
          {
            menuItemId: "item-1",
            _sum: { quantity: 20, finalPrice: new Decimal("200.00") },
            _count: { orderId: 10 },
          },
        ];

        const menuItems = [{ id: "item-1", name: "Valid Item" }];

        prismaService.orderItem.groupBy = jest
          .fn()
          .mockResolvedValue(itemStats);
        prismaService.menuItem.findMany.mockResolvedValue(menuItems);

        const result = await service.getPopularItems(
          mockStoreId,
          10,
          startDate,
          endDate,
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].menuItemId).toBe("item-1");
      });
    });

    describe("store isolation", () => {
      it("should filter by storeId through order relation", async () => {
        prismaService.orderItem.groupBy = jest.fn().mockResolvedValue([]);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        await service.getPopularItems(mockStoreId, 10, startDate, endDate);

        expect(prismaService.orderItem.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              order: expect.objectContaining({ storeId: mockStoreId }),
            }),
          }),
        );
      });

      it("should only include items from COMPLETED orders", async () => {
        prismaService.orderItem.groupBy = jest.fn().mockResolvedValue([]);
        prismaService.menuItem.findMany.mockResolvedValue([]);

        await service.getPopularItems(mockStoreId, 10, startDate, endDate);

        expect(prismaService.orderItem.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              order: expect.objectContaining({
                status: OrderStatus.COMPLETED,
              }),
            }),
          }),
        );
      });
    });

    describe("error handling", () => {
      it("should throw InternalServerErrorException on database error", async () => {
        prismaService.orderItem.groupBy = jest
          .fn()
          .mockRejectedValue(new Error("Database error"));

        await expect(
          service.getPopularItems(mockStoreId, 10, startDate, endDate),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe("getOrderStatusReport", () => {
    describe("successful report generation", () => {
      it("should group orders by status", async () => {
        const statusGroups = [
          { status: OrderStatus.COMPLETED, _count: { _all: 50 } },
          { status: OrderStatus.SERVED, _count: { _all: 30 } },
          { status: OrderStatus.PREPARING, _count: { _all: 20 } },
        ];

        prismaService.order.groupBy = jest.fn().mockResolvedValue(statusGroups);

        const result = await service.getOrderStatusReport(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.statusDistribution).toHaveLength(3);
        expect(result.totalOrders).toBe(100);
      });

      it("should calculate percentages correctly", async () => {
        const statusGroups = [
          { status: OrderStatus.COMPLETED, _count: { _all: 60 } },
          { status: OrderStatus.SERVED, _count: { _all: 40 } },
        ];

        prismaService.order.groupBy = jest.fn().mockResolvedValue(statusGroups);

        const result = await service.getOrderStatusReport(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.statusDistribution[0].percentage).toBe(60.0);
        expect(result.statusDistribution[1].percentage).toBe(40.0);
      });

      it("should sort by count descending", async () => {
        const statusGroups = [
          { status: OrderStatus.PREPARING, _count: { _all: 10 } },
          { status: OrderStatus.COMPLETED, _count: { _all: 100 } },
          { status: OrderStatus.SERVED, _count: { _all: 50 } },
        ];

        prismaService.order.groupBy = jest.fn().mockResolvedValue(statusGroups);

        const result = await service.getOrderStatusReport(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.statusDistribution[0].status).toBe(OrderStatus.COMPLETED);
        expect(result.statusDistribution[1].status).toBe(OrderStatus.SERVED);
        expect(result.statusDistribution[2].status).toBe(OrderStatus.PREPARING);
      });
    });

    describe("empty result handling", () => {
      it("should handle no orders gracefully", async () => {
        prismaService.order.groupBy = jest.fn().mockResolvedValue([]);

        const result = await service.getOrderStatusReport(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.statusDistribution).toHaveLength(0);
        expect(result.totalOrders).toBe(0);
      });

      it("should set percentage to zero when no orders exist", async () => {
        prismaService.order.groupBy = jest.fn().mockResolvedValue([]);

        const result = await service.getOrderStatusReport(
          mockStoreId,
          startDate,
          endDate,
        );

        expect(result.totalOrders).toBe(0);
      });
    });

    describe("store isolation", () => {
      it("should filter by storeId", async () => {
        prismaService.order.groupBy = jest.fn().mockResolvedValue([]);

        await service.getOrderStatusReport(mockStoreId, startDate, endDate);

        expect(prismaService.order.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ storeId: mockStoreId }),
          }),
        );
      });

      it("should filter by date range", async () => {
        prismaService.order.groupBy = jest.fn().mockResolvedValue([]);

        await service.getOrderStatusReport(mockStoreId, startDate, endDate);

        expect(prismaService.order.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              createdAt: { gte: startDate, lte: endDate },
            }),
          }),
        );
      });
    });

    describe("error handling", () => {
      it("should throw InternalServerErrorException on database error", async () => {
        prismaService.order.groupBy = jest
          .fn()
          .mockRejectedValue(new Error("Database error"));

        await expect(
          service.getOrderStatusReport(mockStoreId, startDate, endDate),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });
  });
});
