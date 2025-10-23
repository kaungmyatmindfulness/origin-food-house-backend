import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { PaymentService } from './payment.service';
import { AuthService } from '../auth/auth.service';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = 'user-123';
  const mockOrderId = 'order-456';
  const mockStoreId = 'store-789';

  const mockOrder = {
    id: mockOrderId,
    storeId: mockStoreId,
    tableName: 'Table 5',
    grandTotal: new Decimal('100.00'),
    paidAt: null,
    status: OrderStatus.SERVED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
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

    service = module.get<PaymentService>(PaymentService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Store Isolation Security', () => {
    describe('recordPayment', () => {
      const recordPaymentDto: RecordPaymentDto = {
        amount: '50.00',
        paymentMethod: 'CASH',
      };

      it('should allow payment from user with OWNER role', async () => {
        // Setup: User has OWNER permission
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any) // For validation
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [],
            refunds: [],
          } as any); // For payment processing

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, recordPaymentDto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
      });

      it('should allow payment from user with CASHIER role', async () => {
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [],
            refunds: [],
          } as any);

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, recordPaymentDto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
      });

      it('should reject payment from user without store permission', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'User is not a member of store. Access denied.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.recordPayment(mockUserId, mockOrderId, recordPaymentDto),
        ).rejects.toThrow(ForbiddenException);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
        expect(prismaService.$transaction).not.toHaveBeenCalled();
      });

      it('should reject payment for non-existent order', async () => {
        prismaService.order.findUnique.mockResolvedValue(null);

        await expect(
          service.recordPayment(mockUserId, mockOrderId, recordPaymentDto),
        ).rejects.toThrow(NotFoundException);

        expect(authService.checkStorePermission).not.toHaveBeenCalled();
      });
    });

    describe('createRefund', () => {
      const createRefundDto: CreateRefundDto = {
        amount: '25.00',
        reason: 'Customer request',
        refundedBy: mockUserId,
      };

      it('should allow refund from user with OWNER role', async () => {
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [{ amount: new Decimal('100.00') }],
            refunds: [],
          } as any);

        const mockRefund = {
          id: 'refund-1',
          orderId: mockOrderId,
          amount: new Decimal('25.00'),
          reason: 'Customer request',
          refundedBy: mockUserId,
          createdAt: new Date(),
        };

        prismaService.refund.create.mockResolvedValue(mockRefund as any);

        await service.createRefund(mockUserId, mockOrderId, createRefundDto);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN],
        );
      });

      it('should reject refund from user with CASHIER role', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'Access denied. Required roles: OWNER or ADMIN.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.createRefund(mockUserId, mockOrderId, createRefundDto),
        ).rejects.toThrow(ForbiddenException);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN],
        );
        expect(prismaService.refund.create).not.toHaveBeenCalled();
      });

      it('should reject refund from user without store permission', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'User is not a member of store. Access denied.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.createRefund(mockUserId, mockOrderId, createRefundDto),
        ).rejects.toThrow(ForbiddenException);

        expect(prismaService.refund.create).not.toHaveBeenCalled();
      });
    });

    describe('findPaymentsByOrder', () => {
      it('should allow viewing payments with proper permission', async () => {
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);
        prismaService.payment.findMany.mockResolvedValue([]);

        await service.findPaymentsByOrder(mockUserId, mockOrderId);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
      });

      it('should reject viewing payments without store permission', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'User is not a member of store. Access denied.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.findPaymentsByOrder(mockUserId, mockOrderId),
        ).rejects.toThrow(ForbiddenException);

        expect(prismaService.payment.findMany).not.toHaveBeenCalled();
      });
    });

    describe('findRefundsByOrder', () => {
      it('should allow viewing refunds with ADMIN permission', async () => {
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);
        prismaService.refund.findMany.mockResolvedValue([]);

        await service.findRefundsByOrder(mockUserId, mockOrderId);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN],
        );
      });

      it('should reject viewing refunds from CASHIER role', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'Access denied. Required roles: OWNER or ADMIN.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.findRefundsByOrder(mockUserId, mockOrderId),
        ).rejects.toThrow(ForbiddenException);

        expect(prismaService.refund.findMany).not.toHaveBeenCalled();
      });
    });

    describe('getPaymentSummary', () => {
      it('should allow viewing summary with proper permission', async () => {
        authService.checkStorePermission.mockResolvedValue(undefined);
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [],
            refunds: [],
          } as any);

        await service.getPaymentSummary(mockUserId, mockOrderId);

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
      });

      it('should reject viewing summary without store permission', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException(
            'User is not a member of store. Access denied.',
          ),
        );
        prismaService.order.findUnique.mockResolvedValue(mockOrder as any);

        await expect(
          service.getPaymentSummary(mockUserId, mockOrderId),
        ).rejects.toThrow(ForbiddenException);

        // Should not reach the second findUnique call
        expect(prismaService.order.findUnique).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Cross-Store Attack Prevention', () => {
    it('should prevent user from Store A recording payment for Store B order', async () => {
      const storeAUserId = 'user-store-a';
      const storeBOrderId = 'order-store-b';
      const storeBStoreId = 'store-b';

      const storeBOrder = {
        ...mockOrder,
        id: storeBOrderId,
        storeId: storeBStoreId,
      };

      prismaService.order.findUnique.mockResolvedValue(storeBOrder as any);
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(
          `User (ID: ${storeAUserId}) is not a member of store (ID: ${storeBStoreId}). Access denied.`,
        ),
      );

      const recordPaymentDto: RecordPaymentDto = {
        amount: '50.00',
        paymentMethod: 'CASH',
      };

      await expect(
        service.recordPayment(storeAUserId, storeBOrderId, recordPaymentDto),
      ).rejects.toThrow(ForbiddenException);

      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        storeAUserId,
        storeBStoreId,
        [Role.OWNER, Role.ADMIN, Role.CASHIER],
      );
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should prevent user from Store A viewing payments for Store B order', async () => {
      const storeAUserId = 'user-store-a';
      const storeBOrderId = 'order-store-b';
      const storeBStoreId = 'store-b';

      const storeBOrder = {
        ...mockOrder,
        id: storeBOrderId,
        storeId: storeBStoreId,
      };

      prismaService.order.findUnique.mockResolvedValue(storeBOrder as any);
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException(
          `User (ID: ${storeAUserId}) is not a member of store (ID: ${storeBStoreId}). Access denied.`,
        ),
      );

      await expect(
        service.findPaymentsByOrder(storeAUserId, storeBOrderId),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaService.payment.findMany).not.toHaveBeenCalled();
    });
  });
});
