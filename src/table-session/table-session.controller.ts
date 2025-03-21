import { Controller, Post, Get, Param, Body, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TableSessionService } from './table-session.service';

@ApiTags('table-sessions')
@Controller('table-sessions')
export class TableSessionController {
  constructor(private tableSessionService: TableSessionService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new table session for a shop and table' })
  async createSession(@Body() body: { shopId: number; tableId: number }) {
    const session = await this.tableSessionService.createSession(
      body.shopId,
      body.tableId,
    );
    return {
      status: 'success',
      data: session,
      message: 'Table session created',
      error: null,
    };
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get table session by UUID' })
  async getSession(@Param('uuid') uuid: string) {
    const session = await this.tableSessionService.getSessionByUuid(uuid);
    return {
      status: 'success',
      data: session,
      message: null,
      error: null,
    };
  }

  @Patch(':uuid/close')
  @ApiOperation({ summary: 'Close the session by UUID' })
  async closeSession(@Param('uuid') uuid: string) {
    const closed = await this.tableSessionService.closeSession(uuid);
    return {
      status: 'success',
      data: closed,
      message: 'Session closed',
      error: null,
    };
  }
}
