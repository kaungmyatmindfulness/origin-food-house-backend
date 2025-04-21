import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Role, Prisma, ActiveTableSession } from '@prisma/client';

@Injectable()
export class ActiveTableSessionService {
  private readonly logger = new Logger(ActiveTableSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.logger.log(
      'ActiveTableSessionService initialized (using shared JwtService)',
    );
  }

  /**
   * Creates a new ActiveTableSession for a table by authorized staff.
   * Enforces the one-active-session-per-table rule via unique constraint.
   * Automatically creates an associated Cart.
   */
  async createSession(
    requestingUserId: string,
    storeId: string,
    tableId: string,
  ): Promise<ActiveTableSession> {
    const method = this.createSession.name;
    this.logger.log(
      `[${method}] User ${requestingUserId} creating session for Table ${tableId} in Store ${storeId}`,
    );

    await this.authService.checkStorePermission(requestingUserId, storeId, [
      Role.OWNER,
      Role.ADMIN,
      Role.CASHIER,
      Role.SERVER,
    ]);

    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      select: { storeId: true, name: true },
    });
    if (!table || table.storeId !== storeId) {
      this.logger.warn(
        `[${method}] Table ${tableId} not found or not in store ${storeId}.`,
      );
      throw new NotFoundException(
        `Table with ID ${tableId} not found in store ${storeId}.`,
      );
    }

    try {
      const newSession = await this.prisma.activeTableSession.create({
        data: {
          tableId: tableId,
          storeId: storeId,

          cart: { create: {} },
        },
      });

      this.logger.log(
        `[${method}] Created ActiveTableSession ${newSession.id} for Table ${tableId} ("${table.name}")`,
      );
      return newSession;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const target = (error.meta as any)?.target as string[] | undefined;
        if (target && target.includes('tableId')) {
          this.logger.warn(
            `[${method}] Failed to create session for Table ${tableId}: Table already occupied.`,
          );
          throw new BadRequestException(
            `Table "${table.name}" is already occupied.`,
          );
        } else {
          this.logger.error(
            `[${method}] Unique constraint violation during session creation for Table ${tableId}. Target: ${target?.join(',')}`,
            error.stack,
          );
          throw new InternalServerErrorException(
            'Could not start session due to a conflict.',
          );
        }
      }
      this.logger.error(
        `[${method}] Failed to create session for Table ${tableId}`,
        error,
      );
      throw new InternalServerErrorException('Could not start table session.');
    }
  }

  /**
   * Finds the ActiveTableSession by Table ID and generates a session JWT
   * containing the ActiveTableSession ID as the 'sub' claim.
   * @param tableId The ID of the table the customer wants to join.
   * @returns Object containing the JWT string and the ActiveTableSession data.
   */
  async joinSessionByTable(
    tableId: string,
  ): Promise<{ token: string; session: ActiveTableSession }> {
    const method = this.joinSessionByTable.name;
    this.logger.log(
      `[${method}] Customer attempting to join session for Table ID ${tableId}`,
    );

    const activeSession = await this.prisma.activeTableSession.findUnique({
      where: { tableId: tableId },
    });

    if (!activeSession) {
      this.logger.warn(
        `[${method}] Active session for Table ID ${tableId} not found.`,
      );

      const table = await this.prisma.table.findUnique({
        where: { id: tableId },
        select: { name: true },
      });
      throw new NotFoundException(
        `Table "${table?.name || tableId}" is not currently active or does not exist.`,
      );
    }

    const payload = { sub: activeSession.id };

    try {
      const token = await this.jwtService.signAsync(payload);
      this.logger.log(
        `[${method}] Generated session token for Session ID ${activeSession.id} (Table ID: ${tableId})`,
      );
      return { token, session: activeSession };
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to sign session token for Session ID ${activeSession.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not generate session token.',
      );
    }
  }

  /**
   * Finds an active session by its primary key ID.
   */
  async findActiveSessionById(
    sessionId: string,
  ): Promise<ActiveTableSession | null> {
    this.logger.debug(`Finding active session by ID: ${sessionId}`);
    return this.prisma.activeTableSession.findUnique({
      where: { id: sessionId },
    });
  }

  /**
   * Deletes an ActiveTableSession and its cascaded dependents.
   */
  async deleteSession(
    sessionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prismaClient = tx || this.prisma;
    const method = this.deleteSession.name;
    this.logger.log(`[${method}] Deleting ActiveTableSession ID: ${sessionId}`);
    try {
      await prismaClient.activeTableSession.delete({
        where: { id: sessionId },
      });
      this.logger.log(
        `[${method}] Successfully deleted ActiveTableSession ID: ${sessionId}`,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(
          `[${method}] Attempted to delete non-existent ActiveTableSession ID: ${sessionId}. Ignoring.`,
        );
      } else {
        this.logger.error(
          `[${method}] Failed to delete ActiveTableSession ID ${sessionId}`,
          error,
        );
        throw new InternalServerErrorException('Could not delete session.');
      }
    }
  }
}
