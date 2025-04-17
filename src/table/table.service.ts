import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { BatchReplaceTablesDto } from './dto/batch-replace-tables.dto';
import { Role, Table, Prisma } from '@prisma/client';

/**
 * Natural sort comparator function for strings containing numbers.
 * Handles cases like "T-1", "T-2", "T-10".
 */
function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = [],
    bx: (string | number)[] = [];
  const regex = /(\d+)|(\D+)/g;

  for (const match of a.matchAll(regex)) {
    ax.push(match[1] ? parseInt(match[1], 10) : match[2]);
  }
  for (const match of b.matchAll(regex)) {
    bx.push(match[1] ? parseInt(match[1], 10) : match[2]);
  }

  let idx = 0;

  while (idx < ax.length && idx < bx.length) {
    const an = ax[idx];
    const bn = bx[idx];

    if (typeof an !== typeof bn) {
      return typeof an === 'number' ? -1 : 1;
    }

    if (typeof an === 'number') {
      if (an !== (bn as number)) {
        return an - (bn as number);
      }
    } else {
      const comp = an.localeCompare(bn as string);
      if (comp !== 0) {
        return comp;
      }
    }
    idx++;
  }

  return ax.length - bx.length;
}

@Injectable()
export class TableService {
  private readonly logger = new Logger(TableService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** Helper to check for duplicate name during create/update */
  private async checkDuplicateTableName(
    storeId: string,
    name: string,
    excludeTableId?: string,
  ): Promise<void> {
    const where: Prisma.TableWhereInput = {
      storeId: storeId,
      name: name,
      id: excludeTableId ? { not: excludeTableId } : undefined,
    };
    const conflictingTable = await this.prisma.table.findFirst({
      where,
      select: { id: true },
    });
    if (conflictingTable) {
      throw new BadRequestException(
        `Table name "${name}" already exists in this store.`,
      );
    }
  }

  /** Helper to check for active sessions on one or more tables */
  private async checkActiveSessions(
    storeId: string,
    tableId?: string,
  ): Promise<void> {
    const where: Prisma.ActiveTableSessionWhereInput = { storeId };
    if (tableId) {
      where.tableId = tableId;
    }
    const activeSessionCount = await this.prisma.activeTableSession.count({
      where,
    });
    if (activeSessionCount > 0) {
      const scope = tableId ? `Table ${tableId}` : `Store ${storeId}`;
      throw new BadRequestException(
        `Operation cannot proceed because ${scope} has ${activeSessionCount} active session(s). Please close sessions first.`,
      );
    }
  }

  async createTable(
    userId: string,
    storeId: string,
    dto: CreateTableDto,
  ): Promise<Table> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);
    await this.checkDuplicateTableName(storeId, dto.name);

    try {
      const newTable = await this.prisma.table.create({
        data: { name: dto.name, storeId: storeId },
      });
      this.logger.log(
        `Table "${newTable.name}" (ID: ${newTable.id}) created in Store ${storeId}`,
      );
      return newTable;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Table name "${dto.name}" already exists.`,
        );
      }
      this.logger.error(
        `Failed to create table "${dto.name}" in Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not create table.');
    }
  }

  async findAllByStore(storeId: string): Promise<Table[]> {
    const storeExists = await this.prisma.store.count({
      where: { id: storeId },
    });
    if (storeExists === 0) {
      throw new NotFoundException(`Store with ID ${storeId} not found.`);
    }
    try {
      const tables = await this.prisma.table.findMany({
        where: { storeId: storeId },
      });

      tables.sort((a, b) => naturalCompare(a.name || '', b.name || ''));

      this.logger.log(
        `Found and sorted ${tables.length} tables for Store ${storeId}`,
      );
      return tables;
    } catch (error) {
      this.logger.error(`Failed to fetch tables for Store ${storeId}`, error);
      throw new InternalServerErrorException('Could not retrieve tables.');
    }
  }

  async findOne(storeId: string, tableId: string): Promise<Table> {
    try {
      const table = await this.prisma.table.findFirstOrThrow({
        where: { id: tableId, storeId: storeId },
      });
      return table;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Table with ID ${tableId} not found in store ${storeId}.`,
        );
      }
      this.logger.error(
        `Error fetching table ${tableId} for Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not retrieve table details.',
      );
    }
  }

  async updateTable(
    userId: string,
    storeId: string,
    tableId: string,
    dto: UpdateTableDto,
  ): Promise<Table> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    await this.findOne(storeId, tableId);

    if (dto.name) {
      await this.checkDuplicateTableName(storeId, dto.name, tableId);
    }

    try {
      const updatedTable = await this.prisma.table.update({
        where: { id: tableId },
        data: { name: dto.name },
      });
      this.logger.log(
        `Table ${tableId} updated successfully by User ${userId}`,
      );
      return updatedTable;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Table name "${dto.name}" is already taken.`,
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Table with ID ${tableId} not found during update.`,
        );
      }
      this.logger.error(
        `Failed to update table ${tableId} in Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not update table.');
    }
  }

  async deleteTable(
    userId: string,
    storeId: string,
    tableId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    await this.findOne(storeId, tableId);

    await this.checkActiveSessions(storeId, tableId);

    try {
      await this.prisma.table.delete({ where: { id: tableId } });
      this.logger.log(
        `Table ${tableId} deleted successfully by User ${userId}`,
      );
      return { id: tableId, deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Table with ID ${tableId} not found during delete.`,
        );
      }

      this.logger.error(
        `Failed to delete table ${tableId} from Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not delete table.');
    }
  }

  async replaceAllTables(
    userId: string,
    storeId: string,
    dto: BatchReplaceTablesDto,
  ): Promise<{ count: number }> {
    const method = this.replaceAllTables.name;
    this.logger.log(
      `[${method}] User ${userId} replacing all tables in Store ${storeId} with ${dto.tables.length} new tables.`,
    );
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const names = dto.tables.map((t) => t.name.trim()).filter((name) => name);
    const uniqueNames = new Set(names);
    if (
      names.length !== uniqueNames.size ||
      names.length !== dto.tables.length
    ) {
      throw new BadRequestException(
        'Duplicate or empty table names found in the input list.',
      );
    }

    await this.checkActiveSessions(storeId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const deleteResult = await tx.table.deleteMany({
          where: { storeId: storeId },
        });
        this.logger.log(
          `[${method}] Deleted ${deleteResult.count} existing tables for Store ${storeId}.`,
        );

        let createResult = { count: 0 };
        if (dto.tables.length > 0) {
          const createData = dto.tables.map((tableDto) => ({
            name: tableDto.name.trim(),
            storeId: storeId,
          }));
          createResult = await tx.table.createMany({ data: createData });
          this.logger.log(
            `[${method}] Created ${createResult.count} new tables for Store ${storeId}.`,
          );
        }
        return createResult;
      });
      return { count: result.count };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.error(
          `[${method}] Batch replace failed for Store ${storeId} due to unexpected unique constraint violation.`,
          error.stack,
        );
        throw new BadRequestException(
          `A table name conflict occurred during creation.`,
        );
      }
      this.logger.error(
        `[${method}] Batch replace failed for Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not replace tables.');
    }
  }
}
