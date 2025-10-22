import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';

import { ActiveTableSessionService } from './active-table-session.service';
import { JoinSessionDto } from './dto/join-session.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Active Table Sessions')
@Controller('active-table-sessions')
export class ActiveTableSessionController {
  constructor(private readonly sessionService: ActiveTableSessionService) {}

  @Post('join-by-table/:tableId')
  @ApiOperation({
    summary: 'Join or create a session for a table',
    description:
      'Customers scan QR code on table. Returns existing active session or creates new one.',
  })
  @ApiParam({ name: 'tableId', description: 'Table ID from QR code' })
  @ApiResponse({
    status: 201,
    description: 'Session joined/created successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async joinByTable(
    @Param('tableId') tableId: string,
    @Body() dto: JoinSessionDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.joinByTable(tableId, dto);
    return StandardApiResponse.success(session as SessionResponseDto);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get session by ID' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session found',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findOne(
    @Param('sessionId') sessionId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findOne(sessionId);
    return StandardApiResponse.success(session as SessionResponseDto);
  }

  @Get('token/:token')
  @ApiOperation({ summary: 'Get session by token' })
  @ApiParam({ name: 'token', description: 'Session token' })
  @ApiResponse({
    status: 200,
    description: 'Session found',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invalid session token' })
  async findByToken(
    @Param('token') token: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findByToken(token);
    return StandardApiResponse.success(session as SessionResponseDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions for a store (POS)' })
  @ApiQuery({ name: 'storeId', description: 'Store ID' })
  @ApiResponse({
    status: 200,
    description: 'Active sessions retrieved',
    type: [SessionResponseDto],
  })
  async findActiveByStore(
    @Query('storeId') storeId: string,
  ): Promise<StandardApiResponse<SessionResponseDto[]>> {
    const sessions = await this.sessionService.findActiveByStore(storeId);
    return StandardApiResponse.success(sessions as SessionResponseDto[]);
  }

  @Put(':sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update session (Restaurant Management System only)',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session updated',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async update(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.update(sessionId, dto);
    return StandardApiResponse.success(session as SessionResponseDto);
  }

  @Post(':sessionId/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Close session (Restaurant Management System only)',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session closed',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 400, description: 'Session already closed' })
  async close(
    @Param('sessionId') sessionId: string,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.close(sessionId);
    return StandardApiResponse.success(session as SessionResponseDto);
  }
}
