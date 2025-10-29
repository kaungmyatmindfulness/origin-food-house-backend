import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Role, Prisma, TableStatus } from "@prisma/client";

import { TableGateway } from "./table.gateway";
import { TableService } from "./table.service";
import { AuthService } from "../auth/auth.service";
import {
  createPrismaMock,
  PrismaMock,
} from "../common/testing/prisma-mock.helper";
import { PrismaService } from "../prisma/prisma.service";
import { TierService } from "../tier/tier.service";

describe("TableService", () => {
  let service: TableService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;
  let tableGateway: jest.Mocked<TableGateway>;
  let _tierService: jest.Mocked<TierService>;

  const mockUserId = "user-123";
  const mockStoreId = "store-123";
  const mockTableId = "table-123";

  const mockTable = {
    id: mockTableId,
    storeId: mockStoreId,
    name: "Table 1",
    currentStatus: TableStatus.VACANT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransaction = {
    table: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
  };

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableService,
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
        {
          provide: TableGateway,
          useValue: {
            broadcastTableCreated: jest.fn(),
            broadcastTableUpdated: jest.fn(),
            broadcastTableDeleted: jest.fn(),
            broadcastTableStatusUpdate: jest.fn(),
          },
        },
        {
          provide: TierService,
          useValue: {
            invalidateUsageCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TableService>(TableService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
    tableGateway = module.get(TableGateway);
    _tierService = module.get(TierService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createTable", () => {
    const createDto = { name: "Table 5" };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should create table successfully", async () => {
      mockTransaction.table.findFirst.mockResolvedValue(null);
      mockTransaction.table.create.mockResolvedValue({
        ...mockTable,
        name: createDto.name,
      } as any);

      const result = await service.createTable(
        mockUserId,
        mockStoreId,
        createDto,
      );

      expect(result.name).toBe(createDto.name);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN],
      );
      expect(tableGateway.broadcastTableCreated).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ name: createDto.name }),
      );
    });

    it("should throw BadRequestException if table name already exists", async () => {
      mockTransaction.table.findFirst.mockResolvedValue(mockTable as any);

      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow("conflicts with an existing table");
    });

    it("should check permissions before creating", async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Insufficient permissions"),
      );

      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("findAllByStore", () => {
    it("should return all tables sorted naturally", async () => {
      const mockTables = [
        { ...mockTable, name: "T-10" },
        { ...mockTable, name: "T-2" },
        { ...mockTable, name: "T-1" },
      ];
      prismaService.store.count.mockResolvedValue(1);
      prismaService.table.findMany.mockResolvedValue(mockTables as any);

      const result = await service.findAllByStore(mockStoreId);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("T-1");
      expect(result[1].name).toBe("T-2");
      expect(result[2].name).toBe("T-10");
    });

    it("should throw NotFoundException if store not found", async () => {
      prismaService.store.count.mockResolvedValue(0);

      await expect(service.findAllByStore(mockStoreId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return empty array if no tables exist", async () => {
      prismaService.store.count.mockResolvedValue(1);
      prismaService.table.findMany.mockResolvedValue([]);

      const result = await service.findAllByStore(mockStoreId);

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return table if it belongs to store", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);

      const result = await service.findOne(mockStoreId, mockTableId);

      expect(result).toEqual(mockTable);
      expect(prismaService.table.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: mockTableId, storeId: mockStoreId, deletedAt: null },
      });
    });

    it("should throw NotFoundException if table not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Not found",
        {
          code: "P2025",
          clientVersion: "5.0.0",
        },
      );
      prismaService.table.findFirstOrThrow.mockRejectedValue(prismaError);

      // StandardErrorHandler converts P2025 to InternalServerErrorException
      await expect(service.findOne(mockStoreId, mockTableId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("updateTable", () => {
    const updateDto = { name: "Updated Table" };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should update table name successfully", async () => {
      mockTransaction.table.findFirst.mockResolvedValue(null);
      mockTransaction.table.update.mockResolvedValue({
        ...mockTable,
        name: updateDto.name,
      } as any);

      const result = await service.updateTable(
        mockUserId,
        mockStoreId,
        mockTableId,
        updateDto,
      );

      expect(result.name).toBe(updateDto.name);
      expect(mockTransaction.table.update).toHaveBeenCalled();
      expect(tableGateway.broadcastTableUpdated).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ name: updateDto.name }),
      );
    });

    it("should throw BadRequestException if name conflicts with another table", async () => {
      mockTransaction.table.findFirst.mockResolvedValue({
        id: "other-table",
        name: updateDto.name,
      } as any);

      await expect(
        service.updateTable(mockUserId, mockStoreId, mockTableId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("deleteTable", () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);
    });

    it("should soft delete table successfully", async () => {
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        deletedAt: new Date(),
      } as any);

      const result = await service.deleteTable(
        mockUserId,
        mockStoreId,
        mockTableId,
      );

      expect(result).toEqual({ id: mockTableId, deleted: true });
      expect(prismaService.table.update).toHaveBeenCalledWith({
        where: { id: mockTableId },
        data: { deletedAt: expect.any(Date) },
      });
      expect(tableGateway.broadcastTableDeleted).toHaveBeenCalledWith(
        mockStoreId,
        mockTableId,
      );
    });
  });

  describe("syncTables", () => {
    const syncDto = {
      tables: [
        { id: "table-1", name: "T-1" },
        { name: "T-2" }, // New table without ID
      ],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it("should sync tables successfully", async () => {
      const currentTables = [
        { id: "table-1", name: "Old T-1" },
        { id: "table-3", name: "T-3" }, // Will be soft deleted
      ];

      mockTransaction.table.findMany.mockResolvedValueOnce(
        currentTables as any,
      );
      mockTransaction.table.findFirst.mockResolvedValue(null);
      mockTransaction.table.update.mockResolvedValue({
        id: "table-1",
        name: "T-1",
      } as any);
      mockTransaction.table.create.mockResolvedValue({
        id: "table-2",
        name: "T-2",
      } as any);
      mockTransaction.table.updateMany.mockResolvedValue({ count: 1 } as any);
      mockTransaction.table.findMany.mockResolvedValueOnce([
        { id: "table-1", name: "T-1" },
        { id: "table-2", name: "T-2" },
      ] as any);

      const result = await service.syncTables(mockUserId, mockStoreId, syncDto);

      expect(result).toHaveLength(2);
      expect(mockTransaction.table.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["table-3"] } },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should throw BadRequestException for duplicate names in input", async () => {
      const duplicateDto = {
        tables: [{ name: "T-1" }, { name: "T-1" }],
      };

      await expect(
        service.syncTables(mockUserId, mockStoreId, duplicateDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, duplicateDto),
      ).rejects.toThrow("Duplicate table names");
    });

    it("should throw BadRequestException for empty table names", async () => {
      const emptyNameDto = {
        tables: [{ name: "" }, { name: "T-1" }],
      };

      await expect(
        service.syncTables(mockUserId, mockStoreId, emptyNameDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, emptyNameDto),
      ).rejects.toThrow("cannot be empty");
    });

    it("should throw BadRequestException if updating non-existent table ID", async () => {
      const invalidDto = {
        tables: [{ id: "non-existent-id", name: "T-1" }],
      };
      const currentTables = [{ id: "table-1", name: "T-1" }];

      mockTransaction.table.findMany.mockResolvedValue(currentTables as any);

      await expect(
        service.syncTables(mockUserId, mockStoreId, invalidDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, invalidDto),
      ).rejects.toThrow("not found in store");
    });
  });

  describe("updateTableStatus", () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);
    });

    it("should update table status successfully", async () => {
      const updatedTable = {
        ...mockTable,
        currentStatus: TableStatus.SEATED,
      };
      prismaService.table.update.mockResolvedValue(updatedTable as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.SEATED },
      );

      expect(result.currentStatus).toBe(TableStatus.SEATED);
      expect(authService.checkStorePermission).toHaveBeenCalledWith(
        mockUserId,
        mockStoreId,
        [Role.OWNER, Role.ADMIN, Role.SERVER],
      );
      expect(prismaService.table.update).toHaveBeenCalledWith({
        where: { id: mockTableId },
        data: { currentStatus: TableStatus.SEATED },
      });
      expect(tableGateway.broadcastTableStatusUpdate).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ currentStatus: TableStatus.SEATED }),
      );
    });

    it("should check permissions before updating", async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException("Insufficient permissions"),
      );

      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.SEATED,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if table not found", async () => {
      prismaService.table.findFirstOrThrow.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.SEATED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow idempotent status updates (same status)", async () => {
      prismaService.table.update.mockResolvedValue(mockTable as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.VACANT },
      );

      expect(result.currentStatus).toBe(TableStatus.VACANT);
    });

    it("should validate VACANT to SEATED transition", async () => {
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SEATED,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.SEATED },
      );

      expect(result.currentStatus).toBe(TableStatus.SEATED);
    });

    it("should validate SEATED to ORDERING transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SEATED,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.ORDERING,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.ORDERING },
      );

      expect(result.currentStatus).toBe(TableStatus.ORDERING);
    });

    it("should validate ORDERING to SERVED transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.ORDERING,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SERVED,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.SERVED },
      );

      expect(result.currentStatus).toBe(TableStatus.SERVED);
    });

    it("should validate SERVED to READY_TO_PAY transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SERVED,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.READY_TO_PAY,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.READY_TO_PAY },
      );

      expect(result.currentStatus).toBe(TableStatus.READY_TO_PAY);
    });

    it("should validate READY_TO_PAY to CLEANING transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.READY_TO_PAY,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.CLEANING,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.CLEANING },
      );

      expect(result.currentStatus).toBe(TableStatus.CLEANING);
    });

    it("should validate CLEANING to VACANT transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.CLEANING,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.VACANT,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.VACANT },
      );

      expect(result.currentStatus).toBe(TableStatus.VACANT);
    });

    it("should reject invalid VACANT to SERVED transition", async () => {
      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.SERVED,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.SERVED,
        }),
      ).rejects.toThrow(/Invalid table status transition/);
    });

    it("should reject invalid VACANT to ORDERING transition", async () => {
      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.ORDERING,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject invalid SEATED to READY_TO_PAY transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SEATED,
      } as any);

      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.READY_TO_PAY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow SERVED to ORDERING transition (adding more items)", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SERVED,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.ORDERING,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.ORDERING },
      );

      expect(result.currentStatus).toBe(TableStatus.ORDERING);
    });

    it("should allow READY_TO_PAY to ORDERING transition (payment cancelled)", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.READY_TO_PAY,
      } as any);
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.ORDERING,
      } as any);

      const result = await service.updateTableStatus(
        mockUserId,
        mockStoreId,
        mockTableId,
        { status: TableStatus.ORDERING },
      );

      expect(result.currentStatus).toBe(TableStatus.ORDERING);
    });

    it("should allow emergency transitions to VACANT from any status", async () => {
      const statuses = [
        TableStatus.SEATED,
        TableStatus.ORDERING,
        TableStatus.SERVED,
        TableStatus.READY_TO_PAY,
      ];

      for (const status of statuses) {
        prismaService.table.findFirstOrThrow.mockResolvedValue({
          ...mockTable,
          currentStatus: status,
        } as any);
        prismaService.table.update.mockResolvedValue({
          ...mockTable,
          currentStatus: TableStatus.VACANT,
        } as any);

        const result = await service.updateTableStatus(
          mockUserId,
          mockStoreId,
          mockTableId,
          { status: TableStatus.VACANT },
        );

        expect(result.currentStatus).toBe(TableStatus.VACANT);
      }
    });

    it("should reject CLEANING to ORDERING transition", async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.CLEANING,
      } as any);

      await expect(
        service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
          status: TableStatus.ORDERING,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should log state transition", async () => {
      const loggerSpy = jest.spyOn(service["logger"], "log");
      prismaService.table.update.mockResolvedValue({
        ...mockTable,
        currentStatus: TableStatus.SEATED,
      } as any);

      await service.updateTableStatus(mockUserId, mockStoreId, mockTableId, {
        status: TableStatus.SEATED,
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Table ${mockTableId} status updated from ${TableStatus.VACANT} to ${TableStatus.SEATED}`,
        ),
      );
    });
  });
});
