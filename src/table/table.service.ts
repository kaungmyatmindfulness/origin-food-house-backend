import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException, // Keep for re-throwing truly unexpected errors
  Logger,
} from '@nestjs/common';
import { Role, Table, Prisma } from '@prisma/client';

import { StandardErrorHandler } from 'src/common/decorators/standard-error-handler.decorator';

import { AuthService } from '../auth/auth.service'; // Assuming AuthService provides checkStorePermission
import { PrismaService } from '../prisma/prisma.service';
import { BatchUpsertTableDto } from './dto/batch-upsert-table.dto'; // Use correct DTO
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

/**
 * Natural sort comparator function for strings containing numbers.
 * Handles cases like "T-1", "T-2", "T-10".
 */
function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = [],
    bx: (string | number)[] = [];
  const regex = /(\d+)|(\D+)/g;

  // Use matchAll to iterate through matches and populate arrays correctly
  for (const match of a.matchAll(regex)) {
    ax.push(match[1] ? parseInt(match[1], 10) : match[2]);
  }
  for (const match of b.matchAll(regex)) {
    bx.push(match[1] ? parseInt(match[1], 10) : match[2]);
  }

  let idx = 0;
  // Compare segments pairwise
  while (idx < ax.length && idx < bx.length) {
    const an = ax[idx];
    const bn = bx[idx];

    // If segments differ and are of different types (number vs string), number comes first
    if (typeof an !== typeof bn) {
      return typeof an === 'number' ? -1 : 1;
    }

    // If segments are of the same type, compare them
    if (typeof an === 'number') {
      // Both are numbers
      // Type assertion needed here as TS might not narrow bn correctly inside loop
      if (an !== (bn as number)) {
        return an - (bn as number);
      }
    } else {
      // Both are strings
      // Type assertion needed here as TS might not narrow bn correctly inside loop
      const comp = an.localeCompare(bn as string);
      if (comp !== 0) {
        return comp;
      }
    }
    idx++;
  }

  // If one string is a prefix of the other, the shorter one comes first
  return ax.length - bx.length;
}

@Injectable()
export class TableService {
  private readonly logger = new Logger(TableService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService, // Inject AuthService for permissions
  ) {}

  /** Helper: Checks for duplicate name within transaction */
  private async checkDuplicateTableName(
    tx: Prisma.TransactionClient, // Use transaction client
    storeId: string,
    name: string,
    excludeTableId?: string,
  ): Promise<void> {
    const where: Prisma.TableWhereInput = {
      storeId,
      name,
      id: excludeTableId ? { not: excludeTableId } : undefined,
    };
    const conflictingTable = await tx.table.findFirst({
      where,
      select: { id: true },
    }); // Use tx
    if (conflictingTable) {
      throw new BadRequestException(
        `Table name "${name}" conflicts with an existing table in this store.`,
      );
    }
  }

  /** Helper: Checks for active sessions on specific table IDs within transaction */
  private async checkActiveSessionsForTables(
    tx: Prisma.TransactionClient,
    tableIds: string[],
  ): Promise<void> {
    if (tableIds.length === 0) return; // No tables to check
    const activeSessionCount = await tx.activeTableSession.count({
      where: { tableId: { in: tableIds } },
    });
    if (activeSessionCount > 0) {
      // Find which tables have sessions for a more specific error (optional)
      const tablesWithSessions = await tx.table.findMany({
        where: { id: { in: tableIds }, activeSession: { isNot: null } },
        select: { name: true },
      });
      const tableNames = tablesWithSessions.map((t) => t.name).join(', ');
      throw new BadRequestException(
        `Cannot delete tables because active sessions exist for: ${tableNames}. Please close sessions first.`,
      );
    }
  }

  /** Creates a single table */
  @StandardErrorHandler('create table')
  async createTable(
    userId: string,
    storeId: string,
    dto: CreateTableDto,
  ): Promise<Table> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);
    // Use transaction for check + create consistency
    return await this.prisma.$transaction(async (tx) => {
      await this.checkDuplicateTableName(tx, storeId, dto.name);
      const newTable = await tx.table.create({
        data: { name: dto.name, storeId },
      });
      this.logger.log(
        `Table "${newTable.name}" (ID: ${newTable.id}) created in Store ${storeId}`,
      );
      return newTable;
    });
  }

  /** Finds all tables for a store, sorted naturally by name */
  async findAllByStore(storeId: string): Promise<Table[]> {
    // Public access - no auth check. Check if store exists for better 404.
    const storeExists = await this.prisma.store.count({
      where: { id: storeId },
    });
    if (storeExists === 0) {
      throw new NotFoundException(`Store with ID ${storeId} not found.`);
    }
    const tables = await this.prisma.table.findMany({
      where: { storeId },
      // Fetch potentially unsorted or rely on default DB order
    });
    // Apply natural sort
    tables.sort((a, b) => naturalCompare(a.name || '', b.name || ''));
    this.logger.log(
      `Found and sorted ${tables.length} tables for Store ${storeId}`,
    );
    return tables;
  }

  /** Finds a single table ensuring it belongs to the store */
  @StandardErrorHandler('find table')
  async findOne(storeId: string, tableId: string): Promise<Table> {
    // Use findFirstOrThrow for combined check
    const table = await this.prisma.table.findFirstOrThrow({
      where: { id: tableId, storeId },
    });
    return table;
  }

  /** Updates a single table's name */
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
    // Ensure table exists in this store (findOne handles NotFound)
    await this.findOne(storeId, tableId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check for name conflict only if name is provided in DTO
        if (dto.name) {
          await this.checkDuplicateTableName(tx, storeId, dto.name, tableId); // Exclude self
        }
        const updatedTable = await tx.table.update({
          where: { id: tableId }, // Already verified it belongs to store via findOne
          data: { name: dto.name }, // Prisma ignores undefined name
        });
        this.logger.log(
          `Table ${tableId} updated successfully by User ${userId}`,
        );
        return updatedTable;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error; // Re-throw validation error
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
        // Should be caught by findOne, but handle defensively
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

  /** Deletes a single table, checking for active sessions */
  async deleteTable(
    userId: string,
    storeId: string,
    tableId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);
    // Ensure table exists (findOne handles NotFound)
    await this.findOne(storeId, tableId);
    // Check for active session on this specific table BEFORE deleting
    await this.checkActiveSessionsForTables(this.prisma, [tableId]); // Use prisma directly for check

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
        // Should be caught by findOne, but handle defensively
        throw new NotFoundException(
          `Table with ID ${tableId} not found during delete.`,
        );
      }
      // Handle other potential errors (like unexpected FK issues if schema changes)
      this.logger.error(
        `Failed to delete table ${tableId} from Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not delete table.');
    }
  }

  /**
   * Synchronizes tables for a store: Upserts based on input, deletes others.
   */
  async syncTables(
    userId: string,
    storeId: string,
    dto: BatchUpsertTableDto,
  ): Promise<Table[]> {
    const method = this.syncTables.name;
    this.logger.log(
      `[${method}] User ${userId} syncing tables for Store ${storeId} with ${dto.tables.length} items.`,
    );
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validate input for duplicate/empty names
    const inputNames = new Map<string, number>();
    dto.tables.forEach((t, index) => {
      const name = t.name?.trim();
      if (!name)
        throw new BadRequestException(
          `Table name cannot be empty (at index ${index}).`,
        );
      inputNames.set(name, (inputNames.get(name) ?? 0) + 1);
    });
    const duplicateInputNames = [...inputNames.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
    if (duplicateInputNames.length > 0) {
      throw new BadRequestException(
        `Duplicate table names found in input list: ${duplicateInputNames.join(', ')}`,
      );
    }

    try {
      const finalTables = await this.prisma.$transaction(
        async (tx) => {
          // Get current tables
          const currentTables = await tx.table.findMany({
            where: { storeId },
            select: { id: true, name: true },
          });
          const currentTableMap = new Map(
            currentTables.map((t) => [t.id, t.name]),
          );

          const processedTableIds = new Set<string>();
          const upsertResults: Table[] = [];

          // Process creates and updates sequentially
          for (const tableDto of dto.tables) {
            const trimmedName = tableDto.name.trim();

            if (tableDto.id) {
              // --- UPDATE ---
              if (!currentTableMap.has(tableDto.id)) {
                throw new BadRequestException(
                  `Table with ID ${tableDto.id} not found in store ${storeId}.`,
                );
              }
              await this.checkDuplicateTableName(
                tx,
                storeId,
                trimmedName,
                tableDto.id,
              );
              const updatedTable = await tx.table.update({
                where: { id: tableDto.id },
                data: { name: trimmedName },
              });
              processedTableIds.add(updatedTable.id);
              upsertResults.push(updatedTable);
              this.logger.verbose(
                `[${method}] Updated table ${updatedTable.id} to name "${updatedTable.name}"`,
              );
            } else {
              // --- CREATE ---
              await this.checkDuplicateTableName(tx, storeId, trimmedName);
              const createdTable = await tx.table.create({
                data: { name: trimmedName, storeId },
              });
              processedTableIds.add(createdTable.id);
              upsertResults.push(createdTable);
              this.logger.verbose(
                `[${method}] Created table ${createdTable.id} with name "${createdTable.name}"`,
              );
            }
          } // End loop

          // Identify and delete unused tables
          const idsToDelete = currentTables
            .map((t) => t.id)
            .filter((id) => !processedTableIds.has(id));

          if (idsToDelete.length > 0) {
            this.logger.log(
              `[${method}] Identified ${idsToDelete.length} tables to delete for Store ${storeId}: [${idsToDelete.join(', ')}]`,
            );
            await this.checkActiveSessionsForTables(tx, idsToDelete); // Check sessions BEFORE deleting
            await tx.table.deleteMany({ where: { id: { in: idsToDelete } } });
            this.logger.log(
              `[${method}] Deleted ${idsToDelete.length} unused tables for Store ${storeId}.`,
            );
          }

          // Return the final state AFTER upserts and deletes
          const finalTableList = await tx.table.findMany({
            where: { storeId },
          });
          // Apply natural sort outside transaction
          finalTableList.sort((a, b) =>
            naturalCompare(a.name || '', b.name || ''),
          );
          return finalTableList;
        },
        { maxWait: 15000, timeout: 30000 },
      ); // End transaction

      this.logger.log(
        `[${method}] Successfully synchronized ${finalTables.length} tables for Store ${storeId}`,
      );
      return finalTables;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.error(
          `[${method}] Table sync failed for Store ${storeId} due to unique constraint violation.`,
          error.stack,
        );
        throw new BadRequestException(
          `A table name conflict occurred during the process.`,
        );
      }
      this.logger.error(
        `[${method}] Batch table sync failed for Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException('Could not synchronize tables.');
    }
  } // End syncTables
} // End TableService
