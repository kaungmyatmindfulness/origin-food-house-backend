import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiQuery } from "@nestjs/swagger";

import { OrderStatus, Role, RoutingArea } from "src/generated/prisma/client";

import { AuthService } from "../auth/auth.service";
import { RequestWithUser } from "../auth/types";
import { KitchenOrderResponseDto } from "./dto/kitchen-order-response.dto";
import { UpdateKitchenStatusDto } from "./dto/update-kitchen-status.dto";
import { KitchenService } from "./kitchen.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiStoreGetAll,
  ApiStoreIdParam,
  ApiUuidParam,
  ApiResourceErrors,
  ApiAuthWithRoles,
} from "../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

/**
 * Controller for Kitchen Display System (KDS) endpoints
 */
@ApiTags("Stores / Kitchen")
@Controller("stores/:storeId/kitchen")
@UseGuards(JwtAuthGuard)
@ApiAuth()
export class KitchenController {
  constructor(
    private readonly kitchenService: KitchenService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get orders for kitchen display
   */
  @Get("orders")
  @ApiStoreGetAll(KitchenOrderResponseDto, "kitchen orders", {
    summary: "Get orders for kitchen display (CHEF, SERVER, ADMIN, OWNER)",
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
  async getOrders(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiUuidParam("orderId", "ID (UUID) of the order")
  @ApiSuccessResponse(
    KitchenOrderResponseDto,
    "Order details retrieved successfully",
  )
  @ApiResourceErrors()
  async getOrderDetails(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("orderId", new ParseUUIDPipe({ version: "7" })) orderId: string,
  ): Promise<StandardApiResponse<KitchenOrderResponseDto>> {
    const userId = req.user.sub;

    // Check permission before getting order
    await this.authService.checkStorePermission(userId, storeId, [
      Role.CHEF,
      Role.SERVER,
      Role.ADMIN,
      Role.OWNER,
    ]);

    const order = await this.kitchenService.getOrderDetails(orderId);
    return StandardApiResponse.success(order);
  }

  /**
   * Update order kitchen status
   */
  @Patch("orders/:orderId/status")
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiUuidParam("orderId", "ID (UUID) of the order")
  @ApiSuccessResponse(
    KitchenOrderResponseDto,
    "Order status updated successfully",
  )
  @ApiResourceErrors()
  async updateOrderStatus(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("orderId", new ParseUUIDPipe({ version: "7" })) orderId: string,
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
