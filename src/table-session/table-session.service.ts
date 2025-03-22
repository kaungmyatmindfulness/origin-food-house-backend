import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TableSessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(dto: { shopId: number; tableId: number }) {
    // Check that table belongs to shop
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: dto.tableId },
    });
    if (!table) {
      throw new NotFoundException(`Table not found (id=${dto.tableId})`);
    }
    if (table.shopId !== dto.shopId) {
      throw new ForbiddenException(
        `Table does not belong to shop ${dto.shopId}`,
      );
    }
    const sessionUuid = uuidv4();
    return this.prisma.tableSession.create({
      data: {
        shopId: dto.shopId,
        tableId: dto.tableId,
        sessionUuid,
        status: 'ACTIVE',
      },
    });
  }

  async getSessionByUuid(uuid: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { sessionUuid: uuid },
      include: { order: true },
    });
    if (!session) {
      throw new NotFoundException(`Session not found (uuid=${uuid})`);
    }
    return session;
  }

  async closeSession(uuid: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { sessionUuid: uuid },
    });
    if (!session) {
      throw new NotFoundException(`Session not found (uuid=${uuid})`);
    }
    if (session.status === 'CLOSED') {
      throw new ForbiddenException('Session already closed');
    }
    return this.prisma.tableSession.update({
      where: { id: session.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
}
