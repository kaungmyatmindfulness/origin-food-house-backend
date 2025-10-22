import * as crypto from 'crypto';

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ActiveTableSession, SessionStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { JoinSessionDto } from './dto/join-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class ActiveTableSessionService {
  private readonly logger = new Logger(ActiveTableSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
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
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to join or create session',
      );
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
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find session');
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
        throw new NotFoundException('Invalid session token');
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to find session by token`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find session');
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
          createdAt: 'desc',
        },
      });

      return sessions;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to find active sessions for store ${storeId}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find active sessions');
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
        throw new InternalServerErrorException('Failed to update session');
      }

      this.logger.error(
        `[${method}] Failed to update session ${sessionId}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update session');
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
        throw new BadRequestException('Session is already closed');
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
        error.stack,
      );
      throw new InternalServerErrorException('Failed to close session');
    }
  }
}
