import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Prisma } from '@prisma/client';

import { MenuService } from './menu.service';
import { AuthService } from '../auth/auth.service';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';
import { PrismaService } from '../prisma/prisma.service';

describe('MenuService', () => {
  let service: MenuService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockStoreId = 'store-123';
  const mockUserId = 'user-123';
  const mockItemId = 'item-123';
  const mockCategoryId = 'category-123';

  const mockCategory = {
    id: mockCategoryId,
    name: 'Appetizers',
    storeId: mockStoreId,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMenuItem = {
    id: mockItemId,
    name: 'Spring Rolls',
    description: 'Fresh spring rolls',
    basePrice: new Prisma.Decimal('5.99'),
    imageUrl: null,
    categoryId: mockCategoryId,
    storeId: mockStoreId,
    sortOrder: 0,
    isOutOfStock: false,
    isHidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    category: mockCategory,
    customizationGroups: [],
  };

  const mockTransaction = {
    menuItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      aggregate: jest.fn(),
    },
    category: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    customizationGroup: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    customizationOption: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
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

    service = module.get<MenuService>(MenuService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStoreMenuItems', () => {
    it('should return all menu items for a store', async () => {
      const mockItems = [mockMenuItem];
      prismaService.menuItem.findMany.mockResolvedValue(mockItems as any);

      const result = await service.getStoreMenuItems(mockStoreId);

      expect(result).toEqual(mockItems);
      expect(prismaService.menuItem.findMany).toHaveBeenCalledWith({
        where: { storeId: mockStoreId, deletedAt: null },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        include: expect.any(Object),
      });
    });

    it('should return empty array if no items found', async () => {
      prismaService.menuItem.findMany.mockResolvedValue([]);

      const result = await service.getStoreMenuItems(mockStoreId);

      expect(result).toEqual([]);
    });
  });

  describe('getMenuItemById', () => {
    it('should return menu item by ID', async () => {
      prismaService.menuItem.findFirst.mockResolvedValue(mockMenuItem as any);

      const result = await service.getMenuItemById(mockItemId);

      expect(result).toEqual(mockMenuItem);
    });

    it('should throw NotFoundException if item not found', async () => {
      prismaService.menuItem.findFirst.mockResolvedValue(null);

      await expect(service.getMenuItemById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createMenuItem', () => {
    const createDto = {
      name: 'New Item',
      description: 'Description',
      basePrice: '9.99',
      category: { name: 'Appetizers' },
      customizationGroups: [],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should create menu item successfully', async () => {
      mockTransaction.category.findFirst.mockResolvedValue(mockCategory as any);
      mockTransaction.menuItem.aggregate.mockResolvedValue({
        _max: { sortOrder: 0 },
      } as any);
      mockTransaction.menuItem.create.mockResolvedValue({
        id: mockItemId,
      } as any);
      mockTransaction.menuItem.findUniqueOrThrow.mockResolvedValue(
        mockMenuItem as any,
      );

      const result = await service.createMenuItem(
        mockUserId,
        mockStoreId,
        createDto,
      );

      expect(result).toEqual(mockMenuItem);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
    });

    it('should throw BadRequestException if category name is missing', async () => {
      const invalidDto = { ...createDto, category: {} as any };

      await expect(
        service.createMenuItem(mockUserId, mockStoreId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check permissions before creating', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(
        service.createMenuItem(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create customization groups when provided', async () => {
      const dtoWithCustomizations = {
        ...createDto,
        customizationGroups: [
          {
            name: 'Size',
            minSelectable: 1,
            maxSelectable: 1,
            options: [
              { name: 'Small', additionalPrice: '0' },
              { name: 'Large', additionalPrice: '2.00' },
            ],
          },
        ],
      };

      mockTransaction.category.findFirst.mockResolvedValue(mockCategory as any);
      mockTransaction.menuItem.aggregate.mockResolvedValue({
        _max: { sortOrder: 0 },
      } as any);
      mockTransaction.menuItem.create.mockResolvedValue({
        id: mockItemId,
      } as any);
      mockTransaction.customizationGroup.create.mockResolvedValue({
        id: 'group-123',
      } as any);
      mockTransaction.customizationOption.createMany.mockResolvedValue({
        count: 2,
      } as any);
      mockTransaction.menuItem.findUniqueOrThrow.mockResolvedValue(
        mockMenuItem as any,
      );

      const result = await service.createMenuItem(
        mockUserId,
        mockStoreId,
        dtoWithCustomizations,
      );

      expect(result).toBeDefined();
      expect(mockTransaction.customizationGroup.create).toHaveBeenCalled();
      expect(mockTransaction.customizationOption.createMany).toHaveBeenCalled();
    });
  });

  describe('updateMenuItem', () => {
    const updateDto = {
      name: 'Updated Item',
      description: 'Updated description',
      basePrice: '12.99',
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should update menu item successfully', async () => {
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        mockMenuItem as any,
      );
      mockTransaction.menuItem.update.mockResolvedValue(mockMenuItem as any);
      mockTransaction.menuItem.findUniqueOrThrow.mockResolvedValue({
        ...mockMenuItem,
        ...updateDto,
      } as any);

      const result = await service.updateMenuItem(
        mockUserId,
        mockStoreId,
        mockItemId,
        updateDto,
      );

      expect(result).toBeDefined();
      expect(authService.checkStorePermission).toHaveBeenCalled();
      expect(mockTransaction.menuItem.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if item not found', async () => {
      mockTransaction.menuItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMenuItem(mockUserId, mockStoreId, mockItemId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if item belongs to different store', async () => {
      const wrongStoreItem = { ...mockMenuItem, storeId: 'different-store' };
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        wrongStoreItem as any,
      );

      await expect(
        service.updateMenuItem(mockUserId, mockStoreId, mockItemId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should sync customization groups when provided', async () => {
      const updateDtoWithCustomizations = {
        ...updateDto,
        customizationGroups: [
          {
            id: 'existing-group-id',
            name: 'Updated Size',
            minSelectable: 1,
            maxSelectable: 1,
            options: [{ name: 'Medium', additionalPrice: '1.00' }],
          },
        ],
      };

      const itemWithGroups = {
        ...mockMenuItem,
        customizationGroups: [
          {
            id: 'existing-group-id',
            name: 'Size',
            menuItemId: mockItemId,
            minSelectable: 1,
            maxSelectable: 1,
            customizationOptions: [{ id: 'option-123' }],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockTransaction.menuItem.findUnique.mockResolvedValue(
        itemWithGroups as any,
      );
      mockTransaction.menuItem.update.mockResolvedValue(mockMenuItem as any);
      mockTransaction.customizationGroup.update.mockResolvedValue({} as any);
      mockTransaction.customizationOption.deleteMany.mockResolvedValue({
        count: 1,
      } as any);
      mockTransaction.customizationOption.create.mockResolvedValue({} as any);
      mockTransaction.menuItem.findUniqueOrThrow.mockResolvedValue(
        mockMenuItem as any,
      );

      const result = await service.updateMenuItem(
        mockUserId,
        mockStoreId,
        mockItemId,
        updateDtoWithCustomizations,
      );

      expect(result).toBeDefined();
      expect(mockTransaction.customizationGroup.update).toHaveBeenCalled();
    });
  });

  describe('deleteMenuItem', () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should soft delete menu item successfully', async () => {
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        mockMenuItem as any,
      );
      mockTransaction.menuItem.update.mockResolvedValue(mockMenuItem as any);

      const result = await service.deleteMenuItem(
        mockUserId,
        mockStoreId,
        mockItemId,
      );

      expect(result).toEqual({ id: mockItemId });
      expect(authService.checkStorePermission).toHaveBeenCalled();
      expect(mockTransaction.menuItem.update).toHaveBeenCalledWith({
        where: { id: mockItemId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should return id if item not found (idempotent)', async () => {
      mockTransaction.menuItem.findUnique.mockResolvedValue(null);

      const result = await service.deleteMenuItem(
        mockUserId,
        mockStoreId,
        mockItemId,
      );

      expect(result).toEqual({ id: mockItemId });
      expect(mockTransaction.menuItem.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if item belongs to different store', async () => {
      const wrongStoreItem = { ...mockMenuItem, storeId: 'different-store' };
      mockTransaction.menuItem.findUnique.mockResolvedValue(
        wrongStoreItem as any,
      );

      await expect(
        service.deleteMenuItem(mockUserId, mockStoreId, mockItemId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should check permissions before deleting', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(
        service.deleteMenuItem(mockUserId, mockStoreId, mockItemId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
