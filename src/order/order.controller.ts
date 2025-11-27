import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from "@nestjs/swagger";

import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { QuickSaleCheckoutDto } from "./dto/quick-sale-checkout.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrderService } from "./order.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiResourceErrors,
  ApiGetOne,
  ApiUuidParam,
} from "../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { GetUser } from "../common/decorators/get-user.decorator";
import { PaginatedResponseDto } from "../common/dto/paginated-response.dto";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Orders")
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Checkout cart and create order",
    description:
      "Converts cart to order and clears the cart. SECURITY FIX: Requires session token (customers) or JWT (staff)",
  })
  @ApiHeader({
    name: "x-session-token",
    description:
      "Session token for customer authentication (optional if JWT provided)",
    required: false,
  })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiSuccessResponse(OrderResponseDto, {
    status: HttpStatus.CREATED,
    description: "Order created successfully",
  })
  @ApiResourceErrors()
  async checkout(
    @Query("sessionId") sessionId: string,
    @Body() dto: CheckoutCartDto,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: { user?: { sub: string } },
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const userId = req?.user?.sub;
    const order = await this.orderService.checkoutCart(
      sessionId,
      dto,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(order);
  }

  @Post("quick-checkout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Quick sale checkout (POS)",
    description:
      "Creates session, cart items, and order in a single atomic operation. " +
      "Optimized for quick sale (counter/phone/takeout) orders where speed is critical. " +
      "Bypasses the normal flow of creating session -> adding items -> checkout.",
  })
  @ApiAuth()
  @ApiSuccessResponse(OrderResponseDto, {
    status: HttpStatus.CREATED,
    description: "Order created successfully",
  })
  @ApiResourceErrors()
  async quickCheckout(
    @GetUser("sub") userId: string,
    @Body() dto: QuickSaleCheckoutDto,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.quickCheckout(dto, userId);
    return StandardApiResponse.success(order);
  }

  @Get(":orderId")
  @ApiGetOne(OrderResponseDto, "Order", { idDescription: "Order ID" })
  @ApiUuidParam("orderId", "Order ID")
  async findOne(
    @Param("orderId") orderId: string,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.findOne(orderId);
    return StandardApiResponse.success(order);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get all orders for a store with pagination (POS)",
    description: "Returns paginated list of orders for a specific store",
  })
  @ApiAuth()
  @ApiQuery({ name: "storeId", description: "Store ID", required: true })
  @ApiQuery({
    name: "page",
    description: "Page number (1-indexed)",
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: "limit",
    description: "Items per page (max 100)",
    required: false,
    type: Number,
  })
  @ApiSuccessResponse(PaginatedResponseDto<OrderResponseDto>, {
    description: "Orders retrieved successfully",
  })
  async findByStore(
    @Query("storeId") storeId: string,
    @Query() paginationDto: PaginationQueryDto,
  ): Promise<StandardApiResponse<PaginatedResponseDto<OrderResponseDto>>> {
    const orders = await this.orderService.findByStore(storeId, paginationDto);
    return StandardApiResponse.success(orders);
  }

  @Patch(":orderId/status")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Update order status (POS)",
    description: "Update order status through kitchen workflow",
  })
  @ApiAuth()
  @ApiUuidParam("orderId", "Order ID")
  @ApiSuccessResponse(OrderResponseDto, {
    description: "Order status updated successfully",
  })
  @ApiResourceErrors()
  async updateStatus(
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.updateStatus(orderId, dto);
    return StandardApiResponse.success(order);
  }

  @Post(":orderId/apply-discount")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Apply discount to order (POS)",
    description:
      "Apply percentage or fixed amount discount to an order. Implements 3-tier authorization: Small (<10%) = CASHIER, Medium (10-50%) = ADMIN, Large (>50%) = OWNER",
  })
  @ApiAuth()
  @ApiUuidParam("orderId", "Order ID")
  @ApiQuery({ name: "storeId", description: "Store ID", required: true })
  @ApiSuccessResponse(OrderResponseDto, {
    description: "Discount applied successfully",
  })
  @ApiResourceErrors()
  async applyDiscount(
    @GetUser("sub") userId: string,
    @Query("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() dto: ApplyDiscountDto,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.applyDiscount(
      userId,
      storeId,
      orderId,
      dto,
    );
    return StandardApiResponse.success(order);
  }

  @Delete(":orderId/discount")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Remove discount from order (POS)",
    description:
      "Remove previously applied discount. Requires ADMIN or OWNER role.",
  })
  @ApiAuth()
  @ApiUuidParam("orderId", "Order ID")
  @ApiQuery({ name: "storeId", description: "Store ID", required: true })
  @ApiSuccessResponse(OrderResponseDto, {
    description: "Discount removed successfully",
  })
  @ApiResourceErrors()
  async removeDiscount(
    @GetUser("sub") userId: string,
    @Query("storeId") storeId: string,
    @Param("orderId") orderId: string,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.removeDiscount(
      userId,
      storeId,
      orderId,
    );
    return StandardApiResponse.success(order);
  }
}
