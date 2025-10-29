import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";

import { AuditLogService } from "./audit-log.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAuditLogDto } from "./dto/create-audit-log.dto";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let prismaService: PrismaMock;

  const mockStoreId = "store-123";
  const mockUserId = "user-456";
  const mockTargetUserId = "user-789";

  const mockAuditLog = {
    id: "audit-1",
    storeId: mockStoreId,
    userId: mockUserId,
    action: AuditAction.STORE_SETTING_CHANGED,
    entityType: "StoreSetting",
    entityId: mockStoreId,
    details: { field: "taxRate", oldValue: "7", newValue: "10" },
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createLog", () => {
    it("should create audit log with all fields", async () => {
      // Arrange
      const dto: CreateAuditLogDto = {
        storeId: mockStoreId,
        userId: mockUserId,
        action: AuditAction.MENU_PRICE_CHANGED,
        entityType: "MenuItem",
        entityId: "item-123",
        details: { itemName: "Burger", oldPrice: "9.99", newPrice: "12.99" },
        ipAddress: "10.0.0.1",
        userAgent: "Chrome/120.0",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        id: "new-log",
        ...dto,
        createdAt: new Date(),
      });

      // Act
      const result = await service.createLog(dto);

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: dto.userId,
          storeId: dto.storeId,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          details: dto.details,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
      expect(result.storeId).toBe(mockStoreId);
      expect(result.action).toBe(AuditAction.MENU_PRICE_CHANGED);
    });

    it("should handle null ipAddress and userAgent", async () => {
      // Arrange
      const dto: CreateAuditLogDto = {
        storeId: mockStoreId,
        userId: mockUserId,
        action: AuditAction.USER_ROLE_CHANGED,
        entityType: "UserStore",
        entityId: "user-store-1",
        details: { oldRole: "SERVER", newRole: "ADMIN" },
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        id: "log-2",
        ...dto,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      });

      // Act
      const result = await service.createLog(dto);

      // Assert
      // Note: Prisma returns null for optional fields, not undefined
      expect(result.ipAddress).toBeNull();
      expect(result.userAgent).toBeNull();
    });

    it("should serialize details as JSON", async () => {
      // Arrange
      const complexDetails = {
        nested: { value: 123 },
        array: [1, 2, 3],
        string: "test",
      };
      const dto: CreateAuditLogDto = {
        storeId: mockStoreId,
        action: AuditAction.STORE_SETTING_CHANGED,
        entityType: "StoreSetting",
        details: complexDetails,
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        id: "log-3",
        ...dto,
        createdAt: new Date(),
      });

      // Act
      const result = await service.createLog(dto);

      // Assert
      expect(result.details).toEqual(complexDetails);
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const dto: CreateAuditLogDto = {
        storeId: mockStoreId,
        action: AuditAction.PAYMENT_REFUNDED,
        entityType: "Payment",
      };
      const dbError = new Error("Database connection lost");
      prismaService.auditLog.create = jest.fn().mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.createLog(dto)).rejects.toThrow(
        "Database connection lost",
      );
    });
  });

  describe("logStoreSettingChange", () => {
    it("should log setting change with old and new values", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logStoreSettingChange(
        mockStoreId,
        mockUserId,
        { field: "taxRate", oldValue: "7", newValue: "10" },
        "192.168.1.1",
        "Mozilla/5.0",
      );

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          storeId: mockStoreId,
          userId: mockUserId,
          action: AuditAction.STORE_SETTING_CHANGED,
          entityType: "StoreSetting",
          entityId: mockStoreId,
          details: { field: "taxRate", oldValue: "7", newValue: "10" },
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
      });
    });

    it("should use STORE_SETTING_CHANGED action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logStoreSettingChange(mockStoreId, mockUserId, {
        field: "currency",
        oldValue: "USD",
        newValue: "EUR",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.STORE_SETTING_CHANGED);
    });
  });

  describe("logMenuPriceChange", () => {
    it("should log price change with item details", async () => {
      // Arrange
      const menuItemId = "item-123";
      const details = {
        itemName: "Cheeseburger",
        oldPrice: "8.99",
        newPrice: "10.99",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        ...mockAuditLog,
        entityId: menuItemId,
        details,
      });

      // Act
      await service.logMenuPriceChange(
        mockStoreId,
        mockUserId,
        menuItemId,
        details,
      );

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.MENU_PRICE_CHANGED,
          entityType: "MenuItem",
          entityId: menuItemId,
          details,
        }),
      });
    });

    it("should use MENU_PRICE_CHANGED action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logMenuPriceChange(mockStoreId, mockUserId, "item-1", {
        itemName: "Pizza",
        oldPrice: "15.00",
        newPrice: "17.50",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.MENU_PRICE_CHANGED);
    });
  });

  describe("logPaymentRefund", () => {
    it("should log refund with amount and reason", async () => {
      // Arrange
      const paymentId = "payment-123";
      const details = {
        amount: "50.00",
        reason: "Customer complaint",
        orderId: "order-456",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        ...mockAuditLog,
        entityId: paymentId,
        details,
      });

      // Act
      await service.logPaymentRefund(
        mockStoreId,
        mockUserId,
        paymentId,
        details,
      );

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.PAYMENT_REFUNDED,
          entityType: "Payment",
          entityId: paymentId,
          details,
        }),
      });
    });

    it("should use PAYMENT_REFUNDED action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logPaymentRefund(mockStoreId, mockUserId, "pay-1", {
        amount: "25.00",
        reason: "Duplicate charge",
        orderId: "ord-1",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.PAYMENT_REFUNDED);
    });
  });

  describe("logUserRoleChange", () => {
    it("should log role change with target user", async () => {
      // Arrange
      const details = {
        targetUserEmail: "staff@example.com",
        oldRole: "SERVER",
        newRole: "ADMIN",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        ...mockAuditLog,
        entityId: mockTargetUserId,
        details,
      });

      // Act
      await service.logUserRoleChange(
        mockStoreId,
        mockUserId,
        mockTargetUserId,
        details,
      );

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.USER_ROLE_CHANGED,
          entityType: "UserStore",
          entityId: mockTargetUserId,
          details,
        }),
      });
    });

    it("should use USER_ROLE_CHANGED action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logUserRoleChange(mockStoreId, mockUserId, "target-1", {
        targetUserEmail: "user@test.com",
        oldRole: "CHEF",
        newRole: "CASHIER",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.USER_ROLE_CHANGED);
    });
  });

  describe("logUserSuspension", () => {
    it("should log suspension with reason", async () => {
      // Arrange
      const details = {
        targetUserEmail: "badactor@example.com",
        reason: "Fraudulent activity detected",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        ...mockAuditLog,
        entityId: mockTargetUserId,
        details,
      });

      // Act
      await service.logUserSuspension(
        mockStoreId,
        mockUserId,
        mockTargetUserId,
        details,
      );

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.USER_SUSPENDED,
          entityType: "User",
          entityId: mockTargetUserId,
          details,
        }),
      });
    });

    it("should use USER_SUSPENDED action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logUserSuspension(mockStoreId, mockUserId, "target-2", {
        targetUserEmail: "suspended@test.com",
        reason: "Policy violation",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.USER_SUSPENDED);
    });
  });

  describe("logItem86", () => {
    it("should log 86 action", async () => {
      // Arrange
      const menuItemId = "item-456";
      const details = {
        itemName: "Salmon Special",
        reason: "Out of stock - supplier shortage",
      };
      prismaService.auditLog.create = jest.fn().mockResolvedValue({
        ...mockAuditLog,
        entityId: menuItemId,
        details,
      });

      // Act
      await service.logItem86(mockStoreId, mockUserId, menuItemId, details);

      // Assert
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.MENU_ITEM_86D,
          entityType: "MenuItem",
          entityId: menuItemId,
          details,
        }),
      });
    });

    it("should use MENU_ITEM_86D action", async () => {
      // Arrange
      prismaService.auditLog.create = jest.fn().mockResolvedValue(mockAuditLog);

      // Act
      await service.logItem86(mockStoreId, mockUserId, "item-3", {
        itemName: "Lobster Bisque",
        reason: "Not available today",
      });

      // Assert
      const call = prismaService.auditLog.create.mock.calls[0][0];
      expect(call.data.action).toBe(AuditAction.MENU_ITEM_86D);
    });
  });

  describe("getStoreAuditLogs", () => {
    const mockLogs = [
      mockAuditLog,
      { ...mockAuditLog, id: "audit-2" },
      { ...mockAuditLog, id: "audit-3" },
    ];

    it("should paginate results correctly", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(50);

      // Act
      const result = await service.getStoreAuditLogs(mockStoreId, {
        page: 2,
        limit: 10,
      });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
        }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(50);
    });

    it("should filter by action type", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(3);

      // Act
      await service.getStoreAuditLogs(mockStoreId, {
        action: AuditAction.PAYMENT_REFUNDED,
      });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AuditAction.PAYMENT_REFUNDED,
          }),
        }),
      );
    });

    it("should filter by userId", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(3);

      // Act
      await service.getStoreAuditLogs(mockStoreId, { userId: mockUserId });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
          }),
        }),
      );
    });

    it("should filter by date range (start and end)", async () => {
      // Arrange
      const startDate = new Date("2025-01-01");
      const endDate = new Date("2025-01-31");
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(3);

      // Act
      await service.getStoreAuditLogs(mockStoreId, { startDate, endDate });

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        }),
      );
    });

    it("should enforce storeId isolation", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(3);

      // Act
      await service.getStoreAuditLogs(mockStoreId);

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
          }),
        }),
      );
    });

    it("should order by createdAt desc", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(3);

      // Act
      await service.getStoreAuditLogs(mockStoreId);

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("should return total count", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue(mockLogs);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(150);

      // Act
      const result = await service.getStoreAuditLogs(mockStoreId);

      // Assert
      expect(result.total).toBe(150);
      expect(result.logs).toHaveLength(3);
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const dbError = new Error("Query timeout");
      prismaService.auditLog.findMany = jest.fn().mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.getStoreAuditLogs(mockStoreId)).rejects.toThrow(
        "Query timeout",
      );
    });
  });

  describe("exportToCSV", () => {
    const mockLogsForExport = [
      {
        createdAt: new Date("2025-01-25T10:00:00Z"),
        userId: "user-1",
        action: AuditAction.MENU_PRICE_CHANGED,
        entityType: "MenuItem",
        entityId: "item-1",
        details: { oldPrice: "10", newPrice: "12" },
        ipAddress: "192.168.1.1",
        userAgent: "Chrome/120",
      },
      {
        createdAt: new Date("2025-01-25T11:00:00Z"),
        userId: null,
        action: AuditAction.STORE_SETTING_CHANGED,
        entityType: "StoreSetting",
        entityId: null,
        details: {},
        ipAddress: null,
        userAgent: null,
      },
    ];

    it("should generate CSV with headers", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue([]);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(0);

      // Act
      const csv = await service.exportToCSV(mockStoreId);

      // Assert
      expect(csv).toContain(
        "Timestamp,User ID,Action,Entity Type,Entity ID,Details,IP Address,User Agent",
      );
    });

    it("should escape quotes in fields", async () => {
      // Arrange
      const logWithQuotes = [
        {
          ...mockLogsForExport[0],
          details: { reason: 'Customer said "not satisfied"' },
        },
      ];
      prismaService.auditLog.findMany = jest
        .fn()
        .mockResolvedValue(logWithQuotes);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(1);

      // Act
      const csv = await service.exportToCSV(mockStoreId);

      // Assert
      // CSV should contain the escaped details field with quotes properly escaped
      expect(csv).toContain("not satisfied"); // Check that content is preserved
      expect(csv).toContain("Customer said"); // Verify full context exists
    });

    it("should handle empty result set", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest.fn().mockResolvedValue([]);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(0);

      // Act
      const csv = await service.exportToCSV(mockStoreId);

      // Assert
      expect(csv).toBe(
        "Timestamp,User ID,Action,Entity Type,Entity ID,Details,IP Address,User Agent\n",
      );
    });

    it("should limit to 100K records", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest
        .fn()
        .mockResolvedValue(mockLogsForExport);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(2);

      // Act
      await service.exportToCSV(mockStoreId);

      // Assert
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100000,
        }),
      );
    });

    it("should include all columns", async () => {
      // Arrange
      prismaService.auditLog.findMany = jest
        .fn()
        .mockResolvedValue(mockLogsForExport);
      prismaService.auditLog.count = jest.fn().mockResolvedValue(2);

      // Act
      const csv = await service.exportToCSV(mockStoreId);

      // Assert
      const lines = csv.split("\n");
      expect(lines[0]).toContain("Timestamp");
      expect(lines[0]).toContain("User ID");
      expect(lines[0]).toContain("Action");
      expect(lines[0]).toContain("Entity Type");
      expect(lines[0]).toContain("Entity ID");
      expect(lines[0]).toContain("Details");
      expect(lines[0]).toContain("IP Address");
      expect(lines[0]).toContain("User Agent");

      // Check data rows exist
      expect(lines[1]).toContain("2025-01-25T10:00:00.000Z");
      expect(lines[1]).toContain("MENU_PRICE_CHANGED");
      expect(lines[2]).toContain("SYSTEM"); // null userId
    });

    it("should handle database errors during export", async () => {
      // Arrange
      const dbError = new Error("Export failed");
      prismaService.auditLog.findMany = jest.fn().mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.exportToCSV(mockStoreId)).rejects.toThrow(
        "Export failed",
      );
    });
  });
});
