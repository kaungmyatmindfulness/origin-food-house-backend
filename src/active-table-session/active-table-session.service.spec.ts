import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, SessionStatus, SessionType } from '@prisma/client';

import { ActiveTableSessionService } from './active-table-session.service';
import { AuthService } from '../auth/auth.service';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManualSessionDto } from './dto/create-manual-session.dto';

describe('ActiveTableSessionService', () => {
  let service: ActiveTableSessionService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = 'user-123';
  const mockStoreId = 'store-123';
  const mockSessionId = 'session-456';
  const mockSessionToken = 'mock-session-token-abc123';

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveTableSessionService,
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

    service = module.get<ActiveTableSessionService>(ActiveTableSessionService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createManualSession', () => {
    const mockCart = {
      id: 'cart-123',
      sessionId: mockSessionId,
      storeId: mockStoreId,
      subTotal: '0',
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCreatedSession = {
      id: mockSessionId,
      storeId: mockStoreId,
      tableId: null,
      sessionType: SessionType.COUNTER,
      sessionToken: mockSessionToken,
      guestCount: 1,
      customerName: null,
      customerPhone: null,
      status: SessionStatus.ACTIVE,
      createdAt: new Date(),
      closedAt: null,
    };

    const mockSessionWithCart = {
      ...mockCreatedSession,
      cart: mockCart,
    };

    describe('Counter Orders', () => {
      it('should create a counter session successfully', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
          guestCount: 2,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        // Mock transaction
        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        const result = await service.createManualSession(
          mockUserId,
          mockStoreId,
          dto,
        );

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.SERVER, Role.CASHIER],
        );

        expect(mockTx.activeTableSession.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            storeId: mockStoreId,
            tableId: null,
            sessionType: SessionType.COUNTER,
            guestCount: 2,
            status: SessionStatus.ACTIVE,
          }),
        });

        expect(mockTx.cart.create).toHaveBeenCalledWith({
          data: {
            sessionId: mockCreatedSession.id,
            storeId: mockStoreId,
            subTotal: expect.any(Object),
          },
        });

        expect(result).toHaveProperty('id', mockSessionId);
        expect(result.sessionType).toBe(SessionType.COUNTER);
        expect(result.tableId).toBeNull();
      });

      it('should create counter session with customer details', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
          customerName: 'John Doe',
          customerPhone: '+1234567890',
          guestCount: 1,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const sessionWithDetails = {
          ...mockCreatedSession,
          customerName: 'John Doe',
          customerPhone: '+1234567890',
        };

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(sessionWithDetails),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue({
          ...sessionWithDetails,
          cart: mockCart,
        } as any);

        const result = await service.createManualSession(
          mockUserId,
          mockStoreId,
          dto,
        );

        expect(mockTx.activeTableSession.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            customerName: 'John Doe',
            customerPhone: '+1234567890',
          }),
        });

        expect(result.customerName).toBe('John Doe');
        expect(result.customerPhone).toBe('+1234567890');
      });
    });

    describe('Phone Orders', () => {
      it('should create a phone order session successfully', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.PHONE,
          customerName: 'Jane Smith',
          customerPhone: '+9876543210',
          guestCount: 3,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const phoneSession = {
          ...mockCreatedSession,
          sessionType: SessionType.PHONE,
          customerName: 'Jane Smith',
          customerPhone: '+9876543210',
          guestCount: 3,
        };

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(phoneSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue({
          ...phoneSession,
          cart: mockCart,
        } as any);

        const result = await service.createManualSession(
          mockUserId,
          mockStoreId,
          dto,
        );

        expect(result.sessionType).toBe(SessionType.PHONE);
        expect(result.customerName).toBe('Jane Smith');
        expect(result.customerPhone).toBe('+9876543210');
        expect(result.guestCount).toBe(3);
      });
    });

    describe('Takeout Orders', () => {
      it('should create a takeout session successfully', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.TAKEOUT,
          customerName: 'Bob Wilson',
          guestCount: 1,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const takeoutSession = {
          ...mockCreatedSession,
          sessionType: SessionType.TAKEOUT,
          customerName: 'Bob Wilson',
        };

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(takeoutSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue({
          ...takeoutSession,
          cart: mockCart,
        } as any);

        const result = await service.createManualSession(
          mockUserId,
          mockStoreId,
          dto,
        );

        expect(result.sessionType).toBe(SessionType.TAKEOUT);
        expect(result.customerName).toBe('Bob Wilson');
      });
    });

    describe('Validation', () => {
      it('should reject TABLE sessionType', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.TABLE,
          guestCount: 2,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        await expect(
          service.createManualSession(mockUserId, mockStoreId, dto),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.createManualSession(mockUserId, mockStoreId, dto),
        ).rejects.toThrow(
          'Cannot create manual session with type TABLE. Use join-by-table endpoint instead.',
        );
      });

      it('should default guestCount to 1 if not provided', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(mockTx.activeTableSession.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            guestCount: 1,
          }),
        });
      });
    });

    describe('RBAC Enforcement', () => {
      it('should allow OWNER to create manual session', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          expect.arrayContaining([Role.OWNER]),
        );
      });

      it('should allow ADMIN to create manual session', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          expect.arrayContaining([Role.ADMIN]),
        );
      });

      it('should allow SERVER to create manual session', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          expect.arrayContaining([Role.SERVER]),
        );
      });

      it('should allow CASHIER to create manual session', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          expect.arrayContaining([Role.CASHIER]),
        );
      });

      it('should reject users without proper role', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException('Insufficient permissions'),
        );

        await expect(
          service.createManualSession(mockUserId, mockStoreId, dto),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject users not in the store', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException('Not a member of store'),
        );

        await expect(
          service.createManualSession(mockUserId, mockStoreId, dto),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Cart Initialization', () => {
      it('should initialize cart with zero subtotal', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        await service.createManualSession(mockUserId, mockStoreId, dto);

        expect(mockTx.cart.create).toHaveBeenCalledWith({
          data: {
            sessionId: mockCreatedSession.id,
            storeId: mockStoreId,
            subTotal: expect.any(Object),
          },
        });
      });

      it('should return session with cart included', async () => {
        const dto: CreateManualSessionDto = {
          sessionType: SessionType.COUNTER,
        };

        authService.checkStorePermission.mockResolvedValue(undefined);

        const mockTx = {
          activeTableSession: {
            create: jest.fn().mockResolvedValue(mockCreatedSession),
          },
          cart: {
            create: jest.fn().mockResolvedValue(mockCart),
          },
        };
        prismaService.$transaction.mockImplementation(async (callback: any) =>
          callback(mockTx),
        );

        prismaService.activeTableSession.findUnique.mockResolvedValue(
          mockSessionWithCart as any,
        );

        const result = await service.createManualSession(
          mockUserId,
          mockStoreId,
          dto,
        );

        expect(result).toHaveProperty('cart');
        expect((result as any).cart).toBeDefined();
        expect(
          prismaService.activeTableSession.findUnique,
        ).toHaveBeenCalledWith({
          where: { id: mockCreatedSession.id },
          include: {
            cart: {
              include: {
                items: {
                  include: {
                    customizations: true,
                  },
                },
              },
            },
          },
        });
      });
    });
  });
});
