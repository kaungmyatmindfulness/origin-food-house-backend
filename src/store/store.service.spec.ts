import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, Prisma, Currency } from '@prisma/client';

import { StoreService } from './store.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from '../auth/auth.service';
import { S3Service } from '../common/infra/s3.service';
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
  let auditLogService: jest.Mocked<AuditLogService>;
  let s3Service: jest.Mocked<S3Service>;

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
        {
          provide: AuditLogService,
          useValue: {
            logStoreSettingChange: jest.fn(),
            createLog: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
    auditLogService = module.get(AuditLogService);
    s3Service = module.get(S3Service);

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

  describe('updateTaxAndServiceCharge', () => {
    const vatRate = '0.07';
    const serviceChargeRate = '0.10';

    it('should update tax and service charge rates successfully', async () => {
      const oldSetting = {
        ...mockStoreSetting,
        vatRate: new Prisma.Decimal('0.05'),
        serviceChargeRate: new Prisma.Decimal('0.05'),
      };
      const updatedSetting = {
        ...mockStoreSetting,
        vatRate: new Prisma.Decimal(vatRate),
        serviceChargeRate: new Prisma.Decimal(serviceChargeRate),
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.findUnique.mockResolvedValue(oldSetting);
      prismaService.storeSetting.update.mockResolvedValue(updatedSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.updateTaxAndServiceCharge(
        mockUserId,
        mockStoreId,
        vatRate,
        serviceChargeRate,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaService.storeSetting.update).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        data: {
          vatRate: expect.any(Prisma.Decimal),
          serviceChargeRate: expect.any(Prisma.Decimal),
        },
      });
      expect(auditLogService.logStoreSettingChange).toHaveBeenCalled();
      expect(result.vatRate?.toString()).toBe(vatRate);
    });

    it('should reject VAT rate > 30%', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateTaxAndServiceCharge(
          mockUserId,
          mockStoreId,
          '0.35',
          serviceChargeRate,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject service charge rate > 30%', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateTaxAndServiceCharge(
          mockUserId,
          mockStoreId,
          vatRate,
          '0.40',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative rates', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateTaxAndServiceCharge(
          mockUserId,
          mockStoreId,
          '-0.05',
          serviceChargeRate,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require Owner/Admin permission', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.updateTaxAndServiceCharge(
          mockUserId,
          mockStoreId,
          vatRate,
          serviceChargeRate,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if setting not found', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTaxAndServiceCharge(
          mockUserId,
          mockStoreId,
          vatRate,
          serviceChargeRate,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use Decimal precision for rates', async () => {
      const oldSetting = mockStoreSetting;
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.findUnique.mockResolvedValue(oldSetting);
      prismaService.storeSetting.update.mockResolvedValue(mockStoreSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      await service.updateTaxAndServiceCharge(
        mockUserId,
        mockStoreId,
        '0.07',
        '0.10',
      );

      const updateCall = prismaService.storeSetting.update.mock.calls[0][0];
      expect(updateCall.data.vatRate).toBeInstanceOf(Prisma.Decimal);
      expect(updateCall.data.serviceChargeRate).toBeInstanceOf(Prisma.Decimal);
    });
  });

  describe('updateBusinessHours', () => {
    const validBusinessHours = {
      monday: { closed: false, open: '09:00', close: '22:00' },
      tuesday: { closed: false, open: '09:00', close: '22:00' },
      wednesday: { closed: false, open: '09:00', close: '22:00' },
      thursday: { closed: false, open: '09:00', close: '22:00' },
      friday: { closed: false, open: '09:00', close: '23:00' },
      saturday: { closed: false, open: '10:00', close: '23:00' },
      sunday: { closed: true, open: null, close: null },
    };

    it('should update business hours successfully', async () => {
      const updatedSetting = {
        ...mockStoreSetting,
        businessHours: validBusinessHours as any,
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.update.mockResolvedValue(updatedSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.updateBusinessHours(
        mockUserId,
        mockStoreId,
        validBusinessHours as any,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(prismaService.storeSetting.update).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        data: { businessHours: validBusinessHours },
      });
      expect(auditLogService.logStoreSettingChange).toHaveBeenCalled();
      expect(result).toEqual(updatedSetting);
    });

    it('should reject invalid time format', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      const invalidHours = {
        ...validBusinessHours,
        monday: { closed: false, open: '25:00', close: '22:00' },
      };

      await expect(
        service.updateBusinessHours(
          mockUserId,
          mockStoreId,
          invalidHours as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing open/close when not closed', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      const invalidHours = {
        ...validBusinessHours,
        monday: { closed: false, open: null, close: null },
      };

      await expect(
        service.updateBusinessHours(
          mockUserId,
          mockStoreId,
          invalidHours as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow closed days without times', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.update.mockResolvedValue(mockStoreSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const hoursWithClosedDay = {
        ...validBusinessHours,
        sunday: { closed: true },
      };

      await expect(
        service.updateBusinessHours(
          mockUserId,
          mockStoreId,
          hoursWithClosedDay as any,
        ),
      ).resolves.toBeDefined();
    });

    it('should require Owner/Admin permission', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.updateBusinessHours(
          mockUserId,
          mockStoreId,
          validBusinessHours as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('uploadBranding', () => {
    const mockLogoFile: Express.Multer.File = {
      buffer: Buffer.from('logo'),
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 1024,
    } as any;

    const mockCoverFile: Express.Multer.File = {
      buffer: Buffer.from('cover'),
      originalname: 'cover.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
    } as any;

    it('should upload logo successfully', async () => {
      const updatedInfo = {
        ...mockStoreInformation,
        logoUrl: 'https://s3.example.com/logo.png',
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      s3Service.uploadFile.mockResolvedValue('https://s3.example.com/logo.png');
      prismaService.storeInformation.update.mockResolvedValue(updatedInfo);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.uploadBranding(
        mockUserId,
        mockStoreId,
        mockLogoFile,
        undefined,
      );

      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('store-logos'),
        mockLogoFile.buffer,
        mockLogoFile.mimetype,
      );
      expect(prismaService.storeInformation.update).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        data: { logoUrl: 'https://s3.example.com/logo.png' },
      });
      expect(result.logoUrl).toBe('https://s3.example.com/logo.png');
    });

    it('should upload cover photo successfully', async () => {
      const updatedInfo = {
        ...mockStoreInformation,
        coverPhotoUrl: 'https://s3.example.com/cover.jpg',
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      s3Service.uploadFile.mockResolvedValue(
        'https://s3.example.com/cover.jpg',
      );
      prismaService.storeInformation.update.mockResolvedValue(updatedInfo);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.uploadBranding(
        mockUserId,
        mockStoreId,
        undefined,
        mockCoverFile,
      );

      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('store-covers'),
        mockCoverFile.buffer,
        mockCoverFile.mimetype,
      );
      expect(result.coverPhotoUrl).toBe('https://s3.example.com/cover.jpg');
    });

    it('should upload both logo and cover', async () => {
      const updatedInfo = {
        ...mockStoreInformation,
        logoUrl: 'https://s3.example.com/logo.png',
        coverPhotoUrl: 'https://s3.example.com/cover.jpg',
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      s3Service.uploadFile
        .mockResolvedValueOnce('https://s3.example.com/logo.png')
        .mockResolvedValueOnce('https://s3.example.com/cover.jpg');
      prismaService.storeInformation.update.mockResolvedValue(updatedInfo);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.uploadBranding(
        mockUserId,
        mockStoreId,
        mockLogoFile,
        mockCoverFile,
      );

      expect(s3Service.uploadFile).toHaveBeenCalledTimes(2);
      expect(result.logoUrl).toBe('https://s3.example.com/logo.png');
      expect(result.coverPhotoUrl).toBe('https://s3.example.com/cover.jpg');
    });

    it('should require Owner/Admin permission', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.uploadBranding(
          mockUserId,
          mockStoreId,
          mockLogoFile,
          undefined,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should log audit trail', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      s3Service.uploadFile.mockResolvedValue('https://s3.example.com/logo.png');
      prismaService.storeInformation.update.mockResolvedValue(
        mockStoreInformation,
      );
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      await service.uploadBranding(
        mockUserId,
        mockStoreId,
        mockLogoFile,
        undefined,
      );

      expect(auditLogService.logStoreSettingChange).toHaveBeenCalledWith(
        mockStoreId,
        mockUserId,
        expect.objectContaining({ field: 'branding' }),
        undefined,
        undefined,
      );
    });
  });

  describe('updateLoyaltyRules', () => {
    const pointRate = '0.1';
    const redemptionRate = '0.1';
    const expiryDays = 365;

    it('should update loyalty rules successfully', async () => {
      const updatedSetting = {
        ...mockStoreSetting,
        loyaltyPointRate: new Prisma.Decimal(pointRate),
        loyaltyRedemptionRate: new Prisma.Decimal(redemptionRate),
        loyaltyPointExpiryDays: expiryDays,
      };

      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.update.mockResolvedValue(updatedSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      const result = await service.updateLoyaltyRules(
        mockUserId,
        mockStoreId,
        pointRate,
        redemptionRate,
        expiryDays,
      );

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER],
      );
      expect(prismaService.storeSetting.update).toHaveBeenCalledWith({
        where: { storeId: mockStoreId },
        data: {
          loyaltyPointRate: expect.any(Prisma.Decimal),
          loyaltyRedemptionRate: expect.any(Prisma.Decimal),
          loyaltyPointExpiryDays: expiryDays,
        },
      });
      expect(auditLogService.logStoreSettingChange).toHaveBeenCalled();
      expect(result).toEqual(updatedSetting);
    });

    it('should require Owner permission only', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          pointRate,
          redemptionRate,
          expiryDays,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER],
      );
    });

    it('should reject zero or negative point rate', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          '0',
          redemptionRate,
          expiryDays,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          '-0.1',
          redemptionRate,
          expiryDays,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero or negative redemption rate', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          pointRate,
          '0',
          expiryDays,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid expiry days', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          pointRate,
          redemptionRate,
          -1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          pointRate,
          redemptionRate,
          3651,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use Decimal precision for rates', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.update.mockResolvedValue(mockStoreSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      await service.updateLoyaltyRules(
        mockUserId,
        mockStoreId,
        pointRate,
        redemptionRate,
        expiryDays,
      );

      const updateCall = prismaService.storeSetting.update.mock.calls[0][0];
      expect(updateCall.data.loyaltyPointRate).toBeInstanceOf(Prisma.Decimal);
      expect(updateCall.data.loyaltyRedemptionRate).toBeInstanceOf(
        Prisma.Decimal,
      );
    });

    it('should allow zero expiry days (no expiration)', async () => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.storeSetting.update.mockResolvedValue(mockStoreSetting);
      auditLogService.logStoreSettingChange.mockResolvedValue(undefined);

      await expect(
        service.updateLoyaltyRules(
          mockUserId,
          mockStoreId,
          pointRate,
          redemptionRate,
          0,
        ),
      ).resolves.toBeDefined();
    });
  });
});
