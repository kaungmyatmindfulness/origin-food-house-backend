import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PreparationStatus } from '@prisma/client';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';

describe('CartService', () => {
  let service: CartService;
  let prismaService: PrismaMock;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockSessionId = 'session-123';
  const mockCartId = 'cart-123';
  const mockMenuItemId = 'item-123';
  const mockCartItemId = 'cart-item-123';

  const mockCart = {
    id: mockCartId,
    activeTableSessionId: mockSessionId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCartWithItems = {
    ...mockCart,
    items: [
      {
        id: mockCartItemId,
        cartId: mockCartId,
        menuItemId: mockMenuItemId,
        quantity: 2,
        notes: 'No onions',
        menuItem: {
          id: mockMenuItemId,
          name: 'Spring Rolls',
          basePrice: new Prisma.Decimal('5.99'),
          imageUrl: null,
          isHidden: false,
          deletedAt: null,
        },
        selectedOptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockMenuItem = {
    id: mockMenuItemId,
    storeId: 'store-123',
    customizationGroups: [
      {
        id: 'group-123',
        name: 'Size',
        minSelectable: 1,
        maxSelectable: 1,
        customizationOptions: [{ id: 'option-1' }, { id: 'option-2' }],
      },
    ],
  };

  const mockTransaction = {
    cart: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn(),
    },
    cartItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    menuItem: {
      findUnique: jest.fn(),
    },
    activeOrder: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    activeOrderChunk: {
      create: jest.fn(),
    },
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
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prismaService = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCart', () => {
    it('should return cart for existing session', async () => {
      prismaService.cart.findUnique.mockResolvedValue(mockCartWithItems as any);

      const result = await service.getCart(mockSessionId);

      expect(result).toEqual(mockCartWithItems);
      expect(prismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { activeTableSessionId: mockSessionId },
        include: expect.any(Object),
      });
    });

    it('should create cart if not found and return it', async () => {
      prismaService.cart.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCart as any);
      prismaService.cart.upsert.mockResolvedValue(mockCart as any);

      const result = await service.getCart(mockSessionId);

      expect(result).toBeDefined();
    });

    it('should return null if session does not exist', async () => {
      prismaService.cart.findUnique.mockResolvedValue(null);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
        },
      );
      prismaService.cart.upsert.mockRejectedValue(prismaError);

      const result = await service.getCart(mockSessionId);

      expect(result).toBeNull();
    });
  });

  describe('addItemToCart', () => {
    const addItemDto = {
      menuItemId: mockMenuItemId,
      quantity: 2,
      selectedOptionIds: ['option-1'],
      notes: 'Extra crispy',
    };

    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should add item to cart successfully', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        mockMenuItem as any,
      );
      mockTransaction.cartItem.create.mockResolvedValue({} as any);
      mockTransaction.cart.findUniqueOrThrow.mockResolvedValue(
        mockCartWithItems as any,
      );

      const result = await service.addItemToCart(mockSessionId, addItemDto);

      expect(result).toEqual(mockCartWithItems);
      expect(eventEmitter.emit).toHaveBeenCalledWith('cart.updated', {
        sessionId: mockSessionId,
        cart: mockCartWithItems,
      });
    });

    it('should throw NotFoundException if menu item not found', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.menuItem.findUnique.mockResolvedValue(null);

      await expect(
        service.addItemToCart(mockSessionId, addItemDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid customization option IDs', async () => {
      const invalidDto = {
        ...addItemDto,
        selectedOptionIds: ['invalid-option-id'],
      };
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        mockMenuItem as any,
      );

      await expect(
        service.addItemToCart(mockSessionId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate minimum selections for customization groups', async () => {
      const itemWithRequiredGroup = {
        ...mockMenuItem,
        customizationGroups: [
          {
            id: 'group-123',
            name: 'Size',
            minSelectable: 1,
            maxSelectable: 1,
            customizationOptions: [{ id: 'option-1' }],
          },
        ],
      };
      const dtoWithoutSelection = { ...addItemDto, selectedOptionIds: [] };

      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        itemWithRequiredGroup as any,
      );

      await expect(
        service.addItemToCart(mockSessionId, dtoWithoutSelection),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate maximum selections for customization groups', async () => {
      const itemWithMaxGroup = {
        ...mockMenuItem,
        customizationGroups: [
          {
            id: 'group-123',
            name: 'Toppings',
            minSelectable: 0,
            maxSelectable: 2,
            customizationOptions: [
              { id: 'option-1' },
              { id: 'option-2' },
              { id: 'option-3' },
            ],
          },
        ],
      };
      const dtoWithTooManySelections = {
        ...addItemDto,
        selectedOptionIds: ['option-1', 'option-2', 'option-3'],
      };

      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        itemWithMaxGroup as any,
      );

      await expect(
        service.addItemToCart(mockSessionId, dtoWithTooManySelections),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCartItem', () => {
    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should update cart item quantity successfully', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.cartItem.update.mockResolvedValue({} as any);
      mockTransaction.cart.findUniqueOrThrow.mockResolvedValue(
        mockCartWithItems as any,
      );

      const result = await service.updateCartItem(
        mockSessionId,
        mockCartItemId,
        {
          quantity: 3,
        },
      );

      expect(result).toEqual(mockCartWithItems);
      expect(mockTransaction.cartItem.update).toHaveBeenCalledWith({
        where: { id: mockCartItemId, cartId: mockCartId },
        data: { quantity: 3, notes: undefined },
      });
    });

    it('should update cart item notes successfully', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.cartItem.update.mockResolvedValue({} as any);
      mockTransaction.cart.findUniqueOrThrow.mockResolvedValue(
        mockCartWithItems as any,
      );

      const result = await service.updateCartItem(
        mockSessionId,
        mockCartItemId,
        {
          notes: 'Extra spicy',
        },
      );

      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart.updated',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if no update data provided', async () => {
      await expect(
        service.updateCartItem(mockSessionId, mockCartItemId, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if quantity is less than 1', async () => {
      await expect(
        service.updateCartItem(mockSessionId, mockCartItemId, { quantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if cart item not found', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      mockTransaction.cartItem.update.mockRejectedValue(prismaError);

      await expect(
        service.updateCartItem(mockSessionId, mockCartItemId, { quantity: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItemFromCart', () => {
    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should remove item from cart successfully', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.cartItem.delete.mockResolvedValue({} as any);
      mockTransaction.cart.findUniqueOrThrow.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      const result = await service.removeItemFromCart(
        mockSessionId,
        mockCartItemId,
      );

      expect(result).toBeDefined();
      expect(mockTransaction.cartItem.delete).toHaveBeenCalledWith({
        where: { id: mockCartItemId, cartId: mockCartId },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cart.updated',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if cart item not found', async () => {
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      mockTransaction.cartItem.delete.mockRejectedValue(prismaError);

      await expect(
        service.removeItemFromCart(mockSessionId, mockCartItemId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCart', () => {
    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should clear all items from cart successfully', async () => {
      const emptyCart = { ...mockCart, items: [] };
      mockTransaction.cart.upsert.mockResolvedValue(mockCart as any);
      mockTransaction.cartItem.deleteMany.mockResolvedValue({
        count: 2,
      } as any);
      mockTransaction.cart.findUniqueOrThrow.mockResolvedValue(
        emptyCart as any,
      );

      const result = await service.clearCart(mockSessionId);

      expect(result).toEqual(emptyCart);
      expect(mockTransaction.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: mockCartId },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('cart.updated', {
        sessionId: mockSessionId,
        cart: emptyCart,
      });
    });
  });

  describe('confirmCartAndCreateOrderChunk', () => {
    const mockCartWithItemsForConfirm = {
      id: mockCartId,
      activeTableSessionId: mockSessionId,
      items: [
        {
          id: mockCartItemId,
          menuItemId: mockMenuItemId,
          quantity: 2,
          notes: 'Test notes',
          menuItem: {
            basePrice: new Prisma.Decimal('5.99'),
          },
          selectedOptions: [
            {
              id: 'option-1',
              additionalPrice: new Prisma.Decimal('1.00'),
            },
          ],
        },
      ],
    };

    const mockActiveOrder = {
      id: 'active-order-123',
    };

    const mockOrderChunk = {
      id: 'chunk-123',
      activeOrderId: mockActiveOrder.id,
      chunkItems: [
        {
          id: 'chunk-item-123',
          menuItemId: mockMenuItemId,
          quantity: 2,
          notes: 'Test notes',
          status: PreparationStatus.PENDING,
          menuItem: {
            id: mockMenuItemId,
            name: 'Spring Rolls',
            imageUrl: null,
          },
          selectedOptions: [
            {
              id: 'option-1',
              name: 'Large',
              additionalPrice: new Prisma.Decimal('1.00'),
            },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should confirm cart and create order chunk successfully', async () => {
      mockTransaction.cart.findUnique.mockResolvedValue(
        mockCartWithItemsForConfirm as any,
      );
      mockTransaction.activeOrder.findUnique.mockResolvedValue(
        mockActiveOrder as any,
      );
      mockTransaction.activeOrderChunk.create.mockResolvedValue(
        mockOrderChunk as any,
      );
      mockTransaction.cart.delete.mockResolvedValue(mockCart as any);

      const result =
        await service.confirmCartAndCreateOrderChunk(mockSessionId);

      expect(result).toEqual(mockOrderChunk);
      expect(mockTransaction.cart.delete).toHaveBeenCalledWith({
        where: { id: mockCartId },
      });
    });

    it('should throw NotFoundException if cart not found', async () => {
      mockTransaction.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmCartAndCreateOrderChunk(mockSessionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if cart is empty', async () => {
      const emptyCart = { ...mockCart, items: [] };
      mockTransaction.cart.findUnique.mockResolvedValue(emptyCart as any);

      await expect(
        service.confirmCartAndCreateOrderChunk(mockSessionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create active order if it does not exist', async () => {
      mockTransaction.cart.findUnique.mockResolvedValue(
        mockCartWithItemsForConfirm as any,
      );
      mockTransaction.activeOrder.findUnique.mockResolvedValue(null);
      mockTransaction.activeOrder.create.mockResolvedValue(
        mockActiveOrder as any,
      );
      mockTransaction.activeOrderChunk.create.mockResolvedValue(
        mockOrderChunk as any,
      );
      mockTransaction.cart.delete.mockResolvedValue(mockCart as any);

      const result =
        await service.confirmCartAndCreateOrderChunk(mockSessionId);

      expect(result).toBeDefined();
      expect(mockTransaction.activeOrder.create).toHaveBeenCalledWith({
        data: { activeTableSessionId: mockSessionId },
        select: { id: true },
      });
    });
  });
});
