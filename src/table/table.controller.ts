import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Put,
  Body,
  UseGuards,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiExtraModels,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableService } from './table.service';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { RequestWithUser } from 'src/auth/types';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

import { BatchUpsertTableDto } from './dto/batch-upsert-table.dto';
import { UpsertTableDto } from './dto/upsert-table.dto';

import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { TableResponseDto } from './dto/table-response.dto';
import { TableDeletedResponseDto } from './dto/table-deleted-response.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

@ApiTags('Stores / Tables')
@Controller('stores/:storeId/tables')
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  TableResponseDto,
  TableDeletedResponseDto,
  BatchUpsertTableDto,
  UpsertTableDto,
)
export class TableController {
  private readonly logger = new Logger(TableController.name);

  constructor(private readonly tableService: TableService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new table (OWNER/ADMIN Required)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiSuccessResponse(TableResponseDto, {
    status: HttpStatus.CREATED,
    description: 'Table created successfully.',
  })
  async createTable(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateTableDto,
  ): Promise<StandardApiResponse<TableResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} creating table in Store ${storeId}`);
    const table = await this.tableService.createTable(userId, storeId, dto);

    return StandardApiResponse.success(table, 'Table created successfully.');
  }

  @Put('batch-sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize tables for a store (OWNER/ADMIN Required)',
    description:
      'Creates/Updates tables based on the input list. Deletes any existing tables for the store that are NOT included in the input list (by ID). Checks for active sessions before deleting.',
  })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiBody({ type: BatchUpsertTableDto })
  @ApiSuccessResponse(TableResponseDto, {
    isArray: true,
    description:
      'Tables synchronized successfully. Returns the final list of tables for the store.',
  })
  async syncTables(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: BatchUpsertTableDto,
  ): Promise<StandardApiResponse<TableResponseDto[]>> {
    const userId = req.user.sub;
    const method = this.syncTables.name;
    this.logger.log(
      `[${method}] User ${userId} syncing tables in Store ${storeId}`,
    );

    const results = await this.tableService.syncTables(userId, storeId, dto);

    return StandardApiResponse.success(
      results,
      `Successfully synchronized tables for store.`,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tables for a specific store (Public)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiSuccessResponse(TableResponseDto, {
    isArray: true,
    description: 'List of tables for the store, naturally sorted by name.',
  })
  async findAllByStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StandardApiResponse<TableResponseDto[]>> {
    this.logger.log(`Fetching all tables for Store ${storeId}`);
    const tables = await this.tableService.findAllByStore(storeId);

    return StandardApiResponse.success(
      tables,
      'Tables retrieved successfully.',
    );
  }

  @Get(':tableId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific table by ID (Public)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiParam({
    name: 'tableId',
    description: 'ID (UUID) of the table',
    type: String,
  })
  @ApiSuccessResponse(TableResponseDto, 'Table details retrieved successfully.')
  async findOne(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<StandardApiResponse<TableResponseDto>> {
    this.logger.log(`Fetching table ${tableId} for Store ${storeId}`);
    const table = await this.tableService.findOne(storeId, tableId);

    return StandardApiResponse.success(
      table,
      'Table details retrieved successfully.',
    );
  }

  @Patch(':tableId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a table name (OWNER/ADMIN Required)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiParam({
    name: 'tableId',
    description: 'ID (UUID) of the table to update',
    type: String,
  })
  @ApiSuccessResponse(TableResponseDto, 'Table updated successfully.')
  async updateTable(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body() dto: UpdateTableDto,
  ): Promise<StandardApiResponse<TableResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} updating table ${tableId} in Store ${storeId}`,
    );
    const updatedTable = await this.tableService.updateTable(
      userId,
      storeId,
      tableId,
      dto,
    );

    return StandardApiResponse.success(
      updatedTable,
      'Table updated successfully.',
    );
  }

  @Delete(':tableId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a table (OWNER/ADMIN Required)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiParam({
    name: 'tableId',
    description: 'ID (UUID) of the table to delete',
    type: String,
  })
  @ApiSuccessResponse(TableDeletedResponseDto, 'Table deleted successfully.')
  async deleteTable(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<StandardApiResponse<TableDeletedResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} deleting table ${tableId} from Store ${storeId}`,
    );
    const result = await this.tableService.deleteTable(
      userId,
      storeId,
      tableId,
    );

    return StandardApiResponse.success(result, 'Table deleted successfully.');
  }
}
