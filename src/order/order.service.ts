// src/order/order.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ensures the table session (in a certain shop) has exactly one order.
   * If not exist, create it. If session is closed, no new order is possible.
   */
  async initOrderForSession(tableSessionId: number) {
    // check session
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session) {
      throw new NotFoundException(`Session not found (id=${tableSessionId})`);
    }
    if (session.status === 'closed') {
      throw new ForbiddenException(
        'Session is closed, cannot create or modify order',
      );
    }

    if (session.order) {
      return session.order;
    }
    // create new
    const order = await this.prisma.order.create({
      data: {
        tableSessionId,
        status: 'open',
      },
    });
    return order;
  }

  /**
   * Add a chunk to the single order in this session.
   */
  async addChunk(
    tableSessionId: number,
    chunkData: {
      items: Array<{
        menuItemId: number;
        price: number;
        quantity: number;
        finalPrice?: number;
        variant?: any;
        size?: any;
        addOns?: any;
        notes?: string;
      }>;
    },
  ) {
    const order = await this.initOrderForSession(tableSessionId);

    // create chunk in "pending" status
    const chunk = await this.prisma.orderChunk.create({
      data: {
        orderId: order.id,
        status: 'pending',
        chunkItems: {
          create: chunkData.items.map((i) => ({
            menuItemId: i.menuItemId,
            price: i.price,
            quantity: i.quantity,
            finalPrice: i.finalPrice,
            variant: i.variant,
            size: i.size,
            addOns: i.addOns,
            notes: i.notes,
          })),
        },
      },
      include: { chunkItems: true },
    });
    return chunk;
  }

  /**
   * Update chunk status for KDS usage
   */
  async updateChunkStatus(chunkId: number, newStatus: string) {
    const chunk = await this.prisma.orderChunk.findUnique({
      where: { id: chunkId },
    });
    if (!chunk) {
      throw new NotFoundException(`Order chunk not found (id=${chunkId})`);
    }

    return this.prisma.orderChunk.update({
      where: { id: chunkId },
      data: { status: newStatus },
      include: { chunkItems: true },
    });
  }

  /**
   * Pay the order & auto-close the table session
   */
  async payOrder(tableSessionId: number) {
    // find session & order
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session || !session.order) {
      throw new NotFoundException(
        `No order found for sessionId=${tableSessionId}`,
      );
    }
    if (session.order.status === 'paid') {
      throw new ForbiddenException('Order already paid');
    }

    // mark order as paid
    const updatedOrder = await this.prisma.order.update({
      where: { id: session.order.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    // close session
    await this.prisma.tableSession.update({
      where: { id: tableSessionId },
      data: { status: 'closed', closedAt: new Date() },
    });

    return updatedOrder;
  }
}
