// src/order/order.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderChunkDto } from './dto/create-order-chunk.dto'; // Import new DTO
import { ChunkStatus, OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // Include clause for Order Chunks
  private readonly chunkInclude = {
    chunkItems: {
      include: {
        menuItem: {
          // Include menu item name for context
          select: { id: true, name: true },
        },
        customizations: {
          // Include selected customizations
          include: {
            customizationOption: {
              // Include option details
              select: {
                id: true,
                name: true,
                additionalPrice: true,
                customizationGroupId: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.OrderChunkInclude;

  // Include clause for Orders
  private readonly orderInclude = {
    chunks: {
      include: this.chunkInclude, // Reuse chunk include
      orderBy: { createdAt: 'asc' },
    },
    tableSession: {
      // Include session info
      select: { id: true, sessionUuid: true, status: true },
    },
  } satisfies Prisma.OrderInclude;

  async initOrderForSession(
    tableSessionId: number,
    tx: Prisma.TransactionClient,
  ) {
    // Changed to accept transaction client 'tx'
    const session = await tx.tableSession.findUnique({
      where: { id: tableSessionId },
      include: { orders: { take: 1 } }, // Fetch only one order if exists
    });

    if (!session) {
      throw new NotFoundException(`Session not found (id=${tableSessionId})`);
    }
    if (session.status === 'CLOSED') {
      throw new ForbiddenException(
        `Session (id=${tableSessionId}) is closed, cannot add orders`,
      );
    }

    // Check if an OPEN order already exists for this session
    const existingOpenOrder = await tx.order.findFirst({
      where: {
        tableSessionId: tableSessionId,
        status: OrderStatus.OPEN,
      },
    });

    if (existingOpenOrder) {
      return existingOpenOrder;
    }

    // If no open order exists, create one
    return tx.order.create({
      data: { tableSessionId, status: OrderStatus.OPEN },
    });
  }

  async addChunk(
    tableSessionId: number,
    createOrderChunkDto: CreateOrderChunkDto, // Use the new DTO
  ) {
    if (!createOrderChunkDto.items || createOrderChunkDto.items.length === 0) {
      throw new BadRequestException(
        'Order chunk must contain at least one item.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.initOrderForSession(tableSessionId, tx);

        // Prepare data for creating chunk items and their customizations
        const chunkItemsData = [];

        for (const itemDto of createOrderChunkDto.items) {
          // 1. Fetch MenuItem details (ensure it exists and get base price)
          const menuItem = await tx.menuItem.findUnique({
            where: { id: itemDto.menuItemId },
            select: {
              id: true,
              basePrice: true,
              customizationGroups: {
                // Fetch groups and options for validation
                include: {
                  customizationOptions: {
                    select: { id: true, additionalPrice: true },
                  },
                },
              },
            },
          });

          if (!menuItem) {
            throw new NotFoundException(
              `MenuItem with ID ${itemDto.menuItemId} not found.`,
            );
          }
          const basePrice = menuItem.basePrice ?? new Decimal(0); // Handle null basePrice

          let totalCustomizationPrice = new Decimal(0);
          const customizationCreates: Prisma.OrderChunkItemCustomizationCreateWithoutOrderChunkItemInput[] =
            [];

          // Validate and prepare customization data
          const validOptionIds = new Set(
            menuItem.customizationGroups.flatMap((g) =>
              g.customizationOptions.map((o) => o.id),
            ),
          );

          for (const custDto of itemDto.customizations) {
            // Find the specific option details within the fetched menu item data
            let optionDetails:
              | { id: number; additionalPrice: Decimal | null }
              | undefined;
            menuItem.customizationGroups.forEach((g) => {
              const found = g.customizationOptions.find(
                (o) => o.id === custDto.optionId,
              );
              if (found) {
                optionDetails = {
                  id: found.id,
                  additionalPrice: found.additionalPrice,
                };
              }
            });

            if (!optionDetails) {
              throw new BadRequestException(
                `Customization Option ID ${custDto.optionId} is not valid for MenuItem ID ${itemDto.menuItemId}.`,
              );
            }

            // Check if option ID is valid for this menu item (prevent ordering options from other items)
            if (!validOptionIds.has(custDto.optionId)) {
              throw new BadRequestException(
                `Customization Option ID ${custDto.optionId} does not belong to MenuItem ID ${itemDto.menuItemId}.`,
              );
            }

            const additionalPrice =
              optionDetails.additionalPrice ?? new Decimal(0);
            const customizationQuantity = 1; // Assuming quantity 1 for now based on DTO
            const customizationFinalPrice = additionalPrice.mul(
              customizationQuantity,
            );
            totalCustomizationPrice = totalCustomizationPrice.add(
              customizationFinalPrice,
            );

            customizationCreates.push({
              customizationOption: { connect: { id: custDto.optionId } },
              quantity: customizationQuantity, // Use DTO quantity if added later
              finalPrice: customizationFinalPrice, // Store price contribution of this option
              // customizationGroupId can be inferred via option, but Prisma might require it if relation is mandatory
            });
          }

          // Calculate final price for the OrderChunkItem
          const itemBaseTotal = basePrice.mul(itemDto.quantity);
          const finalPrice = itemBaseTotal.add(totalCustomizationPrice);

          chunkItemsData.push({
            menuItem: { connect: { id: itemDto.menuItemId } },
            price: basePrice, // Store base price at time of order
            quantity: itemDto.quantity,
            finalPrice: finalPrice, // Store calculated final price
            notes: itemDto.notes,
            customizations: {
              create: customizationCreates,
            },
          });
        } // End loop through items

        // 3. Create the OrderChunk with nested OrderChunkItems
        const chunk = await tx.orderChunk.create({
          data: {
            orderId: order.id,
            status: ChunkStatus.PENDING,
            chunkItems: {
              create: chunkItemsData, // Use prepared data
            },
          },
          include: this.chunkInclude, // Use defined include
        });

        return chunk;
      },
      {
        maxWait: 10000, // 10 seconds
        timeout: 20000, // 20 seconds
      },
    ); // End transaction
  } // End addChunk

  async updateChunkStatus(
    chunkId: number,
    newStatus: ChunkStatus, // Use the Prisma enum
  ) {
    // Check if chunk exists first
    const existingChunk = await this.prisma.orderChunk.findUnique({
      where: { id: chunkId },
    });
    if (!existingChunk) {
      throw new NotFoundException(`Order Chunk with ID ${chunkId} not found`);
    }

    // Prevent illegal status transitions if necessary (e.g., cannot go back from COMPLETED)
    if (
      existingChunk.status === ChunkStatus.COMPLETED &&
      newStatus !== ChunkStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot change status from COMPLETED for chunk ID ${chunkId}`,
      );
    }

    return this.prisma.orderChunk.update({
      where: { id: chunkId },
      data: { status: newStatus },
      include: this.chunkInclude, // Use defined include
    });
  }

  async payOrder(tableSessionId: number) {
    // Use transaction for atomicity (update order and session)
    return this.prisma.$transaction(async (tx) => {
      // Find the OPEN order for the session
      const order = await tx.order.findFirst({
        where: {
          tableSessionId: tableSessionId,
          status: OrderStatus.OPEN,
        },
        include: { tableSession: true }, // Include session to check its status
      });

      if (!order) {
        throw new NotFoundException(
          `No open order found for session (id=${tableSessionId})`,
        );
      }
      if (!order.tableSession) {
        // Should not happen due to schema relations, but good practice to check
        throw new InternalServerErrorException(
          `TableSession relation missing for Order ID ${order.id}`,
        );
      }
      if (order.tableSession.status === 'CLOSED') {
        // Order might still be OPEN if session was closed abnormally
        throw new ForbiddenException(
          `Session (id=${tableSessionId}) is already closed.`,
        );
      }
      // Order status check is implicit in the query (status: OPEN)

      // Update Order status
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paidAt: new Date() },
        include: this.orderInclude, // Return the full order details
      });

      // Update Session status
      await tx.tableSession.update({
        where: { id: tableSessionId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      return updatedOrder; // Return the updated order with its details
    });
  }
}
