import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";

import { OrderStatus, Role, RoutingArea } from "src/generated/prisma/client";

import { AuthService } from "../auth/auth.service";
import { RequestWithUser } from "../auth/types";
import { KitchenOrderResponseDto } from "./dto/kitchen-order-response.dto";
import { UpdateKitchenStatusDto } from "./dto/update-kitchen-status.dto";
import { KitchenService } from "./kitchen.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

/**
 * Controller for Kitchen Display System (KDS) endpoints
 */
@ApiTags("Kitchen")
@Controller("kitchen")
@UseGuards(JwtAuthGuard)
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get orders for kitchen display
   */
  @Get("orders")
  @ApiOperation({ summary: "Get orders for kitchen display" })
  @ApiQuery({
    name: "storeId",
    required: true,
    description: "Store ID",
    type: String,
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by order status",
    enum: OrderStatus,
  })
  @ApiQuery({
    name: "routingArea",
    required: false,
    description: "Filter by menu item routing area",
    enum: RoutingArea,
  })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
    type: [KitchenOrderResponseDto],
  })
  async getOrders(
    @Req() req: RequestWithUser,
    @Query("storeId") storeId: string,
    @Query("status") status?: OrderStatus,
    @Query("routingArea") routingArea?: RoutingArea,
  ): Promise<StandardApiResponse<KitchenOrderResponseDto[]>> {
    const userId = req.user.sub;

    // Check permission - CHEF, SERVER, ADMIN, OWNER can access
    await this.authService.checkStorePermission(userId, storeId, [
      Role.CHEF,
      Role.SERVER,
      Role.ADMIN,
      Role.OWNER,
    ]);

    const orders = await this.kitchenService.getOrdersByStatus(
      storeId,
      status,
      routingArea,
    );
    return StandardApiResponse.success(orders);
  }

  /**
   * Get single order details for kitchen
   */
  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get order details for kitchen display" })
  @ApiResponse({
    status: 200,
    description: "Order details retrieved successfully",
    type: KitchenOrderResponseDto,
  })
  async getOrderDetails(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
  ): Promise<StandardApiResponse<KitchenOrderResponseDto>> {
    const userId = req.user.sub;
    const order = await this.kitchenService.getOrderDetails(orderId);

    // Check permission after getting order to validate storeId
    await this.authService.checkStorePermission(userId, order.storeId, [
      Role.CHEF,
      Role.SERVER,
      Role.ADMIN,
      Role.OWNER,
    ]);

    return StandardApiResponse.success(order);
  }

  /**
   * Update order kitchen status
   */
  @Patch("orders/:orderId/status")
  @ApiOperation({ summary: "Update order kitchen status" })
  @ApiQuery({
    name: "storeId",
    required: true,
    description: "Store ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Order status updated successfully",
    type: KitchenOrderResponseDto,
  })
  async updateOrderStatus(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
    @Query("storeId") storeId: string,
    @Body() dto: UpdateKitchenStatusDto,
  ): Promise<StandardApiResponse<KitchenOrderResponseDto>> {
    const userId = req.user.sub;

    // Check permission - CHEF, SERVER, ADMIN, OWNER can update
    await this.authService.checkStorePermission(userId, storeId, [
      Role.CHEF,
      Role.SERVER,
      Role.ADMIN,
      Role.OWNER,
    ]);

    const order = await this.kitchenService.updateOrderStatus(
      orderId,
      storeId,
      dto,
    );
    return StandardApiResponse.success(order);
  }
}
