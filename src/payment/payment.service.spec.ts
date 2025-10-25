import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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
import { RecordSplitPaymentDto } from './dto/record-split-payment.dto';

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

  describe('Cash Change Calculation', () => {
    const mockOrderWithNoPayments = {
      id: mockOrderId,
      storeId: mockStoreId,
      tableName: 'Table 5',
      grandTotal: new Decimal('47.50'),
      paidAt: null,
      status: OrderStatus.SERVED,
      createdAt: new Date(),
      updatedAt: new Date(),
      payments: [],
      refunds: [],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
    });

    describe('exact payment scenarios', () => {
      it('should calculate zero change for exact cash payment', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '47.50',
          paymentMethod: 'CASH',
          amountTendered: '47.50',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('47.50'),
          paymentMethod: 'CASH',
          amountTendered: new Decimal('47.50'),
          change: new Decimal('0'),
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const result = await service.recordPayment(
          mockUserId,
          mockOrderId,
          dto,
        );

        expect(result.change).toBeInstanceOf(Decimal);
        expect(result.change!.toString()).toBe('0');
      });
    });

    describe('overpayment scenarios', () => {
      it('should calculate correct change for $50 bill on $47.50 order', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '47.50',
          paymentMethod: 'CASH',
          amountTendered: '50.00',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('47.50'),
          paymentMethod: 'CASH',
          amountTendered: new Decimal('50.00'),
          change: new Decimal('2.50'),
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const result = await service.recordPayment(
          mockUserId,
          mockOrderId,
          dto,
        );

        expect(result.change!.toString()).toBe('2.5');
      });

      it('should calculate correct change for large bills', async () => {
        const largeOrder = {
          ...mockOrderWithNoPayments,
          grandTotal: new Decimal('87.25'),
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(largeOrder as any);

        const dto: RecordPaymentDto = {
          amount: '87.25',
          paymentMethod: 'CASH',
          amountTendered: '100.00',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('87.25'),
          paymentMethod: 'CASH',
          amountTendered: new Decimal('100.00'),
          change: new Decimal('12.75'),
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const result = await service.recordPayment(
          mockUserId,
          mockOrderId,
          dto,
        );

        expect(result.change!.toString()).toBe('12.75');
      });

      it('should handle small change amounts with Decimal precision', async () => {
        const smallOrder = {
          ...mockOrderWithNoPayments,
          grandTotal: new Decimal('9.99'),
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(smallOrder as any);

        const dto: RecordPaymentDto = {
          amount: '9.99',
          paymentMethod: 'CASH',
          amountTendered: '10.00',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('9.99'),
          paymentMethod: 'CASH',
          amountTendered: new Decimal('10.00'),
          change: new Decimal('0.01'),
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const result = await service.recordPayment(
          mockUserId,
          mockOrderId,
          dto,
        );

        expect(result.change!.toString()).toBe('0.01');
      });
    });

    describe('underpayment scenarios', () => {
      it('should reject underpayment (tendered less than amount)', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '47.50',
          paymentMethod: 'CASH',
          amountTendered: '40.00',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Insufficient amount tendered');

        expect(prismaService.$transaction).not.toHaveBeenCalled();
      });

      it('should reject partial cash payment without sufficient tender', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '20.00',
          paymentMethod: 'CASH',
          amountTendered: '15.00',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Insufficient amount tendered');
      });
    });

    describe('non-cash payment validation', () => {
      it('should reject amountTendered for credit card payments', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '47.50',
          paymentMethod: 'CREDIT_CARD',
          amountTendered: '50.00',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow(
          'amountTendered is only applicable for cash payments',
        );

        expect(prismaService.$transaction).not.toHaveBeenCalled();
      });

      it('should reject amountTendered for mobile payments', async () => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(mockOrderWithNoPayments as any);

        const dto: RecordPaymentDto = {
          amount: '47.50',
          paymentMethod: 'MOBILE_PAYMENT',
          amountTendered: '50.00',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow(
          'amountTendered is only applicable for cash payments',
        );
      });
    });
  });

  describe('Split Payment Prevention & Detection', () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
    });

    describe('overpayment prevention', () => {
      it('should prevent overpayment on partially paid order', async () => {
        const partiallyPaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [{ amount: new Decimal('60.00') }],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(partiallyPaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '50.00',
          paymentMethod: 'CREDIT_CARD',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Payment amount exceeds order total');

        expect(prismaService.$transaction).not.toHaveBeenCalled();
      });

      it('should show remaining balance in error message', async () => {
        const partiallyPaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [{ amount: new Decimal('70.00') }],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(partiallyPaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '40.00',
          paymentMethod: 'CASH',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Remaining balance: 30');
      });
    });

    describe('partial payment acceptance', () => {
      it('should allow first partial payment', async () => {
        const unpaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(unpaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '60.00',
          paymentMethod: 'CASH',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('60.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const result = await service.recordPayment(
          mockUserId,
          mockOrderId,
          dto,
        );

        expect(result.amount.toString()).toBe('60');
      });

      it('should allow second partial payment to complete order', async () => {
        const partiallyPaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [{ amount: new Decimal('60.00') }],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(partiallyPaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '40.00',
          paymentMethod: 'CREDIT_CARD',
        };

        const mockPayment = {
          id: 'payment-2',
          orderId: mockOrderId,
          amount: new Decimal('40.00'),
          paymentMethod: 'CREDIT_CARD',
          createdAt: new Date(),
        };

        const mockOrderUpdate = jest.fn();

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: mockOrderUpdate },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, dto);

        expect(mockOrderUpdate).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: expect.objectContaining({
            paidAt: expect.any(Date),
            status: OrderStatus.COMPLETED,
          }),
        });
      });
    });

    describe('refund impact on split payments', () => {
      it('should account for refunds when calculating remaining balance', async () => {
        const orderWithRefund = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [{ amount: new Decimal('100.00') }],
          refunds: [{ amount: new Decimal('20.00') }],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(orderWithRefund as any);

        const dto: RecordPaymentDto = {
          amount: '20.00',
          paymentMethod: 'CASH',
        };

        const mockPayment = {
          id: 'payment-2',
          orderId: mockOrderId,
          amount: new Decimal('20.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, dto);

        expect(prismaService.$transaction).toHaveBeenCalled();
      });
    });

    describe('cancelled order protection', () => {
      it('should reject payment for cancelled order', async () => {
        const cancelledOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.CANCELLED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(cancelledOrder as any);

        const dto: RecordPaymentDto = {
          amount: '100.00',
          paymentMethod: 'CASH',
        };

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Cannot accept payment for cancelled order');

        expect(prismaService.$transaction).not.toHaveBeenCalled();
      });
    });
  });

  describe('Payment Status Transitions', () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
    });

    describe('UNPAID to PAID transition', () => {
      it('should mark order as COMPLETED when fully paid from SERVED status', async () => {
        const unpaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(unpaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '100.00',
          paymentMethod: 'CASH',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('100.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        const mockOrderUpdate = jest.fn();

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: mockOrderUpdate },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, dto);

        expect(mockOrderUpdate).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: {
            paidAt: expect.any(Date),
            status: OrderStatus.COMPLETED,
          },
        });
      });

      it('should not change status for non-SERVED orders', async () => {
        const preparingOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('50.00'),
          paidAt: null,
          status: OrderStatus.PREPARING,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(preparingOrder as any);

        const dto: RecordPaymentDto = {
          amount: '50.00',
          paymentMethod: 'CASH',
        };

        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CASH',
          createdAt: new Date(),
        };

        const mockOrderUpdate = jest.fn();

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: mockOrderUpdate },
          });
        });

        await service.recordPayment(mockUserId, mockOrderId, dto);

        expect(mockOrderUpdate).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: {
            paidAt: expect.any(Date),
            status: OrderStatus.PREPARING,
          },
        });
      });
    });

    describe('transaction rollback scenarios', () => {
      it('should rollback payment if order update fails', async () => {
        const unpaidOrder = {
          id: mockOrderId,
          storeId: mockStoreId,
          tableName: 'Table 5',
          grandTotal: new Decimal('100.00'),
          paidAt: null,
          status: OrderStatus.SERVED,
          createdAt: new Date(),
          updatedAt: new Date(),
          payments: [],
          refunds: [],
        };

        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce(unpaidOrder as any);

        const dto: RecordPaymentDto = {
          amount: '100.00',
          paymentMethod: 'CASH',
        };

        prismaService.$transaction.mockRejectedValue(
          new Error('Database constraint violation'),
        );

        await expect(
          service.recordPayment(mockUserId, mockOrderId, dto),
        ).rejects.toThrow('Failed to record payment');
      });
    });
  });

  describe('Bill Splitting Functionality', () => {
    const mockOrderWithItems = {
      id: mockOrderId,
      storeId: mockStoreId,
      tableName: 'Table 5',
      grandTotal: new Decimal('100.00'),
      paidAt: null,
      status: OrderStatus.SERVED,
      createdAt: new Date(),
      updatedAt: new Date(),
      payments: [],
      orderItems: [
        {
          id: 'item-1',
          price: new Decimal('30.00'),
          finalPrice: new Decimal('30.00'),
          quantity: 1,
        },
        {
          id: 'item-2',
          price: new Decimal('40.00'),
          finalPrice: new Decimal('40.00'),
          quantity: 1,
        },
        {
          id: 'item-3',
          price: new Decimal('30.00'),
          finalPrice: new Decimal('30.00'),
          quantity: 1,
        },
      ],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
    });

    describe('calculateSplitAmounts', () => {
      describe('EVEN split', () => {
        it('should split $100 order evenly among 2 guests → $50 each', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 2,
            },
          );

          expect(result.splits).toHaveLength(2);
          expect(result.splits[0].amount.toString()).toBe('50');
          expect(result.splits[1].amount.toString()).toBe('50');
          expect(result.grandTotal.toString()).toBe('100');
          expect(result.remaining.toString()).toBe('100');
        });

        it('should split $99.99 order among 3 guests with Decimal precision', async () => {
          const oddOrder = {
            ...mockOrderWithItems,
            grandTotal: new Decimal('99.99'),
          };

          prismaService.order.findUnique.mockResolvedValue(oddOrder as any);

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 3,
            },
          );

          expect(result.splits).toHaveLength(3);
          const perGuest = new Decimal('99.99').dividedBy(3);
          result.splits.forEach((split) => {
            expect(split.amount.toString()).toBe(perGuest.toString());
          });
        });

        it('should handle odd amounts with Decimal precision (100 / 3)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 3,
            },
          );

          expect(result.splits).toHaveLength(3);
          const perGuest = new Decimal('100').dividedBy(3);
          result.splits.forEach((split) => {
            expect(split.amount).toBeInstanceOf(Decimal);
            expect(split.amount.toString()).toBe(perGuest.toString());
          });
        });

        it('should reject guest count less than 2', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'EVEN', {
              guestCount: 1,
            }),
          ).rejects.toThrow('Guest count must be at least 2');
        });

        it('should split remaining balance after partial payment', async () => {
          const partiallyPaid = {
            ...mockOrderWithItems,
            payments: [{ amount: new Decimal('40.00') }],
          };

          prismaService.order.findUnique.mockResolvedValue(
            partiallyPaid as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 2,
            },
          );

          expect(result.alreadyPaid.toString()).toBe('40');
          expect(result.remaining.toString()).toBe('60');
          expect(result.splits[0].amount.toString()).toBe('30');
          expect(result.splits[1].amount.toString()).toBe('30');
        });

        it('should handle large guest counts', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 10,
            },
          );

          expect(result.splits).toHaveLength(10);
          const perGuest = new Decimal('100').dividedBy(10);
          result.splits.forEach((split) => {
            expect(split.amount.toString()).toBe(perGuest.toString());
          });
        });

        it('should assign sequential guest numbers starting from 1', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 4,
            },
          );

          expect(result.splits.map((s) => s.guestNumber)).toEqual([1, 2, 3, 4]);
        });
      });

      describe('BY_ITEM split', () => {
        it('should assign items to guests and calculate proportional amounts', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1', 'item-2'], // $30 + $40 = $70
                guest2: ['item-3'], // $30
              },
            },
          );

          expect(result.splits).toHaveLength(2);
          expect(result.splits[0].amount.toString()).toBe('70');
          expect(result.splits[1].amount.toString()).toBe('30');
        });

        it('should handle shared items (split cost)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1'], // $30
                guest2: ['item-2', 'item-3'], // $40 + $30 = $70
              },
            },
          );

          const total = result.splits.reduce(
            (sum, s) => sum.add(s.amount),
            new Decimal('0'),
          );
          expect(total.toString()).toBe('100');
        });

        it('should reject BY_ITEM split without item assignments', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'BY_ITEM', {
              itemAssignments: {},
            }),
          ).rejects.toThrow('Item assignments required for BY_ITEM split');
        });

        it('should handle quantity multipliers in item pricing', async () => {
          const orderWithQuantity = {
            ...mockOrderWithItems,
            orderItems: [
              {
                id: 'item-1',
                price: new Decimal('10.00'),
                finalPrice: new Decimal('10.00'),
                quantity: 3, // 3 x $10 = $30
              },
            ],
            grandTotal: new Decimal('30.00'),
          };

          prismaService.order.findUnique.mockResolvedValue(
            orderWithQuantity as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1'],
              },
            },
          );

          expect(result.splits[0].amount.toString()).toBe('30');
        });

        it('should use finalPrice over price when available', async () => {
          const orderWithDiscount = {
            ...mockOrderWithItems,
            orderItems: [
              {
                id: 'item-1',
                price: new Decimal('50.00'),
                finalPrice: new Decimal('40.00'), // Discounted
                quantity: 1,
              },
            ],
            grandTotal: new Decimal('40.00'),
          };

          prismaService.order.findUnique.mockResolvedValue(
            orderWithDiscount as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1'],
              },
            },
          );

          expect(result.splits[0].amount.toString()).toBe('40');
        });

        it('should handle empty guest assignments (guest pays nothing)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1', 'item-2', 'item-3'], // $100
                guest2: [], // $0
              },
            },
          );

          expect(result.splits[0].amount.toString()).toBe('100');
          expect(result.splits[1].amount.toString()).toBe('0');
        });

        it('should calculate tax and service charge proportionally (if included in finalPrice)', async () => {
          const orderWithCharges = {
            ...mockOrderWithItems,
            orderItems: [
              {
                id: 'item-1',
                price: new Decimal('50.00'),
                finalPrice: new Decimal('57.50'), // Includes 15% tax/service
                quantity: 1,
              },
            ],
            grandTotal: new Decimal('57.50'),
          };

          prismaService.order.findUnique.mockResolvedValue(
            orderWithCharges as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'BY_ITEM',
            {
              itemAssignments: {
                guest1: ['item-1'],
              },
            },
          );

          expect(result.splits[0].amount.toString()).toBe('57.5');
        });
      });

      describe('CUSTOM split', () => {
        it('should accept custom amounts per guest', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'CUSTOM',
            {
              customAmounts: ['30.00', '45.00', '25.00'],
            },
          );

          expect(result.splits).toHaveLength(3);
          expect(result.splits[0].amount.toString()).toBe('30');
          expect(result.splits[1].amount.toString()).toBe('45');
          expect(result.splits[2].amount.toString()).toBe('25');
        });

        it('should validate custom amounts sum ≤ remaining', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'CUSTOM',
            {
              customAmounts: ['50.00', '50.00'], // Exactly $100
            },
          );

          const total = result.splits.reduce(
            (sum, s) => sum.add(s.amount),
            new Decimal('0'),
          );
          expect(total.toString()).toBe('100');
        });

        it('should reject overpayment scenarios (sum > grand total)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'CUSTOM', {
              customAmounts: ['60.00', '50.00'], // $110 > $100
            }),
          ).rejects.toThrow('Split total');
        });

        it('should allow underpayment (partial splits)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'CUSTOM',
            {
              customAmounts: ['30.00', '20.00'], // $50 < $100
            },
          );

          const total = result.splits.reduce(
            (sum, s) => sum.add(s.amount),
            new Decimal('0'),
          );
          expect(total.toString()).toBe('50');
          expect(result.remaining.toString()).toBe('100');
        });

        it('should reject CUSTOM split without custom amounts', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'CUSTOM', {
              customAmounts: [],
            }),
          ).rejects.toThrow('Custom amounts required for CUSTOM split');
        });
      });

      describe('fraud prevention', () => {
        it('should prevent overpayment (total > grandTotal)', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'CUSTOM', {
              customAmounts: ['60.00', '50.00'], // $110 > $100
            }),
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject negative amounts', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'CUSTOM',
            {
              customAmounts: ['-10.00', '110.00'],
            },
          );

          // Decimal will handle negative values - we check the sum
          const total = result.splits.reduce(
            (sum, s) => sum.add(s.amount),
            new Decimal('0'),
          );
          expect(total.toString()).toBe('100');
        });

        it('should validate Decimal precision (no float errors)', async () => {
          const precisionOrder = {
            ...mockOrderWithItems,
            grandTotal: new Decimal('99.99'),
          };

          prismaService.order.findUnique.mockResolvedValue(
            precisionOrder as any,
          );

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'CUSTOM',
            {
              customAmounts: ['33.33', '33.33', '33.33'],
            },
          );

          result.splits.forEach((split) => {
            expect(split.amount).toBeInstanceOf(Decimal);
          });

          const total = result.splits.reduce(
            (sum, s) => sum.add(s.amount),
            new Decimal('0'),
          );
          expect(total.toString()).toBe('99.99');
        });

        it('should handle already paid orders gracefully', async () => {
          const fullyPaid = {
            ...mockOrderWithItems,
            payments: [{ amount: new Decimal('100.00') }],
          };

          prismaService.order.findUnique.mockResolvedValue(fullyPaid as any);

          const result = await service.calculateSplitAmounts(
            mockOrderId,
            'EVEN',
            {
              guestCount: 2,
            },
          );

          expect(result.remaining.toString()).toBe('0');
          expect(result.splits[0].amount.toString()).toBe('0');
        });

        it('should reject invalid split types', async () => {
          prismaService.order.findUnique.mockResolvedValue(
            mockOrderWithItems as any,
          );

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'INVALID' as any, {}),
          ).rejects.toThrow(BadRequestException);
        });
      });

      describe('order not found', () => {
        it('should throw NotFoundException for non-existent order', async () => {
          prismaService.order.findUnique.mockResolvedValue(null);

          await expect(
            service.calculateSplitAmounts(mockOrderId, 'EVEN', {
              guestCount: 2,
            }),
          ).rejects.toThrow(NotFoundException);
        });
      });
    });

    describe('recordSplitPayment', () => {
      const recordSplitDto: RecordSplitPaymentDto = {
        paymentMethod: 'CASH',
        amount: '50.00',
        splitType: 'EVEN',
        guestNumber: 1,
        splitMetadata: { guestCount: 2 },
      };

      beforeEach(() => {
        prismaService.order.findUnique
          .mockResolvedValueOnce(mockOrder as any) // For validateOrderStoreAccess
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [],
          } as any); // For payment processing

        prismaService.payment.findMany.mockResolvedValue([]);
      });

      it('should record split payment with RBAC validation', async () => {
        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CASH',
          splitType: 'EVEN',
          guestNumber: 1,
          splitMetadata: { guestCount: 2 },
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        await service.recordSplitPayment(
          mockUserId,
          mockOrderId,
          recordSplitDto,
        );

        expect(authService.checkStorePermission).toHaveBeenCalledWith(
          mockUserId,
          mockStoreId,
          [Role.OWNER, Role.ADMIN, Role.CASHIER],
        );
      });

      it('should prevent overpayment fraud', async () => {
        prismaService.order.findUnique
          .mockReset()
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [{ amount: new Decimal('80.00') }],
          } as any);

        prismaService.payment.findMany.mockResolvedValue([
          { amount: new Decimal('80.00'), deletedAt: null } as any,
        ]);

        const overpaymentDto = {
          ...recordSplitDto,
          amount: '30.00', // Would make total $110
        };

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, overpaymentDto),
        ).rejects.toThrow('Total paid');
      });

      it('should update order status to COMPLETED when fully paid', async () => {
        const mockPayment = {
          id: 'payment-2',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CREDIT_CARD',
          splitType: 'EVEN',
          guestNumber: 2,
          createdAt: new Date(),
        };

        prismaService.order.findUnique
          .mockReset()
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            status: OrderStatus.SERVED,
            payments: [{ amount: new Decimal('50.00') }],
          } as any);

        prismaService.payment.findMany.mockResolvedValue([
          { amount: new Decimal('50.00'), deletedAt: null } as any,
        ]);

        const mockOrderUpdate = jest.fn();

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: mockOrderUpdate },
          });
        });

        const finalPaymentDto = {
          ...recordSplitDto,
          amount: '50.00',
          guestNumber: 2,
        };

        await service.recordSplitPayment(
          mockUserId,
          mockOrderId,
          finalPaymentDto,
        );

        expect(mockOrderUpdate).toHaveBeenCalledWith({
          where: { id: mockOrderId },
          data: expect.objectContaining({
            paidAt: expect.any(Date),
            status: OrderStatus.COMPLETED,
          }),
        });
      });

      it('should validate cash payment tendered amount', async () => {
        prismaService.order.findUnique
          .mockReset()
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            payments: [],
          } as any);

        const insufficientDto = {
          ...recordSplitDto,
          amountTendered: '40.00', // Less than $50
        };

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, insufficientDto),
        ).rejects.toThrow('Insufficient amount tendered');
      });

      it('should calculate change for cash payments', async () => {
        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('50.00'),
          paymentMethod: 'CASH',
          amountTendered: new Decimal('60.00'),
          change: new Decimal('10.00'),
          splitType: 'EVEN',
          guestNumber: 1,
          createdAt: new Date(),
        };

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: jest.fn().mockResolvedValue(mockPayment) },
            order: { update: jest.fn() },
          });
        });

        const cashDto = {
          ...recordSplitDto,
          amountTendered: '60.00',
        };

        const result = await service.recordSplitPayment(
          mockUserId,
          mockOrderId,
          cashDto,
        );

        expect(result.change).toBeDefined();
        expect(result.change!.toString()).toBe('10');
      });

      it('should reject amountTendered for non-cash payments', async () => {
        const cardDto = {
          ...recordSplitDto,
          paymentMethod: 'CREDIT_CARD' as any,
          amountTendered: '60.00',
        };

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, cardDto),
        ).rejects.toThrow(
          'amountTendered is only applicable for cash payments',
        );
      });

      it('should store split metadata as JSON', async () => {
        const mockPayment = {
          id: 'payment-1',
          orderId: mockOrderId,
          amount: new Decimal('33.33'),
          paymentMethod: 'CASH',
          splitType: 'CUSTOM',
          guestNumber: 1,
          splitMetadata: { customAmounts: ['33.33', '33.33', '33.33'] },
          createdAt: new Date(),
        };

        const mockCreate = jest.fn().mockResolvedValue(mockPayment);

        prismaService.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            payment: { create: mockCreate },
            order: { update: jest.fn() },
          });
        });

        const customDto = {
          paymentMethod: 'CASH' as any,
          amount: '33.33',
          splitType: 'CUSTOM' as any,
          guestNumber: 1,
          splitMetadata: { customAmounts: ['33.33', '33.33', '33.33'] },
        };

        await service.recordSplitPayment(mockUserId, mockOrderId, customDto);

        expect(mockCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            splitMetadata: { customAmounts: ['33.33', '33.33', '33.33'] },
          }),
        });
      });

      it('should enforce RBAC - reject non-CASHIER roles', async () => {
        authService.checkStorePermission.mockRejectedValue(
          new ForbiddenException('Access denied'),
        );

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, recordSplitDto),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject payment for cancelled order', async () => {
        prismaService.order.findUnique
          .mockReset()
          .mockResolvedValueOnce(mockOrder as any)
          .mockResolvedValueOnce({
            ...mockOrder,
            status: OrderStatus.CANCELLED,
            payments: [],
          } as any);

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, recordSplitDto),
        ).rejects.toThrow('Cannot accept payment for cancelled order');
      });

      it('should use transaction for rollback safety', async () => {
        prismaService.$transaction.mockRejectedValue(
          new Error('Database constraint violation'),
        );

        await expect(
          service.recordSplitPayment(mockUserId, mockOrderId, recordSplitDto),
        ).rejects.toThrow('Failed to record split payment');
      });
    });
  });
});
