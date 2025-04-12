import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderChunkDto } from './dto/create-order-chunk.dto';
import {
  ChunkStatus,
  OrderStatus,
  Prisma,
  Role,
  TableSessionStatus,
} from '@prisma/client'; // Import Role
import { Decimal } from '@prisma/client/runtime/library';

// Define Prisma Payload Types for consistency (Optional but good practice)
const orderChunkItemWithDetails =
  Prisma.validator<Prisma.OrderChunkItemInclude>()({
    menuItem: { select: { id: true, name: true } }, // Select needed fields
    customizations: {
      include: {
        customizationOption: {
          select: {
            id: true,
            name: true,
            additionalPrice: true,
            customizationGroupId: true,
          },
        },
      },
    },
  });
type OrderChunkItemWithDetailsPayload = Prisma.OrderChunkItemGetPayload<{
  include: typeof orderChunkItemWithDetails;
}>;

const chunkWithDetailsInclude = Prisma.validator<Prisma.OrderChunkInclude>()({
  chunkItems: {
    include: orderChunkItemWithDetails, // Reuse item include
    orderBy: { createdAt: 'asc' }, // Order items by creation time
  },
} satisfies Prisma.OrderChunkInclude); // Use satisfies for better type checking
type ChunkWithDetailsPayload = Prisma.OrderChunkGetPayload<{
  include: typeof chunkWithDetailsInclude;
}>;

const orderWithDetailsInclude = Prisma.validator<Prisma.OrderInclude>()({
  chunks: {
    include: chunkWithDetailsInclude, // Reuse chunk include
    orderBy: { createdAt: 'asc' }, // Order chunks by creation time
  },
  tableSession: {
    select: {
      id: true,
      sessionUuid: true,
      status: true,
      storeId: true, // Include storeId
      store: { include: { setting: true } }, // Include settings needed for calculation
    },
  },
} satisfies Prisma.OrderInclude);
type OrderWithDetailsPayload = Prisma.OrderGetPayload<{
  include: typeof orderWithDetailsInclude;
}>;

const menuItemWithCustomizationsSelect =
  Prisma.validator<Prisma.MenuItemSelect>()({
    id: true,
    basePrice: true,
    storeId: true, // Needed for context/validation potentially
    customizationGroups: {
      // where: { isActive: true }, // Example: filter groups if needed
      include: {
        customizationOptions: {
          // where: { isAvailable: true }, // Example: filter options if needed
          select: { id: true, additionalPrice: true, name: true }, // Select needed fields
        },
      },
    },
  });

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Finds the active OPEN order for a session, or creates one if none exists.
   * MUST be called within a transaction.
   * @param tableSessionId UUID of the table session.
   * @param tx Prisma Transaction Client.
   * @returns The active OPEN Order.
   */
  private async findOrCreateOpenOrder(
    tableSessionId: string,
    tx: Prisma.TransactionClient, // Renamed for clarity
  ) {
    const method = this.findOrCreateOpenOrder.name; // Use method name for logging
    this.logger.verbose(
      `[${method}] Finding or creating open order for session ${tableSessionId}`,
    );

    const session = await tx.tableSession.findUnique({
      where: { id: tableSessionId },
      select: { id: true, status: true }, // Select only necessary fields
    });

    if (!session) {
      this.logger.warn(`[${method}] Session not found (id=${tableSessionId})`);
      throw new NotFoundException(`Session not found (id=${tableSessionId})`);
    }
    if (session.status === 'CLOSED') {
      this.logger.warn(`[${method}] Session (id=${tableSessionId}) is closed`);
      throw new ForbiddenException(
        `Session (id=${tableSessionId}) is closed, cannot modify order.`,
      );
    }

    // Find existing OPEN order first
    const existingOpenOrder = await tx.order.findFirst({
      where: {
        tableSessionId: tableSessionId,
        status: OrderStatus.OPEN,
      },
    });

    if (existingOpenOrder) {
      this.logger.verbose(
        `[${method}] Found existing open order ${existingOpenOrder.id} for session ${tableSessionId}`,
      );
      return existingOpenOrder;
    }

    // If no open order exists, create one with default totals
    this.logger.log(
      `[${method}] No open order found for session ${tableSessionId}, creating new one.`,
    );
    const newOrder = await tx.order.create({
      data: {
        tableSessionId,
        status: OrderStatus.OPEN,
        // Totals default to 0 based on schema definition
      },
    });
    this.logger.log(
      `[${method}] Created new open order ${newOrder.id} for session ${tableSessionId}`,
    );
    return newOrder;
  }

  /**
   * Adds a chunk of items to the current open order for a table session.
   * Calculates item prices based on menu item and selected options.
   * Recalculates and updates the Order totals within the transaction.
   */
  async addChunk(
    tableSessionId: string,
    createOrderChunkDto: CreateOrderChunkDto,
  ): Promise<ChunkWithDetailsPayload> {
    // Return detailed chunk
    const method = this.addChunk.name;
    this.logger.log(
      `[${method}] Attempting to add chunk to session ${tableSessionId}`,
    );
    // DTO validation handles empty items array via ArrayMinSize

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await this.findOrCreateOpenOrder(tableSessionId, tx);
          this.logger.verbose(`[${method}] Using Order ID: ${order.id}`);

          // Prepare data for nested 'create' within chunkItems
          // Each element matches Prisma.OrderChunkItemCreateWithoutOrderChunkInput
          const chunkItemsCreateData: Prisma.OrderChunkItemCreateWithoutOrderChunkInput[] =
            [];

          for (const itemDto of createOrderChunkDto.items) {
            this.logger.debug(
              `[${method}] Processing item DTO: ${JSON.stringify(itemDto)}`,
            );
            // 1. Fetch MenuItem with necessary details for validation/pricing
            const menuItem = await tx.menuItem.findUnique({
              where: {
                id: itemDto.menuItemId,
                deletedAt: null, // Ensure item is active
                isHidden: false, // Ensure item is visible
              },
              select: menuItemWithCustomizationsSelect, // Use defined select
            });

            if (!menuItem) {
              throw new NotFoundException(
                `Available MenuItem with ID ${itemDto.menuItemId} not found.`,
              );
            }

            // Optional: Add check if menuItem.storeId matches session's storeId

            const basePrice = menuItem.basePrice ?? new Prisma.Decimal(0);
            let totalCustomizationPrice = new Prisma.Decimal(0);
            const customizationCreatesData: Prisma.OrderChunkItemCustomizationCreateWithoutOrderChunkItemInput[] =
              [];

            // Map valid options for quick lookup
            const validOptionsMap = new Map<
              string,
              { additionalPrice: Prisma.Decimal | null }
            >();
            menuItem.customizationGroups.forEach((g) =>
              g.customizationOptions.forEach((o) =>
                validOptionsMap.set(o.id, {
                  additionalPrice: o.additionalPrice,
                }),
              ),
            );

            // Validate and prepare selected customizations
            if (itemDto.customizationOptionIds?.length) {
              for (const optionId of itemDto.customizationOptionIds) {
                const optionDetails = validOptionsMap.get(optionId);
                if (!optionDetails) {
                  this.logger.warn(
                    `Invalid CustomizationOption ID ${optionId} provided for MenuItem ${menuItem.id}`,
                  );
                  throw new BadRequestException(
                    `Customization Option ID ${optionId} is not valid for MenuItem ID ${menuItem.id}.`,
                  );
                }

                const additionalPrice =
                  optionDetails.additionalPrice ?? new Prisma.Decimal(0);
                const customizationQuantity = 1; // Assuming quantity 1 for options
                const customizationFinalPrice = additionalPrice.times(
                  customizationQuantity,
                );
                totalCustomizationPrice = totalCustomizationPrice.plus(
                  customizationFinalPrice,
                );

                customizationCreatesData.push({
                  customizationOption: { connect: { id: optionId } }, // Link to existing option
                  quantity: customizationQuantity,
                  finalPrice: customizationFinalPrice,
                });
              }
              // TODO: Validate min/max selectable customization options per group
            }

            // Calculate final price for this item (base + options) * quantity
            const singleItemPrice = basePrice.plus(totalCustomizationPrice);
            const finalPrice = singleItemPrice.times(itemDto.quantity);

            // Add prepared data for this item to the array for the nested 'create'
            chunkItemsCreateData.push({
              // Connect to existing MenuItem using its ID
              menuItem: { connect: { id: itemDto.menuItemId } },
              price: basePrice, // Store base price snapshot
              quantity: itemDto.quantity,
              finalPrice: finalPrice, // Store calculated final price
              notes: itemDto.notes,
              // Use nested 'create' for customizations associated with this item
              customizations: {
                create: customizationCreatesData,
              },
            });
          } // End loop through item DTOs

          // 3. Create the OrderChunk with nested OrderChunkItems using 'create' (not 'createMany')
          this.logger.verbose(
            `[${method}] Creating OrderChunk for Order ${order.id} with ${chunkItemsCreateData.length} item types.`,
          );
          const createdChunk = await tx.orderChunk.create({
            data: {
              orderId: order.id,
              status: ChunkStatus.PENDING, // Default status
              chunkItems: {
                create: chunkItemsCreateData, // <-- Use 'create' with array of item data including nested customizations
              },
            },
            include: chunkWithDetailsInclude, // Include details for the return value
          });
          this.logger.verbose(
            `[${method}] Created chunk ${createdChunk.id} with items.`,
          );

          // 4. Recalculate and Update Order Totals
          this.logger.verbose(
            `[${method}] Recalculating totals for Order ID: ${order.id}`,
          );
          await this._calculateAndUpdateOrderTotals(order.id, tx);

          return createdChunk; // Return the newly created chunk with details
        },
        { maxWait: 10000, timeout: 20000 },
      ); // End transaction
    } catch (error) {
      // Handle specific errors like NotFound, BadRequest from validation/logic
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(
        `[${method}] Failed to add chunk to session ${tableSessionId}`,
        error,
      );
      throw new InternalServerErrorException('Could not add items to order.');
    }
  }

  /**
   * Updates the status of a specific order chunk.
   */
  async updateChunkStatus(
    chunkId: string,
    newStatus: ChunkStatus,
    // TODO: Add userId/storeId for permission checks if needed
  ): Promise<ChunkWithDetailsPayload> {
    // Return detailed chunk
    const method = this.updateChunkStatus.name;
    this.logger.log(
      `[${method}] Attempting to update status of chunk ${chunkId} to ${newStatus}`,
    );

    // TODO: Add permission check: Does user have permission (e.g., CHEF role) for the store this chunk belongs to?
    // Requires fetching chunk with nested order -> session -> store or similar relation.

    try {
      const existingChunk = await this.prisma.orderChunk.findUnique({
        where: { id: chunkId },
        select: { status: true }, // Select only status needed for check
      });
      if (!existingChunk) {
        throw new NotFoundException(`Order Chunk with ID ${chunkId} not found`);
      }

      // Prevent illegal status transitions (example)
      if (
        existingChunk.status === ChunkStatus.COMPLETED &&
        newStatus !== ChunkStatus.COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot change status from COMPLETED for chunk ID ${chunkId}`,
        );
      }
      if (existingChunk.status === newStatus) {
        this.logger.log(
          `[${method}] Chunk ${chunkId} already has status ${newStatus}. No update needed.`,
        );
        // Fetch and return current state if needed, or just return it simply
        return this.prisma.orderChunk.findUniqueOrThrow({
          where: { id: chunkId },
          include: chunkWithDetailsInclude,
        });
      }

      const updatedChunk = await this.prisma.orderChunk.update({
        where: { id: chunkId },
        data: { status: newStatus },
        include: chunkWithDetailsInclude,
      });
      this.logger.log(
        `[${method}] Updated status of chunk ${chunkId} to ${newStatus}`,
      );
      return updatedChunk;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `[${method}] Failed to update status for chunk ${chunkId}`,
        error,
      );
      throw new InternalServerErrorException('Could not update chunk status.');
    }
  }

  /**
   * Marks an OPEN order as PAID and closes the associated table session.
   * Recalculates final totals before marking as paid.
   */
  async payOrder(
    tableSessionId: string,
    // TODO: Add userId for permission checks if needed
  ): Promise<OrderWithDetailsPayload> {
    // Return detailed order
    const method = this.payOrder.name;
    this.logger.log(
      `[${method}] Attempting to pay order and close session ${tableSessionId}`,
    );

    // TODO: Add permission check: Does user have permission (e.g., CASHIER role) for the store this session belongs to?

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Find the OPEN order for the session
        const order = await tx.order.findFirst({
          where: {
            tableSessionId: tableSessionId,
            status: OrderStatus.OPEN,
          },
          select: { id: true, tableSession: { select: { status: true } } }, // Select required fields
        });

        if (!order) {
          throw new NotFoundException(
            `No open order found for session (id=${tableSessionId})`,
          );
        }
        if (order.tableSession?.status === 'CLOSED') {
          throw new ForbiddenException(
            `Session (id=${tableSessionId}) is already closed.`,
          );
        }

        // 2. Recalculate and Finalize Totals
        this.logger.verbose(
          `[${method}] Recalculating final totals for Order ID: ${order.id}`,
        );
        await this._calculateAndUpdateOrderTotals(order.id, tx);

        // 3. Update Order status to PAID
        this.logger.verbose(`[${method}] Marking order ${order.id} as PAID.`);
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID, paidAt: new Date() },
          include: orderWithDetailsInclude, // Include details for return
        });

        // 4. Update Session status to CLOSED
        this.logger.verbose(`[${method}] Closing session ${tableSessionId}.`);
        await tx.tableSession.update({
          where: { id: tableSessionId },
          data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
        });

        this.logger.log(
          `[${method}] Successfully marked order ${order.id} as PAID and closed session ${tableSessionId}.`,
        );
        return updatedOrder;
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(
        `[${method}] Failed to process payment for session ${tableSessionId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not process order payment.',
      );
    }
  }

  /**
   * PRIVATE HELPER: Recalculates and updates totals for a given order.
   * MUST be called within a transaction.
   */
  private async _calculateAndUpdateOrderTotals(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const method = this._calculateAndUpdateOrderTotals.name;
    this.logger.debug(
      `[${method}] Calculating totals for Order ID: ${orderId}`,
    );

    // Fetch all relevant data needed for calculation
    const orderWithDetails = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        // Select only necessary fields
        tableSession: {
          select: {
            store: {
              select: {
                setting: { select: { vatRate: true, serviceChargeRate: true } },
              },
            },
          },
        },
        chunks: {
          select: {
            chunkItems: {
              select: {
                price: true, // Base price snapshot
                quantity: true,
                finalPrice: true, // Use pre-calculated final price per item if available
                customizations: {
                  // Needed if finalPrice isn't pre-calculated reliably
                  select: {
                    finalPrice: true, // Price snapshot for the customization line
                    quantity: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Validate fetched data
    if (!orderWithDetails?.tableSession?.store?.setting) {
      this.logger.error(
        `[${method}] Cannot calculate totals: Order ${orderId}, associated session, store, or settings not found.`,
      );
      // Depending on how critical totals are, either throw or maybe just skip update
      throw new InternalServerErrorException(
        `Could not fetch required data to calculate totals for order ${orderId}.`,
      );
    }

    const settings = orderWithDetails.tableSession.store.setting;
    // Use Decimal for precision, default rates to 0 if null
    const vatRate = settings.vatRate
      ? new Prisma.Decimal(settings.vatRate.toString())
      : new Prisma.Decimal(0);
    const serviceRate = settings.serviceChargeRate
      ? new Prisma.Decimal(settings.serviceChargeRate.toString())
      : new Prisma.Decimal(0);

    // Calculate subTotal by summing finalPrice of each item
    let calculatedSubTotal = new Prisma.Decimal(0);
    orderWithDetails.chunks.forEach((chunk) => {
      chunk.chunkItems.forEach((item) => {
        // Use the pre-calculated finalPrice if available and valid, otherwise recalculate roughly
        // (A more robust system might recalculate item finalPrice here based on base + customizations)
        const itemFinalPrice = item.finalPrice ?? item.price; // Fallback to base price if final wasn't stored/calculated
        const itemTotal = new Prisma.Decimal(itemFinalPrice.toString()).times(
          item.quantity,
        );
        calculatedSubTotal = calculatedSubTotal.plus(itemTotal);
      });
    });
    calculatedSubTotal = calculatedSubTotal.toDecimalPlaces(2); // Ensure correct scale

    // Calculate tax and service charge based on calculated subTotal
    const vatAmount = calculatedSubTotal.times(vatRate).toDecimalPlaces(2);
    const serviceChargeAmount = calculatedSubTotal
      .times(serviceRate)
      .toDecimalPlaces(2);
    const grandTotal = calculatedSubTotal
      .plus(vatAmount)
      .plus(serviceChargeAmount);

    this.logger.debug(
      `[${method}] Order ${orderId} Totals: Sub=${calculatedSubTotal.toString()}, VAT=${vatAmount.toString()}, Service=${serviceChargeAmount.toString()}, Grand=${grandTotal.toString()}`,
    );

    // Update the Order record with calculated values and snapshots
    await tx.order.update({
      where: { id: orderId },
      data: {
        subTotal: calculatedSubTotal,
        vatRateSnapshot: settings.vatRate, // Store rate used
        serviceChargeRateSnapshot: settings.serviceChargeRate, // Store rate used
        vatAmount: vatAmount,
        serviceChargeAmount: serviceChargeAmount,
        grandTotal: grandTotal,
      },
    });
    this.logger.verbose(
      `[${method}] Updated totals and snapshots for Order ID ${orderId}`,
    );
  }
} // End OrderService Class
