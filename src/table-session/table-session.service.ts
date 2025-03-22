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

  async createSession(shopId: number, tableId: number) {
    // check that the table belongs to this shop
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });
    if (!table) {
      throw new NotFoundException(`Table not found (id=${tableId})`);
    }
    if (table.shopId !== shopId) {
      throw new ForbiddenException(
        `This table does not belong to shopId=${shopId}`,
      );
    }
    // create
    const sessionUuid = uuidv4();
    return this.prisma.tableSession.create({
      data: {
        shopId,
        tableId,
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
      throw new NotFoundException(`No session found for uuid=${uuid}`);
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
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }
}
