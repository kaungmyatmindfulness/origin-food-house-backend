import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async initOrderForSession(tableSessionId: number) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session)
      throw new NotFoundException(`Session not found (id=${tableSessionId})`);
    if (session.status === 'CLOSED') {
      throw new ForbiddenException('Session is closed, cannot add orders');
    }
    if (session.order) return session.order;
    return this.prisma.order.create({
      data: { tableSessionId, status: 'OPEN' },
    });
  }

  async addChunk(
    tableSessionId: number,
    chunkData: {
      items: Array<{
        menuItemId: number;
        price: number;
        quantity: number;
        finalPrice?: number;
        chosenVariationId?: number;
        chosenSizeId?: number;
        chosenAddOns?: number[];
        notes?: string;
      }>;
    },
  ) {
    const order = await this.initOrderForSession(tableSessionId);
    const chunk = await this.prisma.orderChunk.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        chunkItems: {
          create: chunkData.items.map((i) => ({
            menuItemId: i.menuItemId,
            price: i.price,
            quantity: i.quantity,
            finalPrice: i.finalPrice,
            chosenVariationId: i.chosenVariationId,
            chosenSizeId: i.chosenSizeId,
            chosenAddOns: i.chosenAddOns,
            notes: i.notes,
          })),
        },
      },
      include: { chunkItems: true },
    });
    return chunk;
  }

  async updateChunkStatus(
    chunkId: number,
    newStatus: 'PENDING' | 'IN_PROGRESS' | 'DONE',
  ) {
    const chunk = await this.prisma.orderChunk.findUnique({
      where: { id: chunkId },
    });
    if (!chunk) throw new NotFoundException(`Chunk not found (id=${chunkId})`);
    return this.prisma.orderChunk.update({
      where: { id: chunkId },
      data: { status: newStatus },
      include: { chunkItems: true },
    });
  }

  async payOrder(tableSessionId: number) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session || !session.order) {
      throw new NotFoundException(
        `No order found for session (id=${tableSessionId})`,
      );
    }
    if (session.order.status === 'PAID') {
      throw new ForbiddenException('Order already paid');
    }
    const updatedOrder = await this.prisma.order.update({
      where: { id: session.order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await this.prisma.tableSession.update({
      where: { id: tableSessionId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    return updatedOrder;
  }
}
