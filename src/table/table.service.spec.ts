import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TableService } from './table.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Role, Prisma } from '@prisma/client';
import {
  createPrismaMock,
  PrismaMock,
} from '../common/testing/prisma-mock.helper';

describe('TableService', () => {
  let service: TableService;
  let prismaService: PrismaMock;
  let authService: jest.Mocked<AuthService>;

  const mockUserId = 'user-123';
  const mockStoreId = 'store-123';
  const mockTableId = 'table-123';

  const mockTable = {
    id: mockTableId,
    storeId: mockStoreId,
    name: 'Table 1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransaction = {
    table: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    activeTableSession: {
      count: jest.fn(),
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
      ],
    }).compile();

    service = module.get<TableService>(TableService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTable', () => {
    const createDto = { name: 'Table 5' };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should create table successfully', async () => {
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
    });

    it('should throw BadRequestException if table name already exists', async () => {
      mockTransaction.table.findFirst.mockResolvedValue(mockTable as any);

      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow('conflicts with an existing table');
    });

    it('should check permissions before creating', async () => {
      authService.checkStorePermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(
        service.createTable(mockUserId, mockStoreId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByStore', () => {
    it('should return all tables sorted naturally', async () => {
      const mockTables = [
        { ...mockTable, name: 'T-10' },
        { ...mockTable, name: 'T-2' },
        { ...mockTable, name: 'T-1' },
      ];
      prismaService.store.count.mockResolvedValue(1);
      prismaService.table.findMany.mockResolvedValue(mockTables as any);

      const result = await service.findAllByStore(mockStoreId);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('T-1');
      expect(result[1].name).toBe('T-2');
      expect(result[2].name).toBe('T-10');
    });

    it('should throw NotFoundException if store not found', async () => {
      prismaService.store.count.mockResolvedValue(0);

      await expect(service.findAllByStore(mockStoreId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array if no tables exist', async () => {
      prismaService.store.count.mockResolvedValue(1);
      prismaService.table.findMany.mockResolvedValue([]);

      const result = await service.findAllByStore(mockStoreId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return table if it belongs to store', async () => {
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);

      const result = await service.findOne(mockStoreId, mockTableId);

      expect(result).toEqual(mockTable);
      expect(prismaService.table.findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: mockTableId, storeId: mockStoreId },
      });
    });

    it('should throw NotFoundException if table not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.0.0',
        },
      );
      prismaService.table.findFirstOrThrow.mockRejectedValue(prismaError);

      // StandardErrorHandler converts P2025 to InternalServerErrorException
      await expect(service.findOne(mockStoreId, mockTableId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateTable', () => {
    const updateDto = { name: 'Updated Table' };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should update table name successfully', async () => {
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
    });

    it('should throw BadRequestException if name conflicts with another table', async () => {
      mockTransaction.table.findFirst.mockResolvedValue({
        id: 'other-table',
        name: updateDto.name,
      } as any);

      await expect(
        service.updateTable(mockUserId, mockStoreId, mockTableId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteTable', () => {
    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.table.findFirstOrThrow.mockResolvedValue(mockTable as any);
      prismaService.activeTableSession.count.mockResolvedValue(0);
    });

    it('should delete table successfully when no active session', async () => {
      prismaService.table.delete.mockResolvedValue(mockTable as any);

      const result = await service.deleteTable(
        mockUserId,
        mockStoreId,
        mockTableId,
      );

      expect(result).toEqual({ id: mockTableId, deleted: true });
      expect(prismaService.table.delete).toHaveBeenCalledWith({
        where: { id: mockTableId },
      });
    });

    it('should throw BadRequestException if table has active session', async () => {
      prismaService.activeTableSession.count.mockResolvedValue(1);
      prismaService.table.findMany.mockResolvedValue([
        { name: 'Table 1' },
      ] as any);

      await expect(
        service.deleteTable(mockUserId, mockStoreId, mockTableId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deleteTable(mockUserId, mockStoreId, mockTableId),
      ).rejects.toThrow('active sessions exist');
    });
  });

  describe('syncTables', () => {
    const syncDto = {
      tables: [
        { id: 'table-1', name: 'T-1' },
        { name: 'T-2' }, // New table without ID
      ],
    };

    beforeEach(() => {
      authService.checkStorePermission.mockResolvedValue(undefined);
      prismaService.$transaction.mockImplementation((callback: any) =>
        callback(mockTransaction as any),
      );
    });

    it('should sync tables successfully', async () => {
      const currentTables = [
        { id: 'table-1', name: 'Old T-1' },
        { id: 'table-3', name: 'T-3' }, // Will be deleted
      ];

      mockTransaction.table.findMany.mockResolvedValueOnce(
        currentTables as any,
      );
      mockTransaction.table.findFirst.mockResolvedValue(null);
      mockTransaction.table.update.mockResolvedValue({
        id: 'table-1',
        name: 'T-1',
      } as any);
      mockTransaction.table.create.mockResolvedValue({
        id: 'table-2',
        name: 'T-2',
      } as any);
      mockTransaction.activeTableSession.count.mockResolvedValue(0);
      mockTransaction.table.deleteMany.mockResolvedValue({ count: 1 } as any);
      mockTransaction.table.findMany.mockResolvedValueOnce([
        { id: 'table-1', name: 'T-1' },
        { id: 'table-2', name: 'T-2' },
      ] as any);

      const result = await service.syncTables(mockUserId, mockStoreId, syncDto);

      expect(result).toHaveLength(2);
      expect(mockTransaction.table.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['table-3'] } },
      });
    });

    it('should throw BadRequestException for duplicate names in input', async () => {
      const duplicateDto = {
        tables: [{ name: 'T-1' }, { name: 'T-1' }],
      };

      await expect(
        service.syncTables(mockUserId, mockStoreId, duplicateDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, duplicateDto),
      ).rejects.toThrow('Duplicate table names');
    });

    it('should throw BadRequestException for empty table names', async () => {
      const emptyNameDto = {
        tables: [{ name: '' }, { name: 'T-1' }],
      };

      await expect(
        service.syncTables(mockUserId, mockStoreId, emptyNameDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, emptyNameDto),
      ).rejects.toThrow('cannot be empty');
    });

    it('should throw BadRequestException if trying to delete table with active session', async () => {
      const currentTables = [
        { id: 'table-1', name: 'T-1' },
        { id: 'table-3', name: 'T-3' }, // Has active session
      ];

      mockTransaction.table.findMany.mockResolvedValueOnce(
        currentTables as any,
      );
      mockTransaction.table.findFirst.mockResolvedValue(null);
      mockTransaction.table.update.mockResolvedValue({
        id: 'table-1',
        name: 'T-1',
      } as any);
      mockTransaction.activeTableSession.count.mockResolvedValue(1);
      mockTransaction.table.findMany.mockResolvedValueOnce([
        { id: 'table-1', name: 'T-1', activeSession: { id: 'session-123' } },
      ] as any);

      await expect(
        service.syncTables(mockUserId, mockStoreId, syncDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if updating non-existent table ID', async () => {
      const invalidDto = {
        tables: [{ id: 'non-existent-id', name: 'T-1' }],
      };
      const currentTables = [{ id: 'table-1', name: 'T-1' }];

      mockTransaction.table.findMany.mockResolvedValue(currentTables as any);

      await expect(
        service.syncTables(mockUserId, mockStoreId, invalidDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.syncTables(mockUserId, mockStoreId, invalidDto),
      ).rejects.toThrow('not found in store');
    });
  });
});
