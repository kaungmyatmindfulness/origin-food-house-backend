import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Put, // Added Put
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
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse, // Added more specific error decorators
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableService } from './table.service';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { RequestWithUser } from 'src/auth/types';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { BatchReplaceTablesDto } from './dto/batch-replace-tables.dto';
import { BatchCreateTableDto } from './dto/batch-create-table.dto';
import { BatchOperationResponseDto } from './dto/batch-operation-response.dto';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { TableResponseDto } from './dto/table-response.dto';
import { TableDeletedResponseDto } from './dto/table-deleted-response.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

// Remove Public decorator if not used/needed
// import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Stores / Tables')
@Controller('stores/:storeId/tables')
@ApiExtraModels(
  StandardApiResponse,
  TableResponseDto,
  TableDeletedResponseDto,
  StandardApiErrorDetails,
  BatchReplaceTablesDto,
  BatchCreateTableDto,
  BatchOperationResponseDto,
)
export class TableController {
  private readonly logger = new Logger(TableController.name);

  constructor(private readonly tableService: TableService) {}

  // --- CREATE (Single) ---
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @ApiBadRequestResponse({
    description: 'Invalid input or duplicate name.',
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  async createTable(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateTableDto,
  ): Promise<StandardApiResponse<TableResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} creating table in Store ${storeId}`); // Add request ID if available
    const table = await this.tableService.createTable(userId, storeId, dto);
    // Rely on ClassSerializerInterceptor
    return StandardApiResponse.success(table, 'Table created successfully.');
  }

  // --- BATCH REPLACE ---
  @Put('batch-replace') // Using PUT for replace semantics
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Replace ALL tables for a store with the provided list (OWNER/ADMIN Required)',
  })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiBody({ type: BatchReplaceTablesDto })
  @ApiSuccessResponse(BatchOperationResponseDto, {
    description:
      'Tables replaced successfully. Returns count of created tables.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid input (e.g., duplicate names in input), or active sessions exist.',
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  async replaceAllTables(
    @Req() req: RequestWithUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: BatchReplaceTablesDto,
  ): Promise<StandardApiResponse<BatchOperationResponseDto>> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} replacing tables in Store ${storeId}`);
    const result = await this.tableService.replaceAllTables(
      userId,
      storeId,
      dto,
    );
    return StandardApiResponse.success(
      result,
      `Successfully replaced tables. ${result.count} tables created.`,
    );
  }

  // --- GET ALL --- (Public)
  @Get()
  // No Guard/Auth decorators needed
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all tables for a specific store (Public)' })
  @ApiParam({
    name: 'storeId',
    description: 'ID (UUID) of the store',
    type: String,
  })
  @ApiSuccessResponse(TableResponseDto, {
    isArray: true,
    description: 'List of tables for the store.',
  })
  @ApiNotFoundResponse({
    description: 'Store not found.',
    type: StandardApiResponse,
  })
  async findAllByStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StandardApiResponse<TableResponseDto[]>> {
    this.logger.log(`Fetching all tables for Store ${storeId}`); // Example logging request ID if set globally
    const tables = await this.tableService.findAllByStore(storeId);
    // Rely on ClassSerializerInterceptor
    return StandardApiResponse.success(
      tables,
      'Tables retrieved successfully.',
    );
  }

  // --- GET ONE --- (Public)
  @Get(':tableId')
  // No Guard/Auth decorators needed
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
  @ApiNotFoundResponse({
    description: 'Store or Table not found.',
    type: StandardApiResponse,
  })
  async findOne(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ): Promise<StandardApiResponse<TableResponseDto>> {
    this.logger.log(`Fetching table ${tableId} for Store ${storeId}`);
    const table = await this.tableService.findOne(storeId, tableId);
    // Rely on ClassSerializerInterceptor
    return StandardApiResponse.success(
      table,
      'Table details retrieved successfully.',
    );
  }

  // --- UPDATE (Single) ---
  @Patch(':tableId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @ApiBadRequestResponse({
    description: 'Invalid input or duplicate name.',
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  @ApiNotFoundResponse({
    description: 'Store or Table not found.',
    type: StandardApiResponse,
  })
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
    // Rely on ClassSerializerInterceptor
    return StandardApiResponse.success(
      updatedTable,
      'Table updated successfully.',
    );
  }

  // --- DELETE (Single) ---
  @Delete(':tableId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @ApiBadRequestResponse({
    description: 'Cannot delete table with an active session.',
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiForbiddenResponse({
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  @ApiNotFoundResponse({
    description: 'Store or Table not found.',
    type: StandardApiResponse,
  })
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
    // No transformation needed
    return StandardApiResponse.success(result, 'Table deleted successfully.');
  }
}
