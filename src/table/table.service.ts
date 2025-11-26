import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException, // Keep for re-throwing truly unexpected errors
  Logger,
} from "@nestjs/common";

import { StandardErrorHandler } from "src/common/decorators/standard-error-handler.decorator";
import { Role, Table, Prisma, TableStatus } from "src/generated/prisma/client";

import { AuthService } from "../auth/auth.service"; // Assuming AuthService provides checkStorePermission
import { PrismaService } from "../prisma/prisma.service";
import { TierService } from "../tier/tier.service";
import { BatchUpsertTableDto } from "./dto/batch-upsert-table.dto"; // Use correct DTO
import { CreateTableDto } from "./dto/create-table.dto";
import { UpdateTableStatusDto } from "./dto/update-table-status.dto";
import { UpdateTableDto } from "./dto/update-table.dto";
import { TableGateway } from "./table.gateway";

/**
 * Type for Prisma transaction client
 * Used in transaction callbacks to ensure type safety
 */
type TransactionClient = Prisma.TransactionClient;

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
      return typeof an === "number" ? -1 : 1;
    }

    // If segments are of the same type, compare them
    if (typeof an === "number") {
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
    private readonly tableGateway: TableGateway, // Inject TableGateway for real-time updates
    private readonly tierService: TierService, // Inject TierService for usage tracking
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
      deletedAt: null, // Only check among active tables
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

  /** Creates a single table */
  @StandardErrorHandler("create table")
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
    const newTable = await this.prisma.$transaction(async (tx) => {
      await this.checkDuplicateTableName(tx, storeId, dto.name);
      const table = await tx.table.create({
        data: { name: dto.name, storeId },
      });
      this.logger.log(
        `Table "${table.name}" (ID: ${table.id}) created in Store ${storeId}`,
      );

      // Broadcast table creation to all staff in store
      this.tableGateway.broadcastTableCreated(storeId, table);

      return table;
    });

    // Track usage after successful creation (invalidates cache)
    await this.tierService.invalidateUsageCache(storeId);

    return newTable;
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
      where: { storeId, deletedAt: null },
    });
    // Apply natural sort
    tables.sort((a, b) => naturalCompare(a.name || "", b.name || ""));
    this.logger.log(
      `Found and sorted ${tables.length} active tables for Store ${storeId}`,
    );
    return tables;
  }

  /** Finds a single active table ensuring it belongs to the store and is not deleted */
  @StandardErrorHandler("find table")
  async findOne(storeId: string, tableId: string): Promise<Table> {
    // Use findFirstOrThrow for combined check (includes soft delete filter)
    const table = await this.prisma.table.findFirstOrThrow({
      where: { id: tableId, storeId, deletedAt: null },
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

        // Broadcast table update to all staff in store
        this.tableGateway.broadcastTableUpdated(storeId, updatedTable);

        return updatedTable;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error; // Re-throw validation error
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException(
          `Table name "${dto.name}" is already taken.`,
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
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
      throw new InternalServerErrorException("Could not update table.");
    }
  }

  /**
   * Soft deletes a single table by setting deletedAt timestamp.
   * Follows CLAUDE.md Architectural Principle #4 for audit trail preservation.
   */
  async deleteTable(
    userId: string,
    storeId: string,
    tableId: string,
  ): Promise<{ id: string; deleted: boolean }> {
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);
    // Ensure table exists and is not already deleted
    await this.findOne(storeId, tableId);

    try {
      await this.prisma.table.update({
        where: { id: tableId },
        data: { deletedAt: new Date() },
      });
      this.logger.log(
        `Table ${tableId} soft deleted successfully by User ${userId}`,
      );

      // Broadcast table deletion to all staff in store
      this.tableGateway.broadcastTableDeleted(storeId, tableId);

      // Track usage after successful deletion (invalidates cache)
      await this.tierService.invalidateUsageCache(storeId);

      return { id: tableId, deleted: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `Table with ID ${tableId} not found during delete.`,
        );
      }
      this.logger.error(
        `Failed to soft delete table ${tableId} from Store ${storeId}`,
        error,
      );
      throw new InternalServerErrorException("Could not delete table.");
    }
  }

  /**
   * Synchronizes tables for a store: Upserts based on input, soft deletes others.
   * Follows CLAUDE.md Architectural Principle #4 for soft delete pattern.
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
        `Duplicate table names found in input list: ${duplicateInputNames.join(", ")}`,
      );
    }

    try {
      const finalTables = await this.prisma.$transaction(
        async (tx) => {
          // Get current active tables (not soft deleted)
          const currentTables = await tx.table.findMany({
            where: { storeId, deletedAt: null },
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

          // Identify and soft delete unused tables
          const idsToDelete = currentTables
            .map((t) => t.id)
            .filter((id) => !processedTableIds.has(id));

          if (idsToDelete.length > 0) {
            this.logger.log(
              `[${method}] Identified ${idsToDelete.length} tables to soft delete for Store ${storeId}: [${idsToDelete.join(", ")}]`,
            );
            await tx.table.updateMany({
              where: { id: { in: idsToDelete } },
              data: { deletedAt: new Date() },
            });
            this.logger.log(
              `[${method}] Soft deleted ${idsToDelete.length} unused tables for Store ${storeId}.`,
            );
          }

          // Return the final state AFTER upserts and soft deletes (only active tables)
          const finalTableList = await tx.table.findMany({
            where: { storeId, deletedAt: null },
          });
          // Apply natural sort outside transaction
          finalTableList.sort((a, b) =>
            naturalCompare(a.name || "", b.name || ""),
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
        error.code === "P2002"
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
      throw new InternalServerErrorException("Could not synchronize tables.");
    }
  } // End syncTables

  /**
   * Update table status with state transition validation
   * @param userId - User ID
   * @param storeId - Store ID
   * @param tableId - Table ID
   * @param dto - Update status DTO
   * @returns Updated table
   */
  async updateTableStatus(
    userId: string,
    storeId: string,
    tableId: string,
    dto: UpdateTableStatusDto,
  ): Promise<Table> {
    const method = this.updateTableStatus.name;
    this.logger.log(
      `[${method}] User ${userId} updating table ${tableId} status to ${dto.status}`,
    );

    // Check RBAC - only OWNER/ADMIN/SERVER can update table status
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
      Role.SERVER,
    ]);

    try {
      // Find the table to get current status
      const table = await this.findOne(storeId, tableId);

      // Validate state transition
      this.validateTableStatusTransition(table.currentStatus, dto.status);

      // Update the table status
      const updatedTable = await this.prisma.table.update({
        where: { id: tableId },
        data: { currentStatus: dto.status },
      });

      this.logger.log(
        `[${method}] Table ${tableId} status updated from ${table.currentStatus} to ${dto.status}`,
      );

      // Broadcast status update to all staff in store
      this.tableGateway.broadcastTableStatusUpdate(storeId, updatedTable);

      return updatedTable;
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
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `Table with ID ${tableId} not found during status update.`,
        );
      }

      this.logger.error(
        `[${method}] Failed to update table status for table ${tableId}`,
        error,
      );
      throw new InternalServerErrorException("Could not update table status.");
    }
  }

  /**
   * Validate table status transitions based on state machine rules
   * @private
   */
  private validateTableStatusTransition(
    currentStatus: TableStatus,
    newStatus: TableStatus,
  ): void {
    // Allow same status (idempotent operations)
    if (currentStatus === newStatus) {
      return;
    }

    // Define valid state transitions
    const validTransitions: Record<TableStatus, TableStatus[]> = {
      [TableStatus.VACANT]: [TableStatus.SEATED, TableStatus.CLEANING],
      [TableStatus.SEATED]: [
        TableStatus.ORDERING,
        TableStatus.VACANT,
        TableStatus.CLEANING,
      ],
      [TableStatus.ORDERING]: [
        TableStatus.SERVED,
        TableStatus.VACANT,
        TableStatus.CLEANING,
      ],
      [TableStatus.SERVED]: [
        TableStatus.READY_TO_PAY,
        TableStatus.ORDERING, // Allow adding more items
        TableStatus.VACANT,
        TableStatus.CLEANING,
      ],
      [TableStatus.READY_TO_PAY]: [
        TableStatus.CLEANING,
        TableStatus.VACANT,
        TableStatus.ORDERING, // Allow if payment cancelled
      ],
      [TableStatus.CLEANING]: [TableStatus.VACANT],
    };

    // Check if transition is valid
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid table status transition from ${currentStatus} to ${newStatus}. ` +
          `Valid transitions from ${currentStatus} are: ${validTransitions[currentStatus]?.join(", ") || "none"}`,
      );
    }
  }

  /**
   * ============================================================================
   * SEEDING METHODS (For Store Creation)
   * ============================================================================
   */

  /**
   * Creates default tables for store seeding.
   * This method is designed to be called within an existing transaction.
   *
   * NOTE: This method bypasses RBAC as it's used for system-level seeding
   * during store creation, not user-initiated operations.
   *
   * @param tx - Prisma transaction client
   * @param storeId - Store UUID to create tables for
   * @param tableNames - Array of table names to create
   */
  async createBulkForSeeding(
    tx: TransactionClient,
    storeId: string,
    tableNames: string[],
  ): Promise<void> {
    const method = this.createBulkForSeeding.name;
    this.logger.log(
      `[${method}] Creating ${tableNames.length} tables for Store ${storeId}`,
    );

    const tableData = tableNames.map((name) => ({
      name,
      storeId,
      currentStatus: "VACANT" as const,
      deletedAt: null,
    }));

    await tx.table.createMany({
      data: tableData,
    });

    this.logger.log(`[${method}] Created ${tableNames.length} default tables`);
  }
} // End TableService
