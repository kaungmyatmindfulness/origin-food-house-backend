import {
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { Role, SessionStatus } from "src/generated/prisma/client";

import { CartService } from "./cart.service";
import { AuthService } from "../auth/auth.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";

describe("CartService", () => {
  let service: CartService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockSessionId = "session-123";
  const mockSessionToken = "valid-session-token";
  const mockUserId = "user-123";
  const mockStoreId = "store-123";

  const mockActiveSession = {
    id: mockSessionId,
    sessionToken: mockSessionToken,
    status: SessionStatus.ACTIVE,
    storeId: mockStoreId,
    tableId: "table-123",
    guestCount: 2,
    createdAt: new Date(),
    closedAt: null,
    table: {
      id: "table-123",
      storeId: mockStoreId,
      number: "1",
      qrCode: "qr-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      store: {
        id: mockStoreId,
        slug: "test-store",
        name: "Test Store",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    },
  };

  const mockClosedSession = {
    ...mockActiveSession,
    status: SessionStatus.CLOSED,
    closedAt: new Date(),
  };

  const mockCart = {
    id: "cart-123",
    sessionId: mockSessionId,
    storeId: mockStoreId,
    subTotal: "0",
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMenuItem = {
    id: "menu-item-123",
    storeId: mockStoreId,
    categoryId: "cat-123",
    name: "Burger",
    description: "Delicious burger",
    basePrice: "9.99",
    imageUrl: null,
    sortOrder: 0,
    isOutOfStock: false,
    isHidden: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customizationGroups: [],
  };

  const mockCustomizationOption = {
    id: "option-123",
    customizationGroupId: "group-123",
    name: "Extra Cheese",
    additionalPrice: "1.50",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
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

    service = module.get<CartService>(CartService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateSessionAccess", () => {
    describe("Session Not Found", () => {
      it("should throw NotFoundException when session does not exist", async () => {
        prismaService.activeTableSession.findUnique.mockResolvedValue(null);

        await expect(
          service.getCart(mockSessionId, mockSessionToken),
        ).rejects.toThrow(NotFoundException);

        expect(
          prismaService.activeTableSession.findUnique,
        ).toHaveBeenCalledWith({
          where: { id: mockSessionId },
          include: {
            table: {
              include: {
                store: true,
              },
            },
          },
        });
      });
    });

    describe("Session Status Validation", () => {
      it("should throw BadRequestException when session is closed", async () => {
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockClosedSession as any,
        );

        await expect(
          service.getCart(mockSessionId, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.getCart(mockSessionId, mockSessionToken),
        ).rejects.toThrow("Session is closed and cannot be modified");
      });
    });

    describe("Authentication Required", () => {
      it("should throw UnauthorizedException when no authentication provided", async () => {
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );

        await expect(
          service.getCart(mockSessionId, undefined, undefined),
        ).rejects.toThrow(UnauthorizedException);
        await expect(
          service.getCart(mockSessionId, undefined, undefined),
        ).rejects.toThrow("Authentication required to access cart");
      });
    });

    describe("Customer Access (Session Token)", () => {
      it("should allow access with valid session token", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // First call in validateSessionAccess
          .mockResolvedValueOnce(mockActiveSession as any); // Second call in getCart

        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        const result = await service.getCart(mockSessionId, mockSessionToken);

        expect(result).toBeDefined();
        expect(prismaService.activeTableSession.findUnique).toHaveBeenCalled();
      });

      it("should throw ForbiddenException with invalid session token", async () => {
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );

        await expect(
          service.getCart(mockSessionId, "invalid-token"),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.getCart(mockSessionId, "invalid-token"),
        ).rejects.toThrow(
          "Invalid session token. You do not have access to this cart.",
        );
      });
    });

    describe("Staff Access (User ID)", () => {
      it("should allow access for staff with store permission", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // First call in validateSessionAccess
          .mockResolvedValueOnce(mockActiveSession as any); // Second call in getCart

        authService.checkStorePermission.mockResolvedValue(undefined);

        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        const result = await service.getCart(
          mockSessionId,
          undefined,
          mockUserId,
        );

        expect(result).toBeDefined();
        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CHEF, Role.CASHIER, Role.SERVER],
        );
      });

      it("should throw ForbiddenException when staff lacks store permission", async () => {
        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockActiveSession as any,
        );

        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException("Access denied"),
        );

        await expect(
          service.getCart(mockSessionId, undefined, mockUserId),
        ).rejects.toThrow(ForbiddenException);
        await expect(
          service.getCart(mockSessionId, undefined, mockUserId),
        ).rejects.toThrow(
          "You do not have permission to access this store cart",
        );
      });
    });

    describe("Multiple Operations", () => {
      it("should validate access for addItem operation", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in addItem
          .mockResolvedValueOnce(mockActiveSession as any) // addItem - get session
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in getCart
          .mockResolvedValueOnce(mockActiveSession as any); // getCart - get session

        prismaService.menuItem.findUnique.mockResolvedValue({
          id: "menu-item-123",
          name: "Test Item",
          basePrice: "10.00",
          storeId: mockStoreId,
          categoryId: "cat-123",
          isOutOfStock: false,
          isHidden: false,
          deletedAt: null,
          customizationGroups: [],
        } as any);

        prismaService.cart.findUnique.mockResolvedValue(mockCart as any);

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            cart: {
              findUnique: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                storeId: mockStoreId,
                subTotal: "0",
              }),
              create: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                storeId: mockStoreId,
                subTotal: "0",
              }),
              update: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                storeId: mockStoreId,
                subTotal: "10.00",
                items: [],
              }),
            },
            cartItem: {
              create: jest.fn().mockResolvedValue({
                id: "cart-item-123",
                cartId: "cart-123",
                menuItemId: "menu-item-123",
                quantity: 1,
              }),
              findMany: jest.fn().mockResolvedValue([
                {
                  id: "cart-item-123",
                  basePrice: "10.00",
                  quantity: 1,
                  customizations: [],
                },
              ]),
            },
            customizationOption: {
              findUnique: jest.fn(),
            },
            cartItemCustomization: {
              createMany: jest.fn(),
            },
          } as any;

          return callback(mockTx);
        });

        const dto = {
          menuItemId: "menu-item-123",
          quantity: 1,
        };

        await service.addItem(mockSessionId, dto, mockSessionToken);

        expect(prismaService.activeTableSession.findUnique).toHaveBeenCalled();
      });

      it("should validate access for updateItem operation", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in updateItem
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in getCart
          .mockResolvedValueOnce(mockActiveSession as any); // getCart - get session

        prismaService.cartItem.findUnique.mockResolvedValue({
          id: "cart-item-123",
          cartId: "cart-123",
          cart: {
            id: "cart-123",
            sessionId: mockSessionId,
          },
        } as any);

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            cartItem: {
              update: jest.fn().mockResolvedValue({
                id: "cart-item-123",
                quantity: 2,
              }),
              findMany: jest.fn().mockResolvedValue([]),
            },
            cart: {
              update: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                subTotal: "20.00",
                items: [],
              }),
            },
          } as any;

          return callback(mockTx);
        });

        prismaService.cart.findUnique.mockResolvedValue({
          id: "cart-123",
          sessionId: mockSessionId,
          subTotal: "20.00",
          items: [],
        } as any);

        const dto = { quantity: 2 };

        await service.updateItem(
          mockSessionId,
          "cart-item-123",
          dto,
          mockSessionToken,
        );

        expect(prismaService.activeTableSession.findUnique).toHaveBeenCalled();
      });

      it("should validate access for removeItem operation", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in removeItem
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in getCart
          .mockResolvedValueOnce(mockActiveSession as any); // getCart - get session

        prismaService.cartItem.findUnique.mockResolvedValue({
          id: "cart-item-123",
          cartId: "cart-123",
          cart: {
            id: "cart-123",
            sessionId: mockSessionId,
          },
        } as any);

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            cartItem: {
              delete: jest.fn().mockResolvedValue({ id: "cart-item-123" }),
              findMany: jest.fn().mockResolvedValue([]),
            },
            cart: {
              update: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                subTotal: "0",
                items: [],
              }),
            },
          } as any;

          return callback(mockTx);
        });

        prismaService.cart.findUnique.mockResolvedValue({
          id: "cart-123",
          sessionId: mockSessionId,
          subTotal: "0",
          items: [],
        } as any);

        await service.removeItem(
          mockSessionId,
          "cart-item-123",
          mockSessionToken,
        );

        expect(prismaService.activeTableSession.findUnique).toHaveBeenCalled();
      });

      it("should validate access for clearCart operation", async () => {
        prismaService.activeTableSession.findUnique
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in clearCart
          .mockResolvedValueOnce(mockActiveSession as any) // validateSessionAccess in getCart
          .mockResolvedValueOnce(mockActiveSession as any); // getCart - get session

        prismaService.cart.findUnique.mockResolvedValue({
          id: "cart-123",
          sessionId: mockSessionId,
          subTotal: "0",
          items: [],
        } as any);

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            cartItem: {
              deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
            },
            cart: {
              update: jest.fn().mockResolvedValue({
                id: "cart-123",
                sessionId: mockSessionId,
                subTotal: "0",
              }),
            },
          } as any;

          return callback(mockTx);
        });

        await service.clearCart(mockSessionId, mockSessionToken);

        expect(prismaService.activeTableSession.findUnique).toHaveBeenCalled();
      });
    });
  });

  describe("getCart", () => {
    it("should get existing cart for session", async () => {
      prismaService.activeTableSession.findUnique
        .mockResolvedValueOnce(mockActiveSession as any)
        .mockResolvedValueOnce(mockActiveSession as any);

      const existingCart = {
        ...mockCart,
        subTotal: "15.99",
        items: [
          {
            id: "item-1",
            cartId: "cart-123",
            menuItemId: "menu-item-123",
            menuItemName: "Burger",
            basePrice: "9.99",
            quantity: 1,
            customizations: [],
          },
        ],
      };

      prismaService.cart.findUnique.mockResolvedValue(existingCart as any);

      const result = await service.getCart(mockSessionId, mockSessionToken);

      expect(result).toEqual(existingCart);
      expect(prismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { sessionId: mockSessionId },
        include: {
          items: {
            include: { customizations: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    it("should create new cart if none exists", async () => {
      prismaService.activeTableSession.findUnique
        .mockResolvedValueOnce(mockActiveSession as any)
        .mockResolvedValueOnce(mockActiveSession as any);

      prismaService.cart.findUnique.mockResolvedValueOnce(null);
      prismaService.cart.create.mockResolvedValue(mockCart as any);

      const result = await service.getCart(mockSessionId, mockSessionToken);

      expect(result).toEqual(mockCart);
      expect(prismaService.cart.create).toHaveBeenCalledWith({
        data: {
          sessionId: mockSessionId,
          storeId: mockStoreId,
          subTotal: expect.any(Object), // Decimal object
        },
        include: {
          items: {
            include: { customizations: true },
          },
        },
      });
    });

    it("should calculate subtotal from items", async () => {
      prismaService.activeTableSession.findUnique
        .mockResolvedValueOnce(mockActiveSession as any)
        .mockResolvedValueOnce(mockActiveSession as any);

      const cartWithItems = {
        ...mockCart,
        subTotal: "19.98",
        items: [
          {
            id: "item-1",
            basePrice: "9.99",
            quantity: 2,
            customizations: [],
          },
        ],
      };

      prismaService.cart.findUnique.mockResolvedValue(cartWithItems as any);

      const result = await service.getCart(mockSessionId, mockSessionToken);

      expect(result.subTotal).toBe("19.98");
    });

    it("should include all cart items with customizations", async () => {
      prismaService.activeTableSession.findUnique
        .mockResolvedValueOnce(mockActiveSession as any)
        .mockResolvedValueOnce(mockActiveSession as any);

      const cartWithCustomizations = {
        ...mockCart,
        items: [
          {
            id: "item-1",
            customizations: [
              {
                id: "custom-1",
                customizationOptionId: "option-123",
                optionName: "Extra Cheese",
                additionalPrice: "1.50",
              },
            ],
          },
        ],
      };

      prismaService.cart.findUnique.mockResolvedValue(
        cartWithCustomizations as any,
      );

      const result = await service.getCart(mockSessionId, mockSessionToken);

      expect(result.items[0].customizations).toHaveLength(1);
      expect(result.items[0].customizations[0].optionName).toBe("Extra Cheese");
    });
  });

  describe("addItem", () => {
    const addItemDto = {
      menuItemId: "menu-item-123",
      quantity: 1,
      notes: "No onions",
    };

    beforeEach(() => {
      // Default successful mocks
      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.menuItem.findUnique.mockResolvedValue(mockMenuItem as any);
    });

    describe("Happy Path", () => {
      it("should add item to existing cart", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "9.99",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({
              id: "cart-item-123",
              cartId: "cart-123",
              menuItemId: "menu-item-123",
              quantity: 1,
            }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "cart-item-123",
                basePrice: "9.99",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "9.99",
          items: [
            {
              id: "cart-item-123",
              menuItemId: "menu-item-123",
              customizations: [],
            },
          ],
        } as any);

        await service.addItem(mockSessionId, addItemDto, mockSessionToken);

        expect(mockTx.cartItem.create).toHaveBeenCalledWith({
          data: {
            cartId: "cart-123",
            menuItemId: "menu-item-123",
            menuItemName: "Burger",
            basePrice: "9.99",
            quantity: 1,
            notes: "No onions",
          },
        });
      });

      it("should create cart if does not exist", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "9.99",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({
              id: "cart-item-123",
              cartId: "cart-123",
            }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "cart-item-123",
                basePrice: "9.99",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          items: [],
        } as any);

        await service.addItem(mockSessionId, addItemDto, mockSessionToken);

        expect(mockTx.cart.create).toHaveBeenCalledWith({
          data: {
            sessionId: mockSessionId,
            storeId: mockStoreId,
            subTotal: expect.any(Object),
          },
        });
      });

      it("should use transaction for atomicity", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(mockCart),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          items: [],
        } as any);

        await service.addItem(mockSessionId, addItemDto, mockSessionToken);

        expect(prismaService.$transaction).toHaveBeenCalled();
      });

      it("should recalculate cart total", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "9.99",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "9.99",
          items: [{ id: "item-1" }],
        } as any);

        await service.addItem(mockSessionId, addItemDto, mockSessionToken);

        expect(mockTx.cartItem.findMany).toHaveBeenCalled();
        expect(mockTx.cart.update).toHaveBeenCalledWith({
          where: { id: "cart-123" },
          data: { subTotal: expect.any(Object) },
          include: {
            items: {
              include: { customizations: true },
              orderBy: { createdAt: "asc" },
            },
          },
        });
      });

      it("should return updated cart", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "9.99",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        const updatedCart = {
          ...mockCart,
          subTotal: "9.99",
          items: [
            {
              id: "item-1",
              menuItemName: "Burger",
              basePrice: "9.99",
              quantity: 1,
              customizations: [],
            },
          ],
        };

        prismaService.cart.findUnique.mockResolvedValue(updatedCart as any);

        const result = await service.addItem(
          mockSessionId,
          addItemDto,
          mockSessionToken,
        );

        expect(result).toEqual(updatedCart);
      });
    });

    describe("Price Calculations (Decimal Precision)", () => {
      it("should calculate item total: basePrice × quantity", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "29.97",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 3,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "29.97",
          items: [{ id: "item-1" }],
        } as any);

        const dto = { ...addItemDto, quantity: 3 };
        const result = await service.addItem(
          mockSessionId,
          dto,
          mockSessionToken,
        );

        expect(result.subTotal).toBe("29.97");
      });

      it("should add customization prices: (basePrice + customPrice) × quantity", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "22.98",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 2,
                customizations: [
                  {
                    id: "custom-1",
                    additionalPrice: "1.50",
                  },
                ],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest
              .fn()
              .mockResolvedValue(mockCustomizationOption as any),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "22.98",
          items: [{ id: "item-1" }],
        } as any);

        prismaService.customizationOption.findMany.mockResolvedValue([
          mockCustomizationOption as any,
        ]);

        const dto = {
          ...addItemDto,
          quantity: 2,
          customizations: [{ customizationOptionId: "option-123" }],
        };

        const result = await service.addItem(
          mockSessionId,
          dto,
          mockSessionToken,
        );

        // (9.99 + 1.50) × 2 = 22.98
        expect(result.subTotal).toBe("22.98");
      });

      it("should handle Decimal precision: $9.99 × 3 = $29.97", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "29.97",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 3,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "29.97",
          items: [{ id: "item-1" }],
        } as any);

        const dto = { ...addItemDto, quantity: 3 };
        const result = await service.addItem(
          mockSessionId,
          dto,
          mockSessionToken,
        );

        expect(result.subTotal).toBe("29.97");
        expect(result.subTotal).not.toBe("29.970000");
      });

      it("should calculate cart total: sum of all item totals", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "35.48",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-2" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 2,
                customizations: [],
              },
              {
                id: "item-2",
                basePrice: "15.50",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "35.48",
          items: [{ id: "item-1" }, { id: "item-2" }],
        } as any);

        const dto = { menuItemId: "menu-item-456", quantity: 1 };

        prismaService.menuItem.findUnique.mockResolvedValue({
          ...mockMenuItem,
          id: "menu-item-456",
          basePrice: "15.50",
        } as any);

        const result = await service.addItem(
          mockSessionId,
          dto,
          mockSessionToken,
        );

        // 9.99 × 2 + 15.50 × 1 = 35.48
        expect(result.subTotal).toBe("35.48");
      });

      it("should handle zero prices correctly", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "0.00",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "0.00",
                quantity: 1,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "0.00",
          items: [{ id: "item-1" }],
        } as any);

        prismaService.menuItem.findUnique.mockResolvedValue({
          ...mockMenuItem,
          basePrice: "0.00",
        } as any);

        const result = await service.addItem(
          mockSessionId,
          addItemDto,
          mockSessionToken,
        );

        expect(result.subTotal).toBe("0.00");
      });

      it("should handle high quantities (99)", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn().mockResolvedValue({
              ...mockCart,
              subTotal: "989.01",
            }),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: "item-1",
                basePrice: "9.99",
                quantity: 99,
                customizations: [],
              },
            ]),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.cart.findUnique.mockResolvedValue({
          ...mockCart,
          subTotal: "989.01",
          items: [{ id: "item-1" }],
        } as any);

        const dto = { ...addItemDto, quantity: 99 };
        const result = await service.addItem(
          mockSessionId,
          dto,
          mockSessionToken,
        );

        // 9.99 × 99 = 989.01
        expect(result.subTotal).toBe("989.01");
      });
    });

    describe("Validation (Security)", () => {
      it("should reject out-of-stock items", async () => {
        prismaService.menuItem.findUnique.mockResolvedValue({
          ...mockMenuItem,
          isOutOfStock: true,
        } as any);

        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow("Menu item is out of stock");
      });

      it("should reject hidden items", async () => {
        prismaService.menuItem.findUnique.mockResolvedValue({
          ...mockMenuItem,
          isHidden: true,
        } as any);

        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow("Menu item is not available");
      });

      it("should reject deleted items", async () => {
        prismaService.menuItem.findUnique.mockResolvedValue({
          ...mockMenuItem,
          deletedAt: new Date(),
        } as any);

        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow("Menu item is not available");
      });

      it("should reject invalid menu item ID", async () => {
        prismaService.menuItem.findUnique.mockResolvedValue(null);

        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow("Menu item not found");
      });

      it("should reject invalid customization option IDs", async () => {
        prismaService.customizationOption.findMany.mockResolvedValue([]);

        const dto = {
          ...addItemDto,
          customizations: [{ customizationOptionId: "invalid-option" }],
        };

        await expect(
          service.addItem(mockSessionId, dto, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.addItem(mockSessionId, dto, mockSessionToken),
        ).rejects.toThrow("Invalid customization options");
      });

      it("should reject customizations with mismatched count", async () => {
        prismaService.customizationOption.findMany.mockResolvedValue([
          mockCustomizationOption as any,
        ]);

        const dto = {
          ...addItemDto,
          customizations: [
            { customizationOptionId: "option-123" },
            { customizationOptionId: "option-456" },
          ],
        };

        await expect(
          service.addItem(mockSessionId, dto, mockSessionToken),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe("Transaction Integrity", () => {
      it("should rollback on error", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn(),
          },
          cartItem: {
            create: jest.fn().mockRejectedValue(new Error("DB Error")),
            findMany: jest.fn(),
          },
          cartItemCustomization: {
            createMany: jest.fn(),
          },
          customizationOption: {
            findUnique: jest.fn(),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        await expect(
          service.addItem(mockSessionId, addItemDto, mockSessionToken),
        ).rejects.toThrow();

        // Cart should not be updated if item creation fails
        expect(mockTx.cart.update).not.toHaveBeenCalled();
      });

      it("should rollback on customization creation failure", async () => {
        const mockTx = {
          cart: {
            findUnique: jest.fn().mockResolvedValue(mockCart),
            update: jest.fn(),
          },
          cartItem: {
            create: jest.fn().mockResolvedValue({ id: "item-1" }),
            findMany: jest.fn(),
          },
          cartItemCustomization: {
            createMany: jest.fn().mockRejectedValue(new Error("DB Error")),
          },
          customizationOption: {
            findUnique: jest
              .fn()
              .mockResolvedValue(mockCustomizationOption as any),
          },
        };

        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.customizationOption.findMany.mockResolvedValue([
          mockCustomizationOption as any,
        ]);

        const dto = {
          ...addItemDto,
          customizations: [{ customizationOptionId: "option-123" }],
        };

        await expect(
          service.addItem(mockSessionId, dto, mockSessionToken),
        ).rejects.toThrow();

        // Cart should not be updated if customization creation fails
        expect(mockTx.cart.update).not.toHaveBeenCalled();
      });
    });
  });

  describe("updateItem", () => {
    const cartItemId = "cart-item-123";
    const updateDto = { quantity: 2, notes: "Extra sauce" };

    beforeEach(() => {
      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
    });

    it("should update item quantity", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          update: jest.fn().mockResolvedValue({
            ...mockCartItem,
            quantity: 2,
          }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: cartItemId,
              basePrice: "9.99",
              quantity: 2,
              customizations: [],
            },
          ]),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "19.98",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        subTotal: "19.98",
        items: [{ id: cartItemId, quantity: 2 }],
      } as any);

      await service.updateItem(
        mockSessionId,
        cartItemId,
        updateDto,
        mockSessionToken,
      );

      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: cartItemId },
        data: {
          quantity: 2,
          notes: "Extra sauce",
        },
      });
    });

    it("should update item notes", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          update: jest.fn().mockResolvedValue({
            ...mockCartItem,
            notes: "Extra sauce",
          }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: cartItemId,
              basePrice: "9.99",
              quantity: 1,
              customizations: [],
            },
          ]),
        },
        cart: {
          update: jest.fn().mockResolvedValue(mockCart),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [{ id: cartItemId }],
      } as any);

      await service.updateItem(
        mockSessionId,
        cartItemId,
        { notes: "Extra sauce" },
        mockSessionToken,
      );

      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: cartItemId },
        data: {
          quantity: undefined,
          notes: "Extra sauce",
        },
      });
    });

    it("should recalculate cart total after update", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          update: jest.fn().mockResolvedValue(mockCartItem),
          findMany: jest.fn().mockResolvedValue([
            {
              id: cartItemId,
              basePrice: "9.99",
              quantity: 3,
              customizations: [],
            },
          ]),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "29.97",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        subTotal: "29.97",
        items: [{ id: cartItemId }],
      } as any);

      await service.updateItem(
        mockSessionId,
        cartItemId,
        { quantity: 3 },
        mockSessionToken,
      );

      expect(mockTx.cartItem.findMany).toHaveBeenCalled();
      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: "cart-123" },
        data: { subTotal: expect.any(Object) },
        include: {
          items: {
            include: { customizations: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    it("should use transaction", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          update: jest.fn().mockResolvedValue(mockCartItem),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cart: {
          update: jest.fn().mockResolvedValue(mockCart),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      await service.updateItem(
        mockSessionId,
        cartItemId,
        updateDto,
        mockSessionToken,
      );

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should reject update if item not in cart", async () => {
      prismaService.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem(
          mockSessionId,
          cartItemId,
          updateDto,
          mockSessionToken,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateItem(
          mockSessionId,
          cartItemId,
          updateDto,
          mockSessionToken,
        ),
      ).rejects.toThrow("Cart item not found");
    });

    it("should reject if cart item belongs to different session", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: "different-session" },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      await expect(
        service.updateItem(
          mockSessionId,
          cartItemId,
          updateDto,
          mockSessionToken,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateItem(
          mockSessionId,
          cartItemId,
          updateDto,
          mockSessionToken,
        ),
      ).rejects.toThrow("Cart item does not belong to this session");
    });
  });

  describe("removeItem", () => {
    const cartItemId = "cart-item-123";

    beforeEach(() => {
      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
    });

    it("should remove item from cart", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          delete: jest.fn().mockResolvedValue({ id: cartItemId }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        subTotal: "0.00",
        items: [],
      } as any);

      await service.removeItem(mockSessionId, cartItemId, mockSessionToken);

      expect(mockTx.cartItem.delete).toHaveBeenCalledWith({
        where: { id: cartItemId },
      });
    });

    it("should delete associated customizations (cascade)", async () => {
      // In Prisma, cascade delete is automatic, so we just verify the item is deleted
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
        customizations: [
          { id: "custom-1", cartItemId },
          { id: "custom-2", cartItemId },
        ],
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          delete: jest.fn().mockResolvedValue({ id: cartItemId }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cart: {
          update: jest.fn().mockResolvedValue(mockCart),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      await service.removeItem(mockSessionId, cartItemId, mockSessionToken);

      // Customizations are cascade deleted automatically
      expect(mockTx.cartItem.delete).toHaveBeenCalledWith({
        where: { id: cartItemId },
      });
    });

    it("should recalculate cart total", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          delete: jest.fn().mockResolvedValue({ id: cartItemId }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: "item-2",
              basePrice: "15.99",
              quantity: 1,
              customizations: [],
            },
          ]),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "15.99",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        subTotal: "15.99",
        items: [{ id: "item-2" }],
      } as any);

      await service.removeItem(mockSessionId, cartItemId, mockSessionToken);

      expect(mockTx.cartItem.findMany).toHaveBeenCalled();
      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: "cart-123" },
        data: { subTotal: expect.any(Object) },
        include: {
          items: {
            include: { customizations: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    });

    it("should use transaction", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          delete: jest.fn().mockResolvedValue({ id: cartItemId }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cart: {
          update: jest.fn().mockResolvedValue(mockCart),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      await service.removeItem(mockSessionId, cartItemId, mockSessionToken);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should reject if item not in cart", async () => {
      prismaService.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.removeItem(mockSessionId, cartItemId, mockSessionToken),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeItem(mockSessionId, cartItemId, mockSessionToken),
      ).rejects.toThrow("Cart item not found");
    });

    it("should handle removing last item (cart total = $0.00)", async () => {
      const mockCartItem = {
        id: cartItemId,
        cartId: "cart-123",
        cart: { id: "cart-123", sessionId: mockSessionId },
      };

      prismaService.cartItem.findUnique.mockResolvedValue(mockCartItem as any);

      const mockTx = {
        cartItem: {
          delete: jest.fn().mockResolvedValue({ id: cartItemId }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        subTotal: "0.00",
        items: [],
      } as any);

      const result = await service.removeItem(
        mockSessionId,
        cartItemId,
        mockSessionToken,
      );

      expect(result.subTotal).toBe("0.00");
      expect(result.items).toHaveLength(0);
    });
  });

  describe("clearCart", () => {
    beforeEach(() => {
      prismaService.activeTableSession.findUnique.mockResolvedValue(
        mockActiveSession as any,
      );
      prismaService.cart.findUnique.mockResolvedValue(mockCart as any);
    });

    it("should delete all cart items", async () => {
      const mockTx = {
        cartItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique.mockResolvedValueOnce(mockCart as any); // First call
      prismaService.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        subTotal: "0.00",
        items: [],
      } as any); // After transaction

      await service.clearCart(mockSessionId, mockSessionToken);

      expect(mockTx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: "cart-123" },
      });
    });

    it("should delete all associated customizations", async () => {
      const mockTx = {
        cartItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart as any)
        .mockResolvedValueOnce({
          ...mockCart,
          subTotal: "0.00",
          items: [],
        } as any);

      await service.clearCart(mockSessionId, mockSessionToken);

      // Customizations are cascade deleted with cart items
      expect(mockTx.cartItem.deleteMany).toHaveBeenCalled();
    });

    it("should reset cart total to $0.00", async () => {
      const mockTx = {
        cartItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart as any)
        .mockResolvedValueOnce({
          ...mockCart,
          subTotal: "0.00",
          items: [],
        } as any);

      const result = await service.clearCart(mockSessionId, mockSessionToken);

      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: "cart-123" },
        data: { subTotal: expect.any(Object) },
      });
      expect(result.subTotal).toBe("0.00");
    });

    it("should use transaction", async () => {
      const mockTx = {
        cartItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart as any)
        .mockResolvedValueOnce({
          ...mockCart,
          subTotal: "0.00",
          items: [],
        } as any);

      await service.clearCart(mockSessionId, mockSessionToken);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should handle already empty cart (idempotent)", async () => {
      const mockTx = {
        cartItem: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        cart: {
          update: jest.fn().mockResolvedValue({
            ...mockCart,
            subTotal: "0.00",
          }),
        },
      };

      prismaService.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      prismaService.cart.findUnique
        .mockResolvedValueOnce({
          ...mockCart,
          subTotal: "0.00",
          items: [],
        } as any)
        .mockResolvedValueOnce({
          ...mockCart,
          subTotal: "0.00",
          items: [],
        } as any);

      const result = await service.clearCart(mockSessionId, mockSessionToken);

      expect(result.subTotal).toBe("0.00");
      expect(result.items).toHaveLength(0);
    });

    it("should throw NotFoundException if cart does not exist", async () => {
      prismaService.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.clearCart(mockSessionId, mockSessionToken),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.clearCart(mockSessionId, mockSessionToken),
      ).rejects.toThrow("Cart not found");
    });
  });
});
