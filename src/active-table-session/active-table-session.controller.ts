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
import { ApiTags, ApiQuery, ApiResponse } from "@nestjs/swagger";

import { RequestWithUser } from "src/auth/types";
import {
  ApiAuth,
  ApiAuthWithRoles,
  ApiGetOne,
  ApiUuidParam,
  ApiResourceErrors,
} from "src/common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
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
  @ApiAuth()
  @ApiSuccessResponse(SessionCreatedResponseDto, {
    status: 201,
    description: "Manual session created successfully",
  })
  @ApiQuery({ name: "storeId", description: "Store ID" })
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
  @ApiUuidParam("tableId", "Table ID from QR code")
  @ApiSuccessResponse(SessionCreatedResponseDto, {
    status: 201,
    description: "Session joined/created successfully (includes session token)",
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
  @ApiGetOne(SessionResponseDto, "session", {
    summary: "Get session by ID",
    description: "SECURITY: Session token is excluded from response",
    idDescription: "Session ID",
  })
  @ApiUuidParam("sessionId", "Session ID")
  async findOne(
    @Param("sessionId") sessionId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findOne(sessionId);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Get("token/:token")
  @ApiUuidParam("token", "Session token")
  @ApiSuccessResponse(SessionResponseDto, {
    description: "Session found (session token excluded for security)",
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
  @ApiAuth()
  @ApiQuery({ name: "storeId", description: "Store ID" })
  @ApiSuccessResponse(SessionResponseDto, {
    isArray: true,
    description: "Active sessions retrieved (session tokens excluded)",
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
  @ApiAuthWithRoles()
  @ApiUuidParam("sessionId", "Session ID")
  @ApiSuccessResponse(SessionResponseDto, {
    description: "Session updated (session token excluded for security)",
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiUuidParam("sessionId", "Session ID")
  @ApiSuccessResponse(SessionResponseDto, {
    description: "Session closed (session token excluded for security)",
  })
  @ApiResponse({ status: 400, description: "Session already closed" })
  @ApiResourceErrors()
  async close(
    @Param("sessionId") sessionId: string,
    @GetUser("sub") userId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.close(sessionId, userId);
    return StandardApiResponse.success(this.mapToSessionResponse(session));
  }

  @Get(":sessionId/orders")
  @ApiUuidParam("sessionId", "Active table session ID")
  @ApiSuccessResponse(OrderResponseDto, {
    isArray: true,
    description: "Orders retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Session not found" })
  async getSessionOrders(
    @Param("sessionId", new ParseUUIDPipe({ version: "7" })) sessionId: string,
  ): Promise<StandardApiResponse<OrderResponseDto[]>> {
    const orders = await this.orderService.findBySession(sessionId);
    return StandardApiResponse.success(orders);
  }
}
