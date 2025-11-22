import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { OrderStatus, RoutingArea } from "src/generated/prisma/client";

import { KitchenService } from "./kitchen.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

describe("KitchenService", () => {
  let service: KitchenService;
  let prismaService: PrismaMock;

  const mockStoreId = "store-123";
  const mockOrderId = "order-123";

  const mockOrder = {
    id: mockOrderId,
    storeId: mockStoreId,
    status: OrderStatus.PENDING,
    subtotal: "10.00",
    total: "10.00",
    createdAt: new Date(),
    updatedAt: new Date(),
    orderItems: [
      {
        id: "item-1",
        menuItem: {
          name: "Burger",
          description: "Delicious burger",
          routingArea: RoutingArea.GRILL,
          preparationTimeMinutes: 15,
        },
        customizations: [],
      },
    ],
  };

  const mockGrillOrder = {
    ...mockOrder,
    orderItems: [
      {
        id: "item-1",
        menuItem: {
          name: "Burger",
          description: "Delicious burger",
          routingArea: RoutingArea.GRILL,
          preparationTimeMinutes: 15,
        },
        customizations: [],
      },
    ],
  };

  const mockFryOrder = {
    ...mockOrder,
    id: "order-456",
    orderItems: [
      {
        id: "item-2",
        menuItem: {
          name: "Fries",
          description: "Crispy fries",
          routingArea: RoutingArea.FRY,
          preparationTimeMinutes: 10,
        },
        customizations: [],
      },
    ],
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getOrdersByStatus", () => {
    it("should return all kitchen orders without filters", async () => {
      prismaService.order.findMany.mockResolvedValue([
        mockGrillOrder,
        mockFryOrder,
      ] as any);

      const result = await service.getOrdersByStatus(mockStoreId);

      expect(result).toHaveLength(2);
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED,
              ],
            },
          }),
        }),
      );
    });

    it("should filter orders by status", async () => {
      prismaService.order.findMany.mockResolvedValue([mockOrder] as any);

      const result = await service.getOrdersByStatus(
        mockStoreId,
        OrderStatus.PREPARING,
      );

      expect(result).toHaveLength(1);
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
            status: OrderStatus.PREPARING,
          }),
        }),
      );
    });

    it("should filter orders by routing area", async () => {
      prismaService.order.findMany.mockResolvedValue([
        mockGrillOrder,
        mockFryOrder,
      ] as any);

      const result = await service.getOrdersByStatus(
        mockStoreId,
        undefined,
        RoutingArea.GRILL,
      );

      // Result should include both orders but the second one should have empty items
      expect(result).toHaveLength(2);
      expect(result[0].orderItems.length).toBeGreaterThan(0);
      expect(result[0].orderItems[0].menuItem?.routingArea).toBe(
        RoutingArea.GRILL,
      );
      // Second order's items should be filtered out
      expect(result[1].orderItems.length).toBe(0);
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderItems: {
              some: {
                menuItem: {
                  routingArea: RoutingArea.GRILL,
                },
              },
            },
          }),
        }),
      );
    });

    it("should filter by both status and routing area", async () => {
      prismaService.order.findMany.mockResolvedValue([mockGrillOrder] as any);

      const result = await service.getOrdersByStatus(
        mockStoreId,
        OrderStatus.PREPARING,
        RoutingArea.GRILL,
      );

      expect(result).toHaveLength(1);
      expect(result[0].orderItems[0].menuItem?.routingArea).toBe(
        RoutingArea.GRILL,
      );
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
            status: OrderStatus.PREPARING,
            orderItems: {
              some: {
                menuItem: {
                  routingArea: RoutingArea.GRILL,
                },
              },
            },
          }),
        }),
      );
    });

    it("should include routingArea and preparationTimeMinutes in menu item selection", async () => {
      prismaService.order.findMany.mockResolvedValue([mockOrder] as any);

      await service.getOrdersByStatus(mockStoreId);

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            orderItems: expect.objectContaining({
              include: expect.objectContaining({
                menuItem: expect.objectContaining({
                  select: expect.objectContaining({
                    routingArea: true,
                    preparationTimeMinutes: true,
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it("should throw InternalServerErrorException on database error", async () => {
      prismaService.order.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.getOrdersByStatus(mockStoreId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("getOrderDetails", () => {
    it("should return order details by ID", async () => {
      prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await service.getOrderDetails(mockOrderId);

      expect(result).toEqual(mockOrder);
      expect(prismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if order not found", async () => {
      prismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderDetails(mockOrderId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateOrderStatus", () => {
    const updateDto = { status: OrderStatus.PREPARING };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should update order status successfully", async () => {
      prismaService.order.findUnique
        .mockResolvedValueOnce(mockOrder as any)
        .mockResolvedValueOnce({
          ...mockOrder,
          status: OrderStatus.PREPARING,
        } as any);
      prismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PREPARING,
      } as any);

      const result = await service.updateOrderStatus(
        mockOrderId,
        mockStoreId,
        updateDto,
      );

      expect(result.status).toBe(OrderStatus.PREPARING);
      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: { status: OrderStatus.PREPARING },
      });
    });

    it("should throw NotFoundException if order not found", async () => {
      prismaService.order.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateOrderStatus(mockOrderId, mockStoreId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if order belongs to different store", async () => {
      prismaService.order.findUnique.mockResolvedValueOnce({
        ...mockOrder,
        storeId: "different-store",
      } as any);

      await expect(
        service.updateOrderStatus(mockOrderId, mockStoreId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should validate status transitions", async () => {
      prismaService.order.findUnique.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      } as any);

      await expect(
        service.updateOrderStatus(mockOrderId, mockStoreId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should set paidAt when status is COMPLETED", async () => {
      const servedOrder = {
        ...mockOrder,
        status: OrderStatus.SERVED,
        paidAt: null,
      };
      prismaService.order.findUnique
        .mockResolvedValueOnce(servedOrder as any)
        .mockResolvedValueOnce({
          ...servedOrder,
          status: OrderStatus.COMPLETED,
          paidAt: new Date(),
        } as any);
      prismaService.order.update.mockResolvedValue({
        ...servedOrder,
        status: OrderStatus.COMPLETED,
        paidAt: new Date(),
      } as any);

      await service.updateOrderStatus(mockOrderId, mockStoreId, {
        status: OrderStatus.COMPLETED,
      });

      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({
          status: OrderStatus.COMPLETED,
          paidAt: expect.any(Date),
        }),
      });
    });
  });
});
