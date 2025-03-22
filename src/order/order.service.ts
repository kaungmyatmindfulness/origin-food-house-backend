import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TableSessionStatus, OrderStatus, ChunkStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ensures exactly one Order for a given TableSession.
   * - If no order exists, create a new one with status=OPEN.
   * - If the session is closed, throw Forbidden.
   */
  async initOrderForSession(tableSessionId: number) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session) {
      throw new NotFoundException(
        `TableSession not found (id=${tableSessionId})`,
      );
    }
    if (session.status === TableSessionStatus.CLOSED) {
      throw new ForbiddenException(
        `Cannot create or modify an order on a CLOSED session`,
      );
    }

    // Return existing order if present
    if (session.order) {
      return session.order;
    }

    // Otherwise create a new order
    return this.prisma.order.create({
      data: {
        tableSessionId,
        status: OrderStatus.OPEN, // Use the enum
      },
    });
  }

  /**
   * Adds a new "chunk" (batch of items) to the single order.
   * - The chunk is created with status=PENDING (for KDS).
   * - Each item references a MenuItem, plus user-chosen details.
   */
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
    // Ensure we have an order for this session
    const order = await this.initOrderForSession(tableSessionId);

    // Create a new chunk with default status=PENDING
    const chunk = await this.prisma.orderChunk.create({
      data: {
        orderId: order.id,
        status: ChunkStatus.PENDING, // Use the enum
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

  /**
   * Updates the status of an existing chunk, e.g. "PENDING" -> "IN_PROGRESS" -> "DONE".
   */
  async updateChunkStatus(chunkId: number, newStatus: ChunkStatus) {
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
   * Pays the single order for this TableSession, then closes the session.
   * - If order already paid, throw.
   * - Else mark order=PAID, paidAt=now, session=CLOSED.
   */
  async payOrder(tableSessionId: number) {
    // find session & order
    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { order: true },
    });
    if (!session || !session.order) {
      throw new NotFoundException(
        `No order found for TableSession (id=${tableSessionId})`,
      );
    }
    if (session.order.status === OrderStatus.PAID) {
      throw new ForbiddenException(`Order already paid`);
    }

    // Mark order as paid
    const updatedOrder = await this.prisma.order.update({
      where: { id: session.order.id },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
    });

    // Also close the session
    await this.prisma.tableSession.update({
      where: { id: tableSessionId },
      data: {
        status: TableSessionStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return updatedOrder;
  }
}
