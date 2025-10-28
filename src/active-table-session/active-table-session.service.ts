import * as crypto from "crypto";

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  ActiveTableSession,
  SessionStatus,
  SessionType,
  Prisma,
  Role,
} from "@prisma/client";

import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateManualSessionDto } from "./dto/create-manual-session.dto";
import { JoinSessionDto } from "./dto/join-session.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";

@Injectable()
export class ActiveTableSessionService {
  private readonly logger = new Logger(ActiveTableSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Join or create a session for a table
   * - If active session exists, return it
   * - Otherwise, create a new session
   */
  async joinByTable(
    tableId: string,
    dto: JoinSessionDto,
  ): Promise<ActiveTableSession> {
    const method = this.joinByTable.name;

    try {
      // Check if table exists
      const table = await this.prisma.table.findUnique({
        where: { id: tableId },
      });

      if (!table) {
        throw new NotFoundException(`Table with ID ${tableId} not found`);
      }

      // Check for existing active session
      const existingSession = await this.prisma.activeTableSession.findFirst({
        where: {
          tableId,
          status: SessionStatus.ACTIVE,
        },
      });

      if (existingSession) {
        this.logger.log(
          `[${method}] Returning existing active session for table ${tableId}`,
        );
        return existingSession;
      }

      // Create new session
      const sessionToken = this.generateSessionToken();
      const guestCount = dto.guestCount ?? 1;

      const session = await this.prisma.activeTableSession.create({
        data: {
          storeId: table.storeId,
          tableId,
          sessionToken,
          guestCount,
          status: SessionStatus.ACTIVE,
        },
      });

      this.logger.log(
        `[${method}] Created new session ${session.id} for table ${tableId}`,
      );

      return session;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to join/create session for table ${tableId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to join or create session",
      );
    }
  }

  /**
   * Create manual session for staff-initiated orders (counter, phone, takeout)
   * - No table association (tableId = null)
   * - Generates secure session token
   * - Creates empty cart automatically
   * - Requires RBAC: OWNER, ADMIN, SERVER, or CASHIER
   */
  async createManualSession(
    userId: string,
    storeId: string,
    dto: CreateManualSessionDto,
  ): Promise<ActiveTableSession> {
    const method = this.createManualSession.name;

    try {
      // Validate permissions
      await this.authService.checkStorePermission(userId, storeId, [
        Role.OWNER,
        Role.ADMIN,
        Role.SERVER,
        Role.CASHIER,
      ]);

      // Validate sessionType is not TABLE
      if (dto.sessionType === SessionType.TABLE) {
        throw new BadRequestException(
          "Cannot create manual session with type TABLE. Use join-by-table endpoint instead.",
        );
      }

      // Generate session token
      const sessionToken = this.generateSessionToken();
      const guestCount = dto.guestCount ?? 1;

      this.logger.log(
        `[${method}] Creating manual ${dto.sessionType} session for store ${storeId}`,
      );

      // Create session and cart in a transaction
      const session = await this.prisma.$transaction(async (tx) => {
        // Create session without table
        const newSession = await tx.activeTableSession.create({
          data: {
            storeId,
            tableId: null, // Manual sessions have no table
            sessionType: dto.sessionType,
            sessionToken,
            guestCount,
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
            status: SessionStatus.ACTIVE,
          },
        });

        // Create empty cart for the session
        await tx.cart.create({
          data: {
            sessionId: newSession.id,
            storeId,
            subTotal: new Prisma.Decimal("0"),
          },
        });

        this.logger.log(
          `[${method}] Created manual session ${newSession.id} with cart`,
        );

        return newSession;
      });

      // Fetch session with cart included
      const sessionWithCart = await this.prisma.activeTableSession.findUnique({
        where: { id: session.id },
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

      return sessionWithCart!;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to create manual session for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to create manual session");
    }
  }

  /**
   * Get session by ID
   */
  async findOne(sessionId: string): Promise<ActiveTableSession> {
    const method = this.findOne.name;

    try {
      const session = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
        include: {
          table: true,
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

      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to find session ${sessionId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to find session");
    }
  }

  /**
   * Get session by token
   */
  async findByToken(sessionToken: string): Promise<ActiveTableSession> {
    const method = this.findByToken.name;

    try {
      const session = await this.prisma.activeTableSession.findUnique({
        where: { sessionToken },
        include: {
          table: true,
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

      if (!session) {
        throw new NotFoundException("Invalid session token");
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to find session by token`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to find session");
    }
  }

  /**
   * Get all active sessions for a store
   */
  async findActiveByStore(storeId: string): Promise<ActiveTableSession[]> {
    const method = this.findActiveByStore.name;

    try {
      const sessions = await this.prisma.activeTableSession.findMany({
        where: {
          storeId,
          status: SessionStatus.ACTIVE,
        },
        include: {
          table: true,
          cart: {
            include: {
              items: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return sessions;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to find active sessions for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to find active sessions");
    }
  }

  /**
   * Update session
   */
  async update(
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<ActiveTableSession> {
    const method = this.update.name;

    try {
      // Check if session exists
      const existingSession = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
      });

      if (!existingSession) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      // Build update data
      const updateData: Prisma.ActiveTableSessionUpdateInput = {};

      if (dto.guestCount !== undefined) {
        updateData.guestCount = dto.guestCount;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;

        // If closing session, set closedAt
        if (dto.status === SessionStatus.CLOSED) {
          updateData.closedAt = new Date();
        }
      }

      const session = await this.prisma.activeTableSession.update({
        where: { id: sessionId },
        data: updateData,
      });

      this.logger.log(`[${method}] Updated session ${sessionId}`);

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `[${method}] Prisma error updating session ${sessionId}`,
          error,
        );
        throw new InternalServerErrorException("Failed to update session");
      }

      this.logger.error(
        `[${method}] Failed to update session ${sessionId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to update session");
    }
  }

  /**
   * Close session
   */
  async close(sessionId: string): Promise<ActiveTableSession> {
    const method = this.close.name;

    try {
      const session = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      if (session.status === SessionStatus.CLOSED) {
        throw new BadRequestException("Session is already closed");
      }

      const updatedSession = await this.prisma.activeTableSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      this.logger.log(`[${method}] Closed session ${sessionId}`);

      return updatedSession;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to close session ${sessionId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to close session");
    }
  }
}
