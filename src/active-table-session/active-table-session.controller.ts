import {
  Controller,
  Post,
  Param,
  UseGuards,
  Req,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Get,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiExtraModels,
  ApiCookieAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';

import { JoinSessionResponseDto } from 'src/active-table-session/dto/join-session-response.dto';
import { SessionContextDto } from 'src/active-table-session/dto/session-content.dto';
import { CustomerSessionJwtAuthGuard } from 'src/auth/guards/customer-session-jwt.guard';
import { RequestWithCustomer, RequestWithUser } from 'src/auth/types';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';

import { ActiveTableSessionService } from './active-table-session.service';
import { ActiveTableSessionResponseDto } from './dto/active-table-session-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Active Table Sessions')
@Controller()
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  ActiveTableSessionResponseDto,
  JoinSessionResponseDto,
  SessionContextDto,
)
export class ActiveTableSessionController {
  private readonly logger = new Logger(ActiveTableSessionController.name);

  constructor(
    private readonly sessionService: ActiveTableSessionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Endpoint for Staff (OWNER/ADMIN/CASHIER/SERVER) to create a new session for a table.
   * This signifies the table is now occupied and ready for cart/order actions.
   */
  @Post('stores/:storeId/tables/:tableId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new active session for a table (Staff Only)',
    description:
      'Creates an ActiveTableSession, linking it to the table. Fails if the table already has an active session.',
  })
  @ApiParam({
    name: 'storeId',
    type: String,
    format: 'uuid',
    description: 'ID of the store containing the table',
  })
  @ApiParam({
    name: 'tableId',
    type: String,
    format: 'uuid',
    description: 'ID of the table to start the session for',
  })
  @ApiSuccessResponse(ActiveTableSessionResponseDto, {
    status: HttpStatus.CREATED,
    description: 'Session created successfully.',
  })
  async createSession(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<StandardApiResponse<ActiveTableSessionResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} creating session for Table ${tableId} in Store ${storeId}`,
    );
    const session = await this.sessionService.createSession(
      userId,
      storeId,
      tableId,
    );

    return StandardApiResponse.success(
      session,
      'Session created successfully.',
    );
  }

  /**
   * Endpoint for Customers to join an existing active session using the Table ID.
   * This typically happens after scanning a QR code linked to this endpoint.
   * On success, it sets a session token in an HttpOnly cookie.
   */
  @Post('tables/:tableId/join-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join the active session for a specific table ID (Public)',
  })
  @ApiParam({
    name: 'tableId',
    type: String,
    format: 'uuid',
    description: 'The unique ID of the table to join (from QR code/NFC)',
  })
  @ApiSuccessResponse(JoinSessionResponseDto, {
    description: 'Session joined. Session token set in HttpOnly cookie.',
  })
  async joinSessionByTable(
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StandardApiResponse<JoinSessionResponseDto>> {
    this.logger.log(
      `Customer attempting to join session for Table ID: ${tableId}`,
    );

    const { token, session, storeSlug } =
      await this.sessionService.joinSessionByTable(tableId);

    response.cookie('session_token', token, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') !== 'dev',
      sameSite: 'strict',
      path: '/',
    });

    const responseData: JoinSessionResponseDto = {
      message: 'Session joined successfully. Session token set in cookie.',
      sessionId: session.id,
      tableId: session.tableId,
      storeId: session.storeId,
      storeSlug,
    };

    return StandardApiResponse.success(responseData, responseData.message);
  }

  /**
   * Example endpoint protected by the customer session JWT cookie.
   * Retrieves the session context (containing the ActiveTableSession ID).
   */
  @Get('sessions/my-context')
  @UseGuards(CustomerSessionJwtAuthGuard)
  @ApiCookieAuth('session_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get context (session ID) of the current customer session (Requires Session Cookie)',
  })
  @ApiSuccessResponse(SessionContextDto, 'Session context retrieved.')
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired session cookie.',
    type: StandardApiResponse,
  })
  getCurrentSessionContext(
    @Req() req: RequestWithCustomer,
  ): StandardApiResponse<SessionContextDto> {
    const sessionCtx = req.user;
    this.logger.log(
      `Returning session context for Session ID: ${sessionCtx?.sessionId}`,
    );
    if (!sessionCtx?.sessionId) {
      throw new InternalServerErrorException(
        'Session context not found after guard.',
      );
    }

    return StandardApiResponse.success(
      sessionCtx,
      'Session context retrieved.',
    );
  }
}
