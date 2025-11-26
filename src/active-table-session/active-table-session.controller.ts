import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

import { RequestWithUser } from "src/auth/types";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import { ActiveTableSession } from "src/generated/prisma/client";
import { OrderResponseDto } from "src/order/dto/order-response.dto";
import { OrderService } from "src/order/order.service";

import { ActiveTableSessionService } from "./active-table-session.service";
import { CreateManualSessionDto } from "./dto/create-manual-session.dto";
import { JoinSessionDto } from "./dto/join-session.dto";
import { SessionCreatedResponseDto } from "./dto/session-created-response.dto";
import { SessionResponseDto } from "./dto/session-response.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Active Table Sessions")
@Controller("active-table-sessions")
export class ActiveTableSessionController {
  constructor(
    private readonly sessionService: ActiveTableSessionService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Helper: Maps session to response DTO WITHOUT session token (security)
   * SECURITY FIX: Prevents session token exposure in API responses
   */
  private mapToSessionResponse(
    session: ActiveTableSession,
  ): SessionResponseDto {
    const { sessionToken: _sessionToken, ...safeSession } = session;
    return safeSession;
  }

  @Post("manual")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create manual session (counter, phone, takeout)",
    description:
      "Staff-initiated orders without table association. Requires OWNER, ADMIN, SERVER, or CASHIER role.",
  })
  @ApiQuery({ name: "storeId", description: "Store ID" })
  @ApiResponse({
    status: 201,
    description: "Manual session created successfully",
    type: SessionCreatedResponseDto,
  })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async createManualSession(
    @Req() req: RequestWithUser,
    @Query("storeId") storeId: string,
    @Body() dto: CreateManualSessionDto,
  ): Promise<StandardApiResponse<SessionCreatedResponseDto>> {
    const userId = req.user.sub;
    const session = await this.sessionService.createManualSession(
      userId,
      storeId,
      dto,
    );
    return StandardApiResponse.success(session as SessionCreatedResponseDto);
  }

  @Post("join-by-table/:tableId")
  @ApiOperation({
    summary: "Join or create a session for a table",
    description:
      "Customers scan QR code on table. Returns existing active session or creates new one. SECURITY: Session token is only returned here.",
  })
  @ApiParam({ name: "tableId", description: "Table ID from QR code" })
  @ApiResponse({
    status: 201,
    description: "Session joined/created successfully (includes session token)",
    type: SessionCreatedResponseDto,
  })
  @ApiResponse({ status: 404, description: "Table not found" })
  async joinByTable(
    @Param("tableId") tableId: string,
    @Body() dto: JoinSessionDto,
  ): Promise<StandardApiResponse<SessionCreatedResponseDto>> {
    const session = await this.sessionService.joinByTable(tableId, dto);
    return StandardApiResponse.success(session as SessionCreatedResponseDto);
  }

  @Get(":sessionId")
  @ApiOperation({
    summary: "Get session by ID",
    description: "SECURITY: Session token is excluded from response",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({
    status: 200,
    description: "Session found (session token excluded for security)",
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Session not found" })
  async findOne(
    @Param("sessionId") sessionId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findOne(sessionId);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Get("token/:token")
  @ApiOperation({
    summary: "Get session by token",
    description: "SECURITY: Session token is excluded from response",
  })
  @ApiParam({ name: "token", description: "Session token" })
  @ApiResponse({
    status: 200,
    description: "Session found (session token excluded for security)",
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Invalid session token" })
  async findByToken(
    @Param("token") token: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findByToken(token);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all active sessions for a store (POS)",
    description: "SECURITY: Session tokens are excluded from response",
  })
  @ApiQuery({ name: "storeId", description: "Store ID" })
  @ApiResponse({
    status: 200,
    description: "Active sessions retrieved (session tokens excluded)",
    type: [SessionResponseDto],
  })
  async findActiveByStore(
    @Query("storeId") storeId: string,
  ): Promise<StandardApiResponse<SessionResponseDto[]>> {
    const sessions = await this.sessionService.findActiveByStore(storeId);
    return StandardApiResponse.success(
      sessions.map((s) => this.mapToSessionResponse(s)),
    );
  }

  @Put(":sessionId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update session (Restaurant Management System only)",
    description:
      "SECURITY: Session token is excluded from response. Store isolation enforced.",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({
    status: 200,
    description: "Session updated (session token excluded for security)",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "Insufficient permissions or cross-store access",
  })
  @ApiResponse({ status: 404, description: "Session not found" })
  async update(
    @Param("sessionId") sessionId: string,
    @Body() dto: UpdateSessionDto,
    @GetUser("sub") userId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.update(sessionId, dto, userId);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Post(":sessionId/close")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Close session (Restaurant Management System only)",
    description:
      "SECURITY: Session token is excluded from response. Store isolation enforced.",
  })
  @ApiParam({ name: "sessionId", description: "Session ID" })
  @ApiResponse({
    status: 200,
    description: "Session closed (session token excluded for security)",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "Insufficient permissions or cross-store access",
  })
  @ApiResponse({ status: 404, description: "Session not found" })
  @ApiResponse({ status: 400, description: "Session already closed" })
  async close(
    @Param("sessionId") sessionId: string,
    @GetUser("sub") userId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.close(sessionId, userId);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Get(":sessionId/orders")
  @ApiOperation({
    summary: "Get all orders for a session (SOS - Self-Order System)",
    description:
      "Retrieves all orders associated with an active table session. Public endpoint for customers.",
  })
  @ApiParam({
    name: "sessionId",
    description: "Active table session ID",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
    type: [OrderResponseDto],
  })
  @ApiResponse({ status: 404, description: "Session not found" })
  async getSessionOrders(
    @Param("sessionId", new ParseUUIDPipe({ version: "7" })) sessionId: string,
  ): Promise<StandardApiResponse<OrderResponseDto[]>> {
    const orders = await this.orderService.findBySession(sessionId);
    return StandardApiResponse.success(orders);
  }
}
