import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { Decimal } from "src/common/types/decimal.type";
import {
  OrderStatus,
  OrderType,
  SessionStatus,
  DiscountType,
  Role,
} from "src/generated/prisma/client";

import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrderService } from "./order.service";
import { AuthService } from "../auth/auth.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { KitchenGateway } from "../kitchen/gateway/kitchen.gateway";
import { PrismaService } from "../prisma/prisma.service";

describe("OrderService", () => {
  let service: OrderService;
  let prismaService: PrismaMock;
  let kitchenGateway: jest.Mocked<KitchenGateway>;
  let authService: jest.Mocked<AuthService>;

  // Common IDs
  const mockSessionId = "session-123";
  const mockStoreId = "store-123";
  const mockTableId = "table-123";
  const mockCartId = "cart-123";
  const mockOrderId = "order-123";

  // Mock session with store settings
  const mockActiveSession = {
    id: mockSessionId,
    storeId: mockStoreId,
    tableId: mockTableId,
    status: SessionStatus.ACTIVE,
    sessionToken: "token-123",
    guestCount: 2,
    createdAt: new Date("2025-10-22T10:00:00Z"),
    closedAt: null,
    table: {
      id: mockTableId,
      storeId: mockStoreId,
      name: "Table 5",
      qrCode: "qr-code-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    store: {
      id: mockStoreId,
      slug: "test-store",
      name: "Test Store",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      setting: {
        id: "setting-123",
        storeId: mockStoreId,
        vatRate: new Decimal("0.07"), // 7%
        serviceChargeRate: new Decimal("0.10"), // 10%
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  };

  const mockClosedSession = {
    ...mockActiveSession,
    status: SessionStatus.CLOSED,
    closedAt: new Date(),
  };

  // Mock cart with items
  const mockCartItem1 = {
    id: "cart-item-1",
    cartId: mockCartId,
    menuItemId: "menu-item-1",
    basePrice: new Decimal("12.00"),
    quantity: 2,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customizations: [
      {
        id: "customization-1",
        cartItemId: "cart-item-1",
        customizationOptionId: "option-1",
        optionName: "Large",
        additionalPrice: new Decimal("3.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "customization-2",
        cartItemId: "cart-item-1",
        customizationOptionId: "option-2",
        optionName: "Extra Cheese",
        additionalPrice: new Decimal("1.50"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    menuItem: {
      id: "menu-item-1",
      name: "Burger",
      storeId: mockStoreId,
      categoryId: "cat-1",
      basePrice: new Decimal("12.00"),
      description: "Delicious burger",
      imagePath: null,
      sortOrder: 0,
      isOutOfStock: false,
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  };

  const mockCartItem2 = {
    id: "cart-item-2",
    cartId: mockCartId,
    menuItemId: "menu-item-2",
    basePrice: new Decimal("8.00"),
    quantity: 1,
    notes: "No salt",
    createdAt: new Date(),
    updatedAt: new Date(),
    customizations: [],
    menuItem: {
      id: "menu-item-2",
      name: "Fries",
      storeId: mockStoreId,
      categoryId: "cat-1",
      basePrice: new Decimal("8.00"),
      description: "Crispy fries",
      imagePath: null,
      sortOrder: 1,
      isOutOfStock: false,
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  };

  const mockCart = {
    id: mockCartId,
    sessionId: mockSessionId,
    subTotal: new Decimal("41.00"), // (12+3+1.5)*2 + 8 = 41
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [mockCartItem1, mockCartItem2],
  };

  const mockEmptyCart = {
    ...mockCart,
    items: [],
  };

  // Mock order
  const mockOrder = {
    id: mockOrderId,
    orderNumber: "20251022-001",
    storeId: mockStoreId,
    sessionId: mockSessionId,
    tableName: "Table 5",
    status: OrderStatus.PENDING,
    orderType: OrderType.DINE_IN,
    subTotal: new Decimal("41.00"),
    vatRateSnapshot: new Decimal("0.07"),
    serviceChargeRateSnapshot: new Decimal("0.10"),
    vatAmount: new Decimal("3.16"),
    serviceChargeAmount: new Decimal("4.10"),
    grandTotal: new Decimal("48.26"),
    paidAt: null,
    createdAt: new Date("2025-10-22T10:30:00Z"),
    updatedAt: new Date("2025-10-22T10:30:00Z"),
    orderItems: [
      {
        id: "order-item-1",
        orderId: mockOrderId,
        menuItemId: "menu-item-1",
        price: new Decimal("16.50"), // 12 + 3 + 1.5
        quantity: 2,
        finalPrice: new Decimal("33.00"),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        customizations: [],
      },
      {
        id: "order-item-2",
        orderId: mockOrderId,
        menuItemId: "menu-item-2",
        price: new Decimal("8.00"),
        quantity: 1,
        finalPrice: new Decimal("8.00"),
        notes: "No salt",
        createdAt: new Date(),
        updatedAt: new Date(),
        customizations: [],
      },
    ],
  };

  // Mock transaction client
  const mockTransaction = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    orderItemCustomization: {
      createMany: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
    cart: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    // Mock KitchenGateway
    const mockKitchenGateway = {
      broadcastNewOrder: jest.fn().mockResolvedValue(undefined),
      broadcastOrderReady: jest.fn().mockResolvedValue(undefined),
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    };

    // Mock AuthService
    const mockAuthService = {
      checkStorePermission: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: KitchenGateway,
          useValue: mockKitchenGateway,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prismaService = module.get(PrismaService);
    kitchenGateway = module.get(KitchenGateway);
    authService = module.get(AuthService);

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default transaction mock
    prismaService.$transaction.mockImplementation((callback: any) =>
      callback(mockTransaction),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("checkoutCart", () => {
    const checkoutDto: CheckoutCartDto = {
      orderType: OrderType.DINE_IN,
    };

    describe("Happy Path - Order Creation", () => {
      it("should create order from cart with correct financial calculations", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0); // First order today
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.orderNumber).toBe("20251022-001");
        expect(result.subTotal).toEqual(new Decimal("41.00"));
        expect(result.serviceChargeAmount).toEqual(new Decimal("4.10"));
        expect(result.vatAmount).toEqual(new Decimal("3.16"));
        expect(result.grandTotal).toEqual(new Decimal("48.26"));

        // Verify order creation data
        expect(mockTransaction.order.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            storeId: mockStoreId,
            sessionId: mockSessionId,
            status: OrderStatus.PENDING,
            orderType: OrderType.DINE_IN,
            subTotal: new Decimal("41.00"),
            vatRateSnapshot: new Decimal("0.07"),
            serviceChargeRateSnapshot: new Decimal("0.10"),
            vatAmount: expect.any(Decimal),
            serviceChargeAmount: expect.any(Decimal),
            grandTotal: expect.any(Decimal),
          }),
        });
      });

      it("should generate unique order number in YYYYMMDD-XXX format", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(5); // 6th order today
        mockTransaction.order.create.mockResolvedValue({
          ...mockOrder,
          orderNumber: "20251022-006",
        } as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          orderNumber: "20251022-006",
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.orderNumber).toBe("20251022-006");
        expect(mockTransaction.order.count).toHaveBeenCalledWith({
          where: {
            storeId: mockStoreId,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          },
        });
      });

      it("should create order items from cart items with customizations", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert - Verify order items created
        expect(mockTransaction.orderItem.create).toHaveBeenCalledTimes(2);

        // First item: Burger with customizations
        expect(mockTransaction.orderItem.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            orderId: mockOrder.id,
            menuItemId: "menu-item-1",
            price: new Decimal("16.50"), // 12 + 3 + 1.5
            quantity: 2,
            finalPrice: new Decimal("33.00"), // 16.50 * 2
            notes: null,
          }),
        });

        // Second item: Fries without customizations
        expect(mockTransaction.orderItem.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            orderId: mockOrder.id,
            menuItemId: "menu-item-2",
            price: new Decimal("8.00"),
            quantity: 1,
            finalPrice: new Decimal("8.00"),
            notes: "No salt",
          }),
        });

        // Verify customizations created
        expect(
          mockTransaction.orderItemCustomization.createMany,
        ).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              customizationOptionId: "option-1",
              finalPrice: new Decimal("6.00"), // 3 * 2
            }),
            expect.objectContaining({
              customizationOptionId: "option-2",
              finalPrice: new Decimal("3.00"), // 1.5 * 2
            }),
          ]),
        });
      });

      it("should clear cart after successful checkout", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert
        expect(mockTransaction.cartItem.deleteMany).toHaveBeenCalledWith({
          where: { cartId: mockCartId },
        });

        expect(mockTransaction.cart.update).toHaveBeenCalledWith({
          where: { id: mockCartId },
          data: { subTotal: new Decimal("0") },
        });
      });

      it("should broadcast new order to kitchen WebSocket", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert
        expect(kitchenGateway.broadcastNewOrder).toHaveBeenCalledWith(
          mockStoreId,
          mockOrderId,
        );
      });

      it("should use custom table name if provided", async () => {
        // Arrange
        const customCheckoutDto: CheckoutCartDto = {
          orderType: OrderType.DINE_IN,
          tableName: "VIP Table 1",
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue({
          ...mockOrder,
          tableName: "VIP Table 1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          tableName: "VIP Table 1",
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          customCheckoutDto,
          "token-123",
        );

        // Assert
        expect(result.tableName).toBe("VIP Table 1");
        expect(mockTransaction.order.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tableName: "VIP Table 1",
          }),
        });
      });
    });

    describe("Financial Calculations - Decimal Precision", () => {
      it("should calculate VAT correctly (7% of subtotal)", async () => {
        // Arrange
        const cartWith100Subtotal = {
          ...mockCart,
          subTotal: new Decimal("100.00"),
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(
          cartWith100Subtotal as any,
        );

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          const { subTotal, vatRateSnapshot } = args.data;
          const vatAmount = subTotal.mul(vatRateSnapshot);
          return Promise.resolve({
            ...mockOrder,
            subTotal,
            vatAmount,
          } as any);
        });

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          subTotal: new Decimal("100.00"),
          vatAmount: new Decimal("7.00"),
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.vatAmount).toEqual(new Decimal("7.00"));
      });

      it("should calculate service charge correctly (10% of subtotal)", async () => {
        // Arrange
        const cartWith100Subtotal = {
          ...mockCart,
          subTotal: new Decimal("100.00"),
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(
          cartWith100Subtotal as any,
        );

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          const { subTotal, serviceChargeRateSnapshot } = args.data;
          const serviceChargeAmount = subTotal.mul(serviceChargeRateSnapshot);
          return Promise.resolve({
            ...mockOrder,
            subTotal,
            serviceChargeAmount,
          } as any);
        });

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          subTotal: new Decimal("100.00"),
          serviceChargeAmount: new Decimal("10.00"),
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.serviceChargeAmount).toEqual(new Decimal("10.00"));
      });

      it("should calculate grand total: subtotal + VAT + service charge", async () => {
        // Arrange
        const cartWith100Subtotal = {
          ...mockCart,
          subTotal: new Decimal("100.00"),
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(
          cartWith100Subtotal as any,
        );

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          const { subTotal, vatRateSnapshot, serviceChargeRateSnapshot } =
            args.data;
          const vatAmount = subTotal.mul(vatRateSnapshot);
          const serviceChargeAmount = subTotal.mul(serviceChargeRateSnapshot);
          const grandTotal = subTotal.add(vatAmount).add(serviceChargeAmount);
          return Promise.resolve({
            ...mockOrder,
            subTotal,
            vatAmount,
            serviceChargeAmount,
            grandTotal,
          } as any);
        });

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          subTotal: new Decimal("100.00"),
          vatAmount: new Decimal("7.00"),
          serviceChargeAmount: new Decimal("10.00"),
          grandTotal: new Decimal("117.00"),
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.grandTotal).toEqual(new Decimal("117.00"));
      });

      it("should handle zero VAT and service charge", async () => {
        // Arrange
        const sessionWithNoCharges = {
          ...mockActiveSession,
          store: {
            ...mockActiveSession.store,
            setting: {
              ...mockActiveSession.store.setting,
              vatRate: new Decimal("0"),
              serviceChargeRate: new Decimal("0"),
            },
          },
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          sessionWithNoCharges as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          const { subTotal } = args.data;
          return Promise.resolve({
            ...mockOrder,
            subTotal,
            vatAmount: new Decimal("0"),
            serviceChargeAmount: new Decimal("0"),
            grandTotal: subTotal,
          } as any);
        });

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          subTotal: new Decimal("41.00"),
          vatAmount: new Decimal("0"),
          serviceChargeAmount: new Decimal("0"),
          grandTotal: new Decimal("41.00"),
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.vatAmount).toEqual(new Decimal("0"));
        expect(result.serviceChargeAmount).toEqual(new Decimal("0"));
        expect(result.grandTotal).toEqual(new Decimal("41.00"));
      });

      it("should handle decimal precision for complex calculations", async () => {
        // Test case: $9.99 × 7 items = $69.93
        const complexCart = {
          ...mockCart,
          subTotal: new Decimal("69.93"),
          items: [
            {
              ...mockCartItem1,
              basePrice: new Decimal("9.99"),
              quantity: 7,
              customizations: [],
            },
          ],
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(complexCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          const { subTotal, vatRateSnapshot, serviceChargeRateSnapshot } =
            args.data;
          const serviceChargeAmount = subTotal.mul(serviceChargeRateSnapshot);
          const vatAmount = subTotal.mul(vatRateSnapshot);
          const grandTotal = subTotal.add(vatAmount).add(serviceChargeAmount);
          return Promise.resolve({
            ...mockOrder,
            subTotal,
            vatAmount,
            serviceChargeAmount,
            grandTotal,
          } as any);
        });

        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          subTotal: new Decimal("69.93"),
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.subTotal).toEqual(new Decimal("69.93"));
      });
    });

    describe("Rate Snapshots - Historical Accuracy", () => {
      it("should snapshot current VAT rate at order time", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert
        expect(mockTransaction.order.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            vatRateSnapshot: new Decimal("0.07"),
          }),
        });
      });

      it("should snapshot current service charge rate at order time", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert
        expect(mockTransaction.order.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            serviceChargeRateSnapshot: new Decimal("0.10"),
          }),
        });
      });

      it("should use zero rates when store settings are null", async () => {
        // Arrange
        const sessionWithNullSettings = {
          ...mockActiveSession,
          store: {
            ...mockActiveSession.store,
            setting: null,
          },
        };

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          sessionWithNullSettings as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockImplementation((args: any) => {
          return Promise.resolve({
            ...mockOrder,
            vatRateSnapshot: args.data.vatRateSnapshot,
            serviceChargeRateSnapshot: args.data.serviceChargeRateSnapshot,
          } as any);
        });

        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act
        await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

        // Assert
        expect(mockTransaction.order.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            vatRateSnapshot: new Decimal("0"),
            serviceChargeRateSnapshot: new Decimal("0"),
          }),
        });
      });
    });

    describe("Validation - Checkout Requirements", () => {
      it("should reject checkout when session not found", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto),
        ).rejects.toThrow("Session not found");
      });

      it("should reject checkout when session is closed", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockClosedSession as any,
        );

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto),
        ).rejects.toThrow("Session is already closed");
      });

      it("should reject checkout when cart not found", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow("Cart not found");
      });

      it("should reject checkout when cart is empty", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockEmptyCart as any);

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow("Cart is empty");
      });
    });

    describe("Transaction Integrity", () => {
      it("should rollback transaction if order creation fails", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockRejectedValue(
          new Error("Database error"),
        );

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(InternalServerErrorException);

        // Verify cart was NOT cleared (transaction rollback)
        expect(mockTransaction.cartItem.deleteMany).not.toHaveBeenCalled();
        expect(mockTransaction.cart.update).not.toHaveBeenCalled();
      });

      it("should rollback transaction if order item creation fails", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockResolvedValue(mockOrder as any);
        mockTransaction.orderItem.create.mockRejectedValue(
          new Error("Database error"),
        );

        // Act & Assert
        await expect(
          service.checkoutCart(mockSessionId, checkoutDto, "token-123"),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it("should not clear cart if checkout fails", async () => {
        // Arrange
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );
        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        mockTransaction.order.count.mockResolvedValue(0);
        mockTransaction.order.create.mockRejectedValue(
          new Error("Database error"),
        );

        // Act
        try {
          await service.checkoutCart(mockSessionId, checkoutDto, "token-123");
        } catch (_error) {
          // Expected to throw
        }

        // Assert
        expect(mockTransaction.cartItem.deleteMany).not.toHaveBeenCalled();
      });
    });
  });

  describe("findOne", () => {
    it("should return order by ID with items and customizations", async () => {
      // Arrange
      const orderWithPayments = {
        ...mockOrder,
        payments: [],
        refunds: [],
      };
      prismaService.order.findUnique.mockResolvedValue(
        orderWithPayments as any,
      );

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOrderId);
      expect(result.orderItems).toBeDefined();
      expect(result.orderItems).toHaveLength(2);

      expect(prismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        include: {
          orderItems: {
            include: {
              customizations: true,
            },
          },
          payments: true,
          refunds: true,
        },
      });
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        "Order not found",
      );
    });

    it("should throw InternalServerErrorException on database error", async () => {
      // Arrange
      prismaService.order.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(service.findOne(mockOrderId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("findByStore", () => {
    const paginationDto = {
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    };

    it("should return paginated orders for store", async () => {
      // Arrange
      const orders = [
        { ...mockOrder, payments: [], refunds: [] },
        { ...mockOrder, id: "order-456", payments: [], refunds: [] },
      ];

      prismaService.order.findMany.mockResolvedValue(orders as any);
      prismaService.order.count.mockResolvedValue(2);

      // Act
      const result = await service.findByStore(mockStoreId, paginationDto);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);

      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        include: {
          orderItems: {
            include: {
              customizations: true,
            },
          },
          payments: true,
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("should enforce store isolation", async () => {
      // Arrange
      prismaService.order.findMany.mockResolvedValue([]);
      prismaService.order.count.mockResolvedValue(0);

      // Act
      await service.findByStore(mockStoreId, paginationDto);

      // Assert
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: mockStoreId },
        }),
      );
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      const page2Dto = {
        page: 2,
        limit: 10,
        skip: 10,
        take: 10,
      };

      prismaService.order.findMany.mockResolvedValue([mockOrder] as any);
      prismaService.order.count.mockResolvedValue(25);

      // Act
      const result = await service.findByStore(mockStoreId, page2Dto);

      // Assert
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);

      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it("should throw InternalServerErrorException on database error", async () => {
      // Arrange
      prismaService.order.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(
        service.findByStore(mockStoreId, paginationDto),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe("findForKds", () => {
    const kdsQueryDto = {
      storeId: mockStoreId,
      page: 1,
      limit: 20,
      skip: 0,
      take: 20,
    };

    it("should return orders filtered by status for KDS", async () => {
      // Arrange
      const kdsOrders = [
        { ...mockOrder, payments: [], refunds: [] },
        {
          ...mockOrder,
          id: "order-456",
          status: OrderStatus.PREPARING,
          payments: [],
          refunds: [],
        },
      ];

      prismaService.order.findMany.mockResolvedValue(kdsOrders as any);
      prismaService.order.count.mockResolvedValue(2);

      // Act
      const result = await service.findForKds({
        ...kdsQueryDto,
        status: OrderStatus.PENDING,
      });

      // Assert
      expect(result.items).toHaveLength(2);
      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: {
          storeId: mockStoreId,
          status: OrderStatus.PENDING,
        },
        include: {
          orderItems: {
            include: {
              customizations: true,
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  imagePath: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          payments: true,
          refunds: true,
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: 0,
        take: 20,
      });
    });

    it("should filter active kitchen orders by default (PENDING, PREPARING, READY)", async () => {
      // Arrange
      prismaService.order.findMany.mockResolvedValue([mockOrder] as any);
      prismaService.order.count.mockResolvedValue(1);

      // Act
      await service.findForKds(kdsQueryDto);

      // Assert
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            storeId: mockStoreId,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                OrderStatus.READY,
              ],
            },
          },
        }),
      );
    });

    it("should enforce store isolation for KDS queries", async () => {
      // Arrange
      prismaService.order.findMany.mockResolvedValue([]);
      prismaService.order.count.mockResolvedValue(0);

      // Act
      await service.findForKds(kdsQueryDto);

      // Assert
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
          }),
        }),
      );
    });

    it("should include menu item details for KDS display", async () => {
      // Arrange
      prismaService.order.findMany.mockResolvedValue([mockOrder] as any);
      prismaService.order.count.mockResolvedValue(1);

      // Act
      await service.findForKds(kdsQueryDto);

      // Assert
      expect(prismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            orderItems: expect.objectContaining({
              include: expect.objectContaining({
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    imagePath: true,
                  },
                },
              }),
            }),
          }),
        }),
      );
    });
  });

  describe("findBySession", () => {
    it("should return all orders for a session", async () => {
      // Arrange
      const sessionOrders = [
        { ...mockOrder, payments: [], refunds: [] },
        {
          ...mockOrder,
          id: "order-456",
          orderNumber: "20251022-002",
          payments: [],
          refunds: [],
        },
      ];

      prismaService.order.findMany.mockResolvedValue(sessionOrders as any);

      // Act
      const result = await service.findBySession(mockSessionId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe(mockSessionId);

      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { sessionId: mockSessionId },
        include: {
          orderItems: {
            include: {
              customizations: true,
            },
          },
          payments: true,
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return empty array when no orders found", async () => {
      // Arrange
      prismaService.order.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findBySession(mockSessionId);

      // Assert
      expect(result).toEqual([]);
    });

    it("should throw InternalServerErrorException on database error", async () => {
      // Arrange
      prismaService.order.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert
      await expect(service.findBySession(mockSessionId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("updateStatus", () => {
    const updateStatusDto: UpdateOrderStatusDto = {
      status: OrderStatus.PREPARING,
    };

    describe("Valid Status Transitions", () => {
      it("should allow PENDING → PREPARING", async () => {
        // Arrange
        const updatedOrder = {
          ...mockOrder,
          status: OrderStatus.PREPARING,
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any) // First call in updateStatus
          .mockResolvedValueOnce(updatedOrder as any); // Second call in findOne

        prismaService.order.update.mockResolvedValue(updatedOrder as any);

        // Act
        const result = await service.updateStatus(mockOrderId, {
          status: OrderStatus.PREPARING,
        });

        // Assert
        expect(result.status).toBe(OrderStatus.PREPARING);
        expect(prismaService.order.update).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: {
            status: OrderStatus.PREPARING,
          },
        });
      });

      it("should allow PREPARING → READY", async () => {
        // Arrange
        const preparingOrder = { ...mockOrder, status: OrderStatus.PREPARING };
        const readyOrder = { ...mockOrder, status: OrderStatus.READY };

        prismaService.order.findUnique
          .mockResolvedValueOnce(preparingOrder as any)
          .mockResolvedValueOnce(readyOrder as any);

        prismaService.order.update.mockResolvedValue(readyOrder as any);

        // Act
        const result = await service.updateStatus(mockOrderId, {
          status: OrderStatus.READY,
        });

        // Assert
        expect(result.status).toBe(OrderStatus.READY);
      });

      it("should allow READY → SERVED", async () => {
        // Arrange
        const readyOrder = { ...mockOrder, status: OrderStatus.READY };
        const servedOrder = { ...mockOrder, status: OrderStatus.SERVED };

        prismaService.order.findUnique
          .mockResolvedValueOnce(readyOrder as any)
          .mockResolvedValueOnce(servedOrder as any);

        prismaService.order.update.mockResolvedValue(servedOrder as any);

        // Act
        const result = await service.updateStatus(mockOrderId, {
          status: OrderStatus.SERVED,
        });

        // Assert
        expect(result.status).toBe(OrderStatus.SERVED);
      });

      it("should allow SERVED → COMPLETED", async () => {
        // Arrange
        const servedOrder = { ...mockOrder, status: OrderStatus.SERVED };
        const completedOrder = {
          ...mockOrder,
          status: OrderStatus.COMPLETED,
          paidAt: new Date(),
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(servedOrder as any)
          .mockResolvedValueOnce(completedOrder as any);

        prismaService.order.update.mockResolvedValue(completedOrder as any);

        // Act
        const result = await service.updateStatus(mockOrderId, {
          status: OrderStatus.COMPLETED,
        });

        // Assert
        expect(result.status).toBe(OrderStatus.COMPLETED);
      });

      it("should allow any status → CANCELLED", async () => {
        // Arrange
        const cancelledOrder = {
          ...mockOrder,
          status: OrderStatus.CANCELLED,
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(cancelledOrder as any);

        prismaService.order.update.mockResolvedValue(cancelledOrder as any);

        // Act
        const result = await service.updateStatus(mockOrderId, {
          status: OrderStatus.CANCELLED,
        });

        // Assert
        expect(result.status).toBe(OrderStatus.CANCELLED);
      });
    });

    describe("Invalid Status Transitions", () => {
      it("should reject COMPLETED → PENDING", async () => {
        // Arrange
        const completedOrder = {
          ...mockOrder,
          status: OrderStatus.COMPLETED,
          paidAt: new Date(),
        };
        prismaService.order.findUnique.mockResolvedValue(completedOrder as any);

        // Act & Assert
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.PENDING }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.PENDING }),
        ).rejects.toThrow("Cannot update completed order");
      });

      it("should reject COMPLETED → PREPARING", async () => {
        // Arrange
        const completedOrder = {
          ...mockOrder,
          status: OrderStatus.COMPLETED,
          paidAt: new Date(),
        };
        prismaService.order.findUnique.mockResolvedValue(completedOrder as any);

        // Act & Assert
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.PREPARING }),
        ).rejects.toThrow(BadRequestException);
      });

      it("should reject any transition from CANCELLED status", async () => {
        // Arrange
        const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
        prismaService.order.findUnique.mockResolvedValue(cancelledOrder as any);

        // Act & Assert
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.PENDING }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.PENDING }),
        ).rejects.toThrow("Cannot update cancelled order");
      });

      it("should reject invalid transition PENDING → SERVED", async () => {
        // Arrange
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        // Act & Assert
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.SERVED }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateStatus(mockOrderId, { status: OrderStatus.SERVED }),
        ).rejects.toThrow(/Invalid status transition/);
      });
    });

    describe("Order Completion and Payment", () => {
      it("should set paidAt timestamp when status is COMPLETED", async () => {
        // Arrange
        const servedOrder = {
          ...mockOrder,
          status: OrderStatus.SERVED,
          paidAt: null,
        };
        prismaService.order.findUnique.mockResolvedValue(servedOrder as any);

        const completedOrder = {
          ...servedOrder,
          status: OrderStatus.COMPLETED,
          paidAt: new Date("2025-10-22T11:00:00Z"),
        };
        prismaService.order.update.mockResolvedValue(completedOrder as any);

        // Act
        await service.updateStatus(mockOrderId, {
          status: OrderStatus.COMPLETED,
        });

        // Assert
        expect(prismaService.order.update).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: expect.objectContaining({
            status: OrderStatus.COMPLETED,
            paidAt: expect.any(Date),
          }),
        });
      });

      it("should not overwrite existing paidAt when updating to COMPLETED", async () => {
        // Arrange
        const existingPaidAt = new Date("2025-10-22T10:45:00Z");
        const servedOrder = {
          ...mockOrder,
          status: OrderStatus.SERVED,
          paidAt: existingPaidAt,
        };
        prismaService.order.findUnique.mockResolvedValue(servedOrder as any);

        const completedOrder = {
          ...servedOrder,
          status: OrderStatus.COMPLETED,
        };
        prismaService.order.update.mockResolvedValue(completedOrder as any);

        // Act
        await service.updateStatus(mockOrderId, {
          status: OrderStatus.COMPLETED,
        });

        // Assert
        expect(prismaService.order.update).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: {
            status: OrderStatus.COMPLETED,
            // Should not include paidAt since it already exists
          },
        });
      });
    });

    describe("WebSocket Broadcasting", () => {
      it("should broadcast status update to kitchen", async () => {
        // Arrange
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);
        prismaService.order.update.mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.PREPARING,
        } as any);

        // Act
        await service.updateStatus(mockOrderId, updateStatusDto);

        // Assert
        expect(kitchenGateway.server.to).toHaveBeenCalledWith(
          `store-${mockStoreId}`,
        );
        expect(kitchenGateway.server.emit).toHaveBeenCalledWith(
          "kitchen:status-updated",
          expect.objectContaining({
            orderId: mockOrderId,
            status: OrderStatus.PREPARING,
          }),
        );
      });

      it("should broadcast special event when order status is READY", async () => {
        // Arrange
        const preparingOrder = { ...mockOrder, status: OrderStatus.PREPARING };
        prismaService.order.findUnique.mockResolvedValue(preparingOrder as any);
        prismaService.order.update.mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.READY,
        } as any);

        // Act
        await service.updateStatus(mockOrderId, { status: OrderStatus.READY });

        // Assert
        expect(kitchenGateway.broadcastOrderReady).toHaveBeenCalledWith(
          mockStoreId,
          mockOrderId,
        );
      });

      it("should include paidAt in broadcast for COMPLETED orders", async () => {
        // Arrange
        const servedOrder = { ...mockOrder, status: OrderStatus.SERVED };
        const paidAt = new Date("2025-10-22T11:00:00Z");

        prismaService.order.findUnique.mockResolvedValue(servedOrder as any);
        prismaService.order.update.mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.COMPLETED,
          paidAt,
        } as any);

        // Act
        await service.updateStatus(mockOrderId, {
          status: OrderStatus.COMPLETED,
        });

        // Assert
        expect(kitchenGateway.server.emit).toHaveBeenCalledWith(
          "kitchen:status-updated",
          expect.objectContaining({
            paidAt,
          }),
        );
      });
    });

    describe("Error Handling", () => {
      it("should throw NotFoundException when order does not exist", async () => {
        // Arrange
        prismaService.order.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.updateStatus("non-existent-id", updateStatusDto),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.updateStatus("non-existent-id", updateStatusDto),
        ).rejects.toThrow("Order not found");
      });

      it("should throw InternalServerErrorException on database error", async () => {
        // Arrange
        prismaService.order.findUnique.mockRejectedValue(
          new Error("Database error"),
        );

        // Act & Assert
        await expect(
          service.updateStatus(mockOrderId, updateStatusDto),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe("generateOrderNumber (private method)", () => {
    it("should generate order number in YYYYMMDD-XXX format", async () => {
      // Arrange
      const checkoutDto: CheckoutCartDto = {
        orderType: OrderType.DINE_IN,
      };

      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

      mockTransaction.order.count.mockResolvedValue(0);
      mockTransaction.order.create.mockResolvedValue({
        ...mockOrder,
        orderNumber: "20251022-001",
      } as any);
      mockTransaction.orderItem.create.mockResolvedValue({
        id: "order-item-1",
      } as any);

      prismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        orderNumber: "20251022-001",
      } as any);

      // Act
      const result = await service.checkoutCart(
        mockSessionId,
        checkoutDto,
        "token-123",
      );

      // Assert
      expect(result.orderNumber).toMatch(/^\d{8}-\d{3}$/);
      expect(result.orderNumber).toBe("20251022-001");
    });

    it("should increment sequence number for same day orders", async () => {
      // Arrange
      const checkoutDto: CheckoutCartDto = {
        orderType: OrderType.DINE_IN,
      };

      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

      // Simulate 10 existing orders today
      mockTransaction.order.count.mockResolvedValue(10);
      mockTransaction.order.create.mockResolvedValue({
        ...mockOrder,
        orderNumber: "20251022-011",
      } as any);
      mockTransaction.orderItem.create.mockResolvedValue({
        id: "order-item-1",
      } as any);

      prismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        orderNumber: "20251022-011",
      } as any);

      // Act
      const result = await service.checkoutCart(
        mockSessionId,
        checkoutDto,
        "token-123",
      );

      // Assert
      expect(result.orderNumber).toBe("20251022-011");
    });

    it("should pad sequence number with zeros", async () => {
      // Arrange
      const checkoutDto: CheckoutCartDto = {
        orderType: OrderType.DINE_IN,
      };

      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

      // Test sequence 1, 10, 100
      const testCases = [
        { count: 0, expected: "001" },
        { count: 9, expected: "010" },
        { count: 99, expected: "100" },
      ];

      for (const testCase of testCases) {
        mockTransaction.order.count.mockResolvedValue(testCase.count);
        mockTransaction.order.create.mockResolvedValue({
          ...mockOrder,
          orderNumber: `20251022-${testCase.expected}`,
        } as any);
        mockTransaction.orderItem.create.mockResolvedValue({
          id: "order-item-1",
        } as any);

        prismaService.order.findUnique.mockResolvedValue({
          ...mockOrder,
          orderNumber: `20251022-${testCase.expected}`,
        } as any);

        // Act
        const result = await service.checkoutCart(
          mockSessionId,
          checkoutDto,
          "token-123",
        );

        // Assert
        expect(result.orderNumber).toBe(`20251022-${testCase.expected}`);
      }
    });

    it("should query orders for the correct date range", async () => {
      // Arrange
      const checkoutDto: CheckoutCartDto = {
        orderType: OrderType.DINE_IN,
      };

      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

      mockTransaction.order.count.mockResolvedValue(0);
      mockTransaction.order.create.mockResolvedValue(mockOrder as any);
      mockTransaction.orderItem.create.mockResolvedValue({
        id: "order-item-1",
      } as any);

      prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

      // Act
      await service.checkoutCart(mockSessionId, checkoutDto, "token-123");

      // Assert
      expect(mockTransaction.order.count).toHaveBeenCalledWith({
        where: {
          storeId: mockStoreId,
          createdAt: {
            gte: expect.any(Date), // Start of day
            lt: expect.any(Date), // End of day (start of next day)
          },
        },
      });

      // Verify date range spans exactly one day
      const callArgs = mockTransaction.order.count.mock.calls[0][0];
      const startDate = callArgs.where.createdAt.gte;
      const endDate = callArgs.where.createdAt.lt;
      const diffInHours = (endDate - startDate) / (1000 * 60 * 60);
      expect(diffInHours).toBe(24);
    });
  });

  describe("validateStatusTransition (private method)", () => {
    describe("Valid Transitions", () => {
      const validTransitions = [
        {
          from: OrderStatus.PENDING,
          to: OrderStatus.PREPARING,
          description: "PENDING → PREPARING",
        },
        {
          from: OrderStatus.PENDING,
          to: OrderStatus.CANCELLED,
          description: "PENDING → CANCELLED",
        },
        {
          from: OrderStatus.PREPARING,
          to: OrderStatus.READY,
          description: "PREPARING → READY",
        },
        {
          from: OrderStatus.PREPARING,
          to: OrderStatus.CANCELLED,
          description: "PREPARING → CANCELLED",
        },
        {
          from: OrderStatus.READY,
          to: OrderStatus.SERVED,
          description: "READY → SERVED",
        },
        {
          from: OrderStatus.READY,
          to: OrderStatus.CANCELLED,
          description: "READY → CANCELLED",
        },
        {
          from: OrderStatus.SERVED,
          to: OrderStatus.COMPLETED,
          description: "SERVED → COMPLETED",
        },
        {
          from: OrderStatus.SERVED,
          to: OrderStatus.CANCELLED,
          description: "SERVED → CANCELLED",
        },
        {
          from: OrderStatus.COMPLETED,
          to: OrderStatus.CANCELLED,
          description: "COMPLETED → CANCELLED (refund)",
        },
      ];

      validTransitions.forEach(({ from, to, description }) => {
        it(`should allow ${description}`, async () => {
          // Arrange
          const orderWithStatus = { ...mockOrder, status: from };
          prismaService.order.findUnique.mockResolvedValue(
            orderWithStatus as any,
          );
          prismaService.order.update.mockResolvedValue({
            ...orderWithStatus,
            status: to,
          } as any);

          // Act & Assert
          await expect(
            service.updateStatus(mockOrderId, { status: to }),
          ).resolves.toBeDefined();
        });
      });
    });

    describe("Invalid Transitions", () => {
      const invalidTransitions = [
        {
          from: OrderStatus.PENDING,
          to: OrderStatus.READY,
          description: "PENDING → READY",
        },
        {
          from: OrderStatus.PENDING,
          to: OrderStatus.SERVED,
          description: "PENDING → SERVED",
        },
        {
          from: OrderStatus.PENDING,
          to: OrderStatus.COMPLETED,
          description: "PENDING → COMPLETED",
        },
        {
          from: OrderStatus.PREPARING,
          to: OrderStatus.PENDING,
          description: "PREPARING → PENDING",
        },
        {
          from: OrderStatus.PREPARING,
          to: OrderStatus.SERVED,
          description: "PREPARING → SERVED",
        },
        {
          from: OrderStatus.READY,
          to: OrderStatus.PENDING,
          description: "READY → PENDING",
        },
        {
          from: OrderStatus.READY,
          to: OrderStatus.PREPARING,
          description: "READY → PREPARING",
        },
        {
          from: OrderStatus.SERVED,
          to: OrderStatus.PENDING,
          description: "SERVED → PENDING",
        },
        {
          from: OrderStatus.SERVED,
          to: OrderStatus.PREPARING,
          description: "SERVED → PREPARING",
        },
        {
          from: OrderStatus.COMPLETED,
          to: OrderStatus.PENDING,
          description: "COMPLETED → PENDING",
        },
        {
          from: OrderStatus.COMPLETED,
          to: OrderStatus.PREPARING,
          description: "COMPLETED → PREPARING",
        },
        {
          from: OrderStatus.COMPLETED,
          to: OrderStatus.READY,
          description: "COMPLETED → READY",
        },
        {
          from: OrderStatus.COMPLETED,
          to: OrderStatus.SERVED,
          description: "COMPLETED → SERVED",
        },
      ];

      invalidTransitions.forEach(({ from, to, description }) => {
        it(`should reject ${description}`, async () => {
          // Arrange
          const orderWithStatus = { ...mockOrder, status: from };
          prismaService.order.findUnique.mockResolvedValue(
            orderWithStatus as any,
          );

          // Act & Assert
          await expect(
            service.updateStatus(mockOrderId, { status: to }),
          ).rejects.toThrow(BadRequestException);
        });
      });
    });

    describe("Cancelled Order Transitions", () => {
      it("should reject all transitions from CANCELLED status", async () => {
        // Arrange
        const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
        prismaService.order.findUnique.mockResolvedValue(cancelledOrder as any);

        const allStatuses = [
          OrderStatus.PENDING,
          OrderStatus.PREPARING,
          OrderStatus.READY,
          OrderStatus.SERVED,
          OrderStatus.COMPLETED,
          OrderStatus.CANCELLED,
        ];

        // Act & Assert
        for (const status of allStatuses) {
          await expect(
            service.updateStatus(mockOrderId, { status }),
          ).rejects.toThrow(BadRequestException);
          await expect(
            service.updateStatus(mockOrderId, { status }),
          ).rejects.toThrow("Cannot update cancelled order");
        }
      });
    });
  });

  describe("getPaymentStatus", () => {
    describe("Single Payment Scenarios", () => {
      it("should calculate payment status for fully paid order with single payment", async () => {
        // Arrange
        const orderWithPayment = {
          ...mockOrder,
          grandTotal: new Decimal("100.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("100.00"),
              paymentMethod: "CASH",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithPayment as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("100.00"));
        expect(result.totalRefunded).toEqual(new Decimal("0"));
        expect(result.netPaid).toEqual(new Decimal("100.00"));
        expect(result.grandTotal).toEqual(new Decimal("100.00"));
        expect(result.remainingBalance).toEqual(new Decimal("0"));
        expect(result.isPaidInFull).toBe(true);
      });

      it("should calculate payment status for partially paid order", async () => {
        // Arrange
        const orderWithPayment = {
          ...mockOrder,
          grandTotal: new Decimal("100.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("60.00"),
              paymentMethod: "CASH",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithPayment as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("60.00"));
        expect(result.netPaid).toEqual(new Decimal("60.00"));
        expect(result.remainingBalance).toEqual(new Decimal("40.00"));
        expect(result.isPaidInFull).toBe(false);
      });

      it("should calculate payment status for unpaid order", async () => {
        // Arrange
        const unpaidOrder = {
          ...mockOrder,
          grandTotal: new Decimal("100.00"),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(unpaidOrder as any);

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("0"));
        expect(result.netPaid).toEqual(new Decimal("0"));
        expect(result.remainingBalance).toEqual(new Decimal("100.00"));
        expect(result.isPaidInFull).toBe(false);
      });
    });

    describe("Split Payment Scenarios (Bill Splitting)", () => {
      it("should calculate payment status for 2-way bill split (50/50)", async () => {
        // Arrange
        const orderWithSplitPayments = {
          ...mockOrder,
          grandTotal: new Decimal("100.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("50.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("50.00"),
              paymentMethod: "CREDIT_CARD",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithSplitPayments as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("100.00"));
        expect(result.netPaid).toEqual(new Decimal("100.00"));
        expect(result.remainingBalance).toEqual(new Decimal("0"));
        expect(result.isPaidInFull).toBe(true);
      });

      it("should calculate payment status for 3-way bill split", async () => {
        // Arrange
        const orderWith3WaySplit = {
          ...mockOrder,
          grandTotal: new Decimal("150.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("50.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("50.00"),
              paymentMethod: "CREDIT_CARD",
            },
            {
              id: "payment-3",
              amount: new Decimal("50.00"),
              paymentMethod: "EWALLET",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWith3WaySplit as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("150.00"));
        expect(result.netPaid).toEqual(new Decimal("150.00"));
        expect(result.remainingBalance).toEqual(new Decimal("0"));
        expect(result.isPaidInFull).toBe(true);
      });

      it("should calculate payment status for partial split payment (2 of 3 paid)", async () => {
        // Arrange
        const orderWithPartialSplit = {
          ...mockOrder,
          grandTotal: new Decimal("150.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("50.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("50.00"),
              paymentMethod: "CREDIT_CARD",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithPartialSplit as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("100.00"));
        expect(result.netPaid).toEqual(new Decimal("100.00"));
        expect(result.remainingBalance).toEqual(new Decimal("50.00"));
        expect(result.isPaidInFull).toBe(false);
      });

      it("should calculate payment status for unequal split payments", async () => {
        // Arrange
        const orderWithUnequalSplit = {
          ...mockOrder,
          grandTotal: new Decimal("117.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("70.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("30.00"),
              paymentMethod: "CREDIT_CARD",
            },
            {
              id: "payment-3",
              amount: new Decimal("17.00"),
              paymentMethod: "EWALLET",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithUnequalSplit as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("117.00"));
        expect(result.netPaid).toEqual(new Decimal("117.00"));
        expect(result.remainingBalance).toEqual(new Decimal("0"));
        expect(result.isPaidInFull).toBe(true);
      });
    });

    describe("Refund Scenarios", () => {
      it("should calculate net paid correctly with refunds", async () => {
        // Arrange
        const orderWithRefund = {
          ...mockOrder,
          grandTotal: new Decimal("100.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("100.00"),
              paymentMethod: "CASH",
            },
          ],
          refunds: [
            {
              id: "refund-1",
              amount: new Decimal("20.00"),
              reason: "Wrong item",
            },
          ],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithRefund as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("100.00"));
        expect(result.totalRefunded).toEqual(new Decimal("20.00"));
        expect(result.netPaid).toEqual(new Decimal("80.00"));
        expect(result.remainingBalance).toEqual(new Decimal("20.00"));
        expect(result.isPaidInFull).toBe(false);
      });

      it("should calculate payment status for split payments with refund", async () => {
        // Arrange
        const orderWithSplitAndRefund = {
          ...mockOrder,
          grandTotal: new Decimal("150.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("75.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("75.00"),
              paymentMethod: "CREDIT_CARD",
            },
          ],
          refunds: [
            {
              id: "refund-1",
              amount: new Decimal("30.00"),
              reason: "Partial refund",
            },
          ],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithSplitAndRefund as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid).toEqual(new Decimal("150.00"));
        expect(result.totalRefunded).toEqual(new Decimal("30.00"));
        expect(result.netPaid).toEqual(new Decimal("120.00"));
        expect(result.remainingBalance).toEqual(new Decimal("30.00"));
        expect(result.isPaidInFull).toBe(false);
      });
    });

    describe("Decimal Precision", () => {
      it("should maintain decimal precision for complex split calculations", async () => {
        // Arrange
        const orderWithComplexSplit = {
          ...mockOrder,
          grandTotal: new Decimal("99.99"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("33.33"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("33.33"),
              paymentMethod: "CREDIT_CARD",
            },
            {
              id: "payment-3",
              amount: new Decimal("33.33"),
              paymentMethod: "EWALLET",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithComplexSplit as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid.toFixed(2)).toBe("99.99");
        expect(result.remainingBalance.toFixed(2)).toBe("0.00");
        expect(result.isPaidInFull).toBe(true);
      });

      it("should handle very small remaining balances correctly", async () => {
        // Arrange
        const orderWithSmallRemaining = {
          ...mockOrder,
          grandTotal: new Decimal("100.01"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("100.00"),
              paymentMethod: "CASH",
            },
          ],
          refunds: [],
        };

        prismaService.order.findUnique.mockResolvedValue(
          orderWithSmallRemaining as any,
        );

        // Act
        const result = await service.getPaymentStatus(mockOrderId);

        // Assert
        expect(result.totalPaid.toFixed(2)).toBe("100.00");
        expect(result.remainingBalance.toFixed(2)).toBe("0.01");
        expect(result.isPaidInFull).toBe(false);
      });
    });

    describe("Error Handling", () => {
      it("should throw NotFoundException when order not found", async () => {
        // Arrange
        prismaService.order.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.getPaymentStatus("non-existent-id"),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.getPaymentStatus("non-existent-id"),
        ).rejects.toThrow("Order not found");
      });

      it("should throw InternalServerErrorException on database error", async () => {
        // Arrange
        prismaService.order.findUnique.mockRejectedValue(
          new Error("Database error"),
        );

        // Act & Assert
        await expect(service.getPaymentStatus(mockOrderId)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
    });
  });

  describe("findOne with payment status", () => {
    it("should include payment status fields in response", async () => {
      // Arrange
      const orderWithPayments = {
        ...mockOrder,
        grandTotal: new Decimal("100.00"),
        payments: [
          {
            id: "payment-1",
            amount: new Decimal("60.00"),
            paymentMethod: "CASH",
          },
        ],
        refunds: [],
      };

      prismaService.order.findUnique.mockResolvedValue(
        orderWithPayments as any,
      );

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(result.totalPaid).toBe("60.00");
      expect(result.remainingBalance).toBe("40.00");
      expect(result.isPaidInFull).toBe(false);
    });

    it("should show isPaidInFull as true for split payments that complete payment", async () => {
      // Arrange
      const orderWithSplitPayments = {
        ...mockOrder,
        grandTotal: new Decimal("100.00"),
        payments: [
          {
            id: "payment-1",
            amount: new Decimal("50.00"),
            paymentMethod: "CASH",
          },
          {
            id: "payment-2",
            amount: new Decimal("50.00"),
            paymentMethod: "CREDIT_CARD",
          },
        ],
        refunds: [],
      };

      prismaService.order.findUnique.mockResolvedValue(
        orderWithSplitPayments as any,
      );

      // Act
      const result = await service.findOne(mockOrderId);

      // Assert
      expect(result.totalPaid).toBe("100.00");
      expect(result.remainingBalance).toBe("0.00");
      expect(result.isPaidInFull).toBe(true);
    });
  });

  describe("findByStore with payment status", () => {
    it("should include payment status for all orders in paginated response", async () => {
      // Arrange
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      const orders = [
        {
          ...mockOrder,
          id: "order-1",
          grandTotal: new Decimal("100.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("100.00"),
              paymentMethod: "CASH",
            },
          ],
          refunds: [],
        },
        {
          ...mockOrder,
          id: "order-2",
          grandTotal: new Decimal("150.00"),
          payments: [
            {
              id: "payment-2",
              amount: new Decimal("75.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-3",
              amount: new Decimal("75.00"),
              paymentMethod: "CREDIT_CARD",
            },
          ],
          refunds: [],
        },
      ];

      prismaService.order.findMany.mockResolvedValue(orders as any);
      prismaService.order.count.mockResolvedValue(2);

      // Act
      const result = await service.findByStore(mockStoreId, paginationDto);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.items[0].totalPaid).toBe("100.00");
      expect(result.items[0].isPaidInFull).toBe(true);
      expect(result.items[1].totalPaid).toBe("150.00");
      expect(result.items[1].isPaidInFull).toBe(true);
    });

    it("should correctly calculate payment status for partially paid split orders", async () => {
      // Arrange
      const paginationDto = {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      };

      const orders = [
        {
          ...mockOrder,
          grandTotal: new Decimal("150.00"),
          payments: [
            {
              id: "payment-1",
              amount: new Decimal("50.00"),
              paymentMethod: "CASH",
            },
            {
              id: "payment-2",
              amount: new Decimal("50.00"),
              paymentMethod: "CREDIT_CARD",
            },
          ],
          refunds: [],
        },
      ];

      prismaService.order.findMany.mockResolvedValue(orders as any);
      prismaService.order.count.mockResolvedValue(1);

      // Act
      const result = await service.findByStore(mockStoreId, paginationDto);

      // Assert
      expect(result.items[0].totalPaid).toBe("100.00");
      expect(result.items[0].remainingBalance).toBe("50.00");
      expect(result.items[0].isPaidInFull).toBe(false);
    });
  });

  describe("applyDiscount", () => {
    const mockUserId = "user-123";
    const mockOrderWithSession = {
      ...mockOrder,
      id: mockOrderId,
      subTotal: new Decimal("100.00"),
      vatRateSnapshot: new Decimal("0.07"),
      serviceChargeRateSnapshot: new Decimal("0.10"),
      vatAmount: new Decimal("7.00"),
      serviceChargeAmount: new Decimal("10.00"),
      grandTotal: new Decimal("117.00"),
      session: mockActiveSession,
    };

    it("should apply percentage discount successfully (small discount <10%)", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "5",
        reason: "Loyalty customer",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      // Mock payment status check
      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      const updatedOrder = {
        ...mockOrderWithSession,
        discountType: DiscountType.PERCENTAGE,
        discountValue: new Decimal("5"),
        discountAmount: new Decimal("5.00"), // 5% of 100
        discountReason: dto.reason,
        discountAppliedBy: mockUserId,
        vatAmount: new Decimal("6.65"), // 7% of 95
        serviceChargeAmount: new Decimal("9.50"), // 10% of 95
        grandTotal: new Decimal("111.15"), // 95 + 6.65 + 9.50
      };

      prismaService.order.update.mockResolvedValue(updatedOrder as any);
      jest.spyOn(service, "findOne").mockResolvedValue(updatedOrder as any);

      // Act
      const result = await service.applyDiscount(
        mockUserId,
        mockStoreId,
        mockOrderId,
        dto,
      );

      // Assert
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN, Role.CASHIER],
      );
      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({
          discountType: DiscountType.PERCENTAGE,
          discountValue: expect.any(Decimal),
          discountAmount: expect.any(Decimal),
          discountReason: dto.reason,
          discountAppliedBy: mockUserId,
        }),
      });
      expect(result.discountAmount).toEqual(new Decimal("5.00"));
    });

    it("should apply fixed amount discount successfully (small discount <10%)", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: "8.00",
        reason: "Special occasion",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      const updatedOrder = {
        ...mockOrderWithSession,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: new Decimal("8.00"),
        discountAmount: new Decimal("8.00"),
        discountReason: dto.reason,
      };

      prismaService.order.update.mockResolvedValue(updatedOrder as any);
      jest.spyOn(service, "findOne").mockResolvedValue(updatedOrder as any);

      // Act
      const result = await service.applyDiscount(
        mockUserId,
        mockStoreId,
        mockOrderId,
        dto,
      );

      // Assert
      expect(result.discountAmount).toEqual(new Decimal("8.00"));
    });

    it("should enforce ADMIN permission for medium discount (10-50%)", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "25",
        reason: "Manager comp",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      const updatedOrder = {
        ...mockOrderWithSession,
        discountAmount: new Decimal("25.00"),
      };

      prismaService.order.update.mockResolvedValue(updatedOrder as any);
      jest.spyOn(service, "findOne").mockResolvedValue(updatedOrder as any);

      // Act
      await service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto);

      // Assert
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
    });

    it("should enforce OWNER permission for large discount (>50%)", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "60",
        reason: "Owner approval",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      const updatedOrder = {
        ...mockOrderWithSession,
        discountAmount: new Decimal("60.00"),
      };

      prismaService.order.update.mockResolvedValue(updatedOrder as any);
      jest.spyOn(service, "findOne").mockResolvedValue(updatedOrder as any);

      // Act
      await service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto);

      // Assert
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER],
      );
    });

    it("should reject discount if user lacks permission", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "60",
        reason: "Unauthorized",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Insufficient permissions"),
      );

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw error if order not found", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "5",
        reason: "Test",
      };

      prismaService.order.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw error if order belongs to different store", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "5",
        reason: "Test",
      };

      const differentStoreOrder = {
        ...mockOrderWithSession,
        session: {
          ...mockActiveSession,
          table: {
            ...mockActiveSession.table,
            storeId: "different-store",
          },
        },
      };

      prismaService.order.findUnique.mockResolvedValue(
        differentStoreOrder as any,
      );

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw error if order is already paid", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "5",
        reason: "Test",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("117.00"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("117.00"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("0"),
        isPaidInFull: true,
      });

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if percentage exceeds 100%", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "105",
        reason: "Invalid",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if fixed amount exceeds subtotal", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: "150.00",
        reason: "Invalid",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      // Act & Assert
      await expect(
        service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should recalculate totals correctly with discount", async () => {
      // Arrange
      const dto: ApplyDiscountDto = {
        discountType: DiscountType.PERCENTAGE,
        discountValue: "10",
        reason: "Loyalty discount",
      };

      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithSession as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("117.00"),
        remainingBalance: new Decimal("117.00"),
        isPaidInFull: false,
      });

      let capturedUpdateData: any;
      prismaService.order.update.mockImplementation((args) => {
        capturedUpdateData = args.data;
        return Promise.resolve({
          ...mockOrderWithSession,
          ...args.data,
        });
      });

      jest.spyOn(service, "findOne").mockResolvedValue({
        ...mockOrderWithSession,
        ...capturedUpdateData,
      });

      // Act
      await service.applyDiscount(mockUserId, mockStoreId, mockOrderId, dto);

      // Assert
      const discountAmount = new Decimal("10.00"); // 10% of 100
      const newSubtotal = new Decimal("90.00"); // 100 - 10
      const expectedTax = newSubtotal.mul("0.07"); // 6.30
      const expectedServiceCharge = newSubtotal.mul("0.10"); // 9.00
      const expectedGrandTotal = newSubtotal
        .add(expectedTax)
        .add(expectedServiceCharge); // 105.30

      expect(capturedUpdateData.discountAmount.toFixed(2)).toBe(
        discountAmount.toFixed(2),
      );
      expect(capturedUpdateData.vatAmount.toFixed(2)).toBe(
        expectedTax.toFixed(2),
      );
      expect(capturedUpdateData.serviceChargeAmount.toFixed(2)).toBe(
        expectedServiceCharge.toFixed(2),
      );
      expect(capturedUpdateData.grandTotal.toFixed(2)).toBe(
        expectedGrandTotal.toFixed(2),
      );
    });
  });

  describe("removeDiscount", () => {
    const mockUserId = "user-123";
    const mockOrderWithDiscount = {
      ...mockOrder,
      id: mockOrderId,
      subTotal: new Decimal("100.00"),
      vatRateSnapshot: new Decimal("0.07"),
      serviceChargeRateSnapshot: new Decimal("0.10"),
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Decimal("10"),
      discountAmount: new Decimal("10.00"),
      discountReason: "Loyalty",
      discountAppliedBy: "admin-123",
      discountAppliedAt: new Date(),
      vatAmount: new Decimal("6.30"),
      serviceChargeAmount: new Decimal("9.00"),
      grandTotal: new Decimal("105.30"),
      session: mockActiveSession,
    };

    it("should remove discount successfully", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithDiscount as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("105.30"),
        remainingBalance: new Decimal("105.30"),
        isPaidInFull: false,
      });

      const updatedOrder = {
        ...mockOrderWithDiscount,
        discountType: null,
        discountValue: null,
        discountAmount: null,
        discountReason: null,
        discountAppliedBy: null,
        discountAppliedAt: null,
        vatAmount: new Decimal("7.00"),
        serviceChargeAmount: new Decimal("10.00"),
        grandTotal: new Decimal("117.00"),
      };

      prismaService.order.update.mockResolvedValue(updatedOrder as any);
      jest.spyOn(service, "findOne").mockResolvedValue(updatedOrder as any);

      // Act
      const result = await service.removeDiscount(
        mockUserId,
        mockStoreId,
        mockOrderId,
      );

      // Assert
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({
          discountType: null,
          discountValue: null,
          discountAmount: null,
          discountReason: null,
          discountAppliedBy: null,
          discountAppliedAt: null,
        }),
      });
      expect(result.discountType).toBeNull();
    });

    it("should recalculate totals correctly after removing discount", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithDiscount as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("105.30"),
        remainingBalance: new Decimal("105.30"),
        isPaidInFull: false,
      });

      let capturedUpdateData: any;
      prismaService.order.update.mockImplementation((args) => {
        capturedUpdateData = args.data;
        return Promise.resolve({
          ...mockOrderWithDiscount,
          ...args.data,
        });
      });

      jest.spyOn(service, "findOne").mockResolvedValue({
        ...mockOrderWithDiscount,
        ...capturedUpdateData,
      });

      // Act
      await service.removeDiscount(mockUserId, mockStoreId, mockOrderId);

      // Assert
      const originalSubtotal = new Decimal("100.00");
      const expectedTax = originalSubtotal.mul("0.07"); // 7.00
      const expectedServiceCharge = originalSubtotal.mul("0.10"); // 10.00
      const expectedGrandTotal = originalSubtotal
        .add(expectedTax)
        .add(expectedServiceCharge); // 117.00

      expect(capturedUpdateData.vatAmount.toFixed(2)).toBe(
        expectedTax.toFixed(2),
      );
      expect(capturedUpdateData.serviceChargeAmount.toFixed(2)).toBe(
        expectedServiceCharge.toFixed(2),
      );
      expect(capturedUpdateData.grandTotal.toFixed(2)).toBe(
        expectedGrandTotal.toFixed(2),
      );
    });

    it("should throw error if user lacks ADMIN or OWNER permission", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithDiscount as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("0"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("0"),
        grandTotal: new Decimal("105.30"),
        remainingBalance: new Decimal("105.30"),
        isPaidInFull: false,
      });

      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Insufficient permissions"),
      );

      // Act & Assert
      await expect(
        service.removeDiscount(mockUserId, mockStoreId, mockOrderId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw error if order not found", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeDiscount(mockUserId, mockStoreId, mockOrderId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw error if order is already paid", async () => {
      // Arrange
      prismaService.order.findUnique.mockResolvedValue(
        mockOrderWithDiscount as any,
      );

      jest.spyOn(service, "getPaymentStatus").mockResolvedValue({
        totalPaid: new Decimal("105.30"),
        totalRefunded: new Decimal("0"),
        netPaid: new Decimal("105.30"),
        grandTotal: new Decimal("105.30"),
        remainingBalance: new Decimal("0"),
        isPaidInFull: true,
      });

      // Act & Assert
      await expect(
        service.removeDiscount(mockUserId, mockStoreId, mockOrderId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
