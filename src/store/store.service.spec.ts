import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Prisma, Currency } from '@prisma/client';

import { StoreService } from './store.service';
import { AuthService } from '../auth/auth.service';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';
import { PrismaService } from '../prisma/prisma.service';

// Mock nanoid module
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'abc123'),
}));

describe('StoreService', () => {
  let service: StoreService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = 'user-123';
  const mockStoreId = 'store-123';

  const mockStore = {
    id: mockStoreId,
    slug: 'test-store-abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStoreInformation = {
    id: 'info-123',
    storeId: mockStoreId,
    name: 'Test Store',
    logoUrl: null,
    coverPhotoUrl: null,
    address: '123 Main St',
    phone: '+1234567890',
    email: 'store@example.com',
    website: 'https://example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStoreSetting = {
    id: 'setting-123',
    storeId: mockStoreId,
    currency: Currency.USD,
    vatRate: new Prisma.Decimal('0.07'),
    serviceChargeRate: new Prisma.Decimal('0.0'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStoreWithDetails = {
    ...mockStore,
    information: mockStoreInformation,
    setting: mockStoreSetting,
  };

  const mockTransaction = {
    store: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    storeInformation: {
      update: jest.fn(),
    },
    storeSetting: {
      update: jest.fn(),
    },
    userStore: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AuthService,
          useValue: {
            checkStorePermission: jest.fn(),
            getUserStoreRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStoreDetails', () => {
    it('should return store details with information and settings', async () => {
      prismaService.store.findUniqueOrThrow.mockResolvedValue(
        mockStoreWithDetails as any,
      );

      const result = await service.getStoreDetails(mockStoreId);

      expect(result).toEqual(mockStoreWithDetails);
      expect(prismaService.store.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: mockStoreId },
        include: { information: true, setting: true },
      });
    });

    it('should throw NotFoundException if store not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      prismaService.store.findUniqueOrThrow.mockRejectedValue(prismaError);

      await expect(service.getStoreDetails(mockStoreId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createStore', () => {
    const createStoreDto = {
      name: 'My New Restaurant',
    };

    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should create store with information, settings, and owner assignment', async () => {
      mockTransaction.store.findUnique.mockResolvedValue(null);
      mockTransaction.store.create.mockResolvedValue(mockStore as any);
      mockTransaction.userStore.create.mockResolvedValue({} as any);

      const result = await service.createStore(mockUserId, createStoreDto);

      expect(result).toEqual(mockStore);
      expect(mockTransaction.store.create).toHaveBeenCalledWith({
        data: {
          slug: expect.stringContaining('my-new-restaurant-'),
          information: {
            create: {
              name: createStoreDto.name,
            },
          },
          setting: {
            create: {},
          },
        },
      });
      expect(mockTransaction.userStore.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          storeId: mockStore.id,
          role: Role.OWNER,
        },
      });
    });

    it('should throw BadRequestException if slug already exists', async () => {
      mockTransaction.store.findUnique.mockResolvedValue(mockStore as any);

      await expect(
        service.createStore(mockUserId, createStoreDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStoreInformation', () => {
    const updateDto = {
      name: 'Updated Store Name',
      address: '456 New St',
      phone: '+9876543210',
    };

    it('should update store information successfully', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeInformation.update.mockResolvedValue({
        ...mockStoreInformation,
        ...updateDto,
      } as any);

      const result = await service.updateStoreInformation(
        mockUserId,
        mockStoreId,
        updateDto,
      );

      expect(result.name).toBe(updateDto.name);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
    });

    it('should throw NotFoundException if store information not found', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      prismaService.storeInformation.update.mockRejectedValue(prismaError);

      await expect(
        service.updateStoreInformation(mockUserId, mockStoreId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check permissions before updating', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(
        service.updateStoreInformation(mockUserId, mockStoreId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStoreSettings', () => {
    const updateDto = {
      currency: Currency.THB,
      vatRate: '0.10',
      serviceChargeRate: '0.05',
    };

    it('should update store settings successfully', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      const updatedSetting = {
        ...mockStoreSetting,
        currency: Currency.THB,
        vatRate: new Prisma.Decimal('0.10'),
        serviceChargeRate: new Prisma.Decimal('0.05'),
      };
      prismaService.storeSetting.update.mockResolvedValue(
        updatedSetting as any,
      );

      const result = await service.updateStoreSettings(
        mockUserId,
        mockStoreId,
        updateDto,
      );

      expect(result.currency).toBe(Currency.THB);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
    });

    it('should throw NotFoundException if settings not found', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      prismaService.storeSetting.update.mockRejectedValue(prismaError);

      await expect(
        service.updateStoreSettings(mockUserId, mockStoreId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('inviteOrAssignRoleByEmail', () => {
    const inviteDto = {
      email: 'newuser@example.com',
      role: Role.ADMIN,
    };

    const mockTargetUser = {
      id: 'target-user-123',
      email: inviteDto.email,
    };

    const mockUserStore = {
      id: 'userstore-123',
      userId: mockTargetUser.id,
      storeId: mockStoreId,
      role: Role.ADMIN,
    };

    beforeEach(() => {
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should assign role to existing user as OWNER', async () => {
      authService.getUserStoreRole.mockResolvedValue(Role.OWNER);
      mockTransaction.user.findUnique.mockResolvedValue(mockTargetUser as any);
      mockTransaction.userStore.upsert.mockResolvedValue(mockUserStore as any);

      const result = await service.inviteOrAssignRoleByEmail(
        mockUserId,
        mockStoreId,
        inviteDto,
      );

      expect(result).toEqual(mockUserStore);
      expect(mockTransaction.userStore.upsert).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to assign OWNER role', async () => {
      const ownerDto = { ...inviteDto, role: Role.OWNER };

      await expect(
        service.inviteOrAssignRoleByEmail(mockUserId, mockStoreId, ownerDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.inviteOrAssignRoleByEmail(mockUserId, mockStoreId, ownerDto),
      ).rejects.toThrow('Cannot assign OWNER role');
    });

    it('should throw ForbiddenException if acting user is not OWNER', async () => {
      authService.getUserStoreRole.mockResolvedValue(Role.ADMIN);

      await expect(
        service.inviteOrAssignRoleByEmail(mockUserId, mockStoreId, inviteDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user email not found', async () => {
      authService.getUserStoreRole.mockResolvedValue(Role.OWNER);
      mockTransaction.user.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteOrAssignRoleByEmail(mockUserId, mockStoreId, inviteDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.inviteOrAssignRoleByEmail(mockUserId, mockStoreId, inviteDto),
      ).rejects.toThrow('must register first');
    });

    it('should update existing membership role', async () => {
      authService.getUserStoreRole.mockResolvedValue(Role.OWNER);
      mockTransaction.user.findUnique.mockResolvedValue(mockTargetUser as any);
      const updatedUserStore = { ...mockUserStore, role: Role.CHEF };
      mockTransaction.userStore.upsert.mockResolvedValue(
        updatedUserStore as any,
      );

      const result = await service.inviteOrAssignRoleByEmail(
        mockUserId,
        mockStoreId,
        {
          email: inviteDto.email,
          role: Role.CHEF,
        },
      );

      expect(result.role).toBe(Role.CHEF);
    });
  });
});
