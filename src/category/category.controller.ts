import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiExtraModels,
  getSchemaPath,
  ApiParam,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { RequestWithUser } from 'src/auth/types';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';

import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryBasicResponseDto } from './dto/category-basic-response.dto';
import { CategoryDeletedResponseDto } from './dto/category-deleted-response.dto';
import { MenuItemNestedResponseDto } from './dto/menu-item-nested-response.dto';
import { CustomizationGroupResponseDto } from './dto/customization-group-response.dto';
import { CustomizationOptionResponseDto } from './dto/customization-option-response.dto';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

@ApiTags('Categories')
@Controller('categories')
@ApiExtraModels(
  StandardApiResponse,
  CategoryResponseDto,
  CategoryBasicResponseDto,
  CategoryDeletedResponseDto,
  MenuItemNestedResponseDto,
  CustomizationGroupResponseDto,
  CustomizationOptionResponseDto,
  StandardApiErrorDetails,
)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category (OWNER/ADMIN Required)' })
  @ApiSuccessResponse(CategoryBasicResponseDto, {
    status: HttpStatus.CREATED,
    description: 'Category created successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
    type: StandardApiResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  async create(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Body() dto: CreateCategoryDto,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const userId = req.user.sub;
    const method = this.create.name;
    this.logger.log(
      `[${method}] User ${userId} creating category in Store ${storeId}. Name: ${dto.name}`,
    );
    const category = await this.categoryService.create(userId, storeId, dto);

    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      'Category created successfully.',
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories (with items) for a specific store (Public)',
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: Number,
    description: 'ID of the store',
    example: 1,
  })
  @ApiSuccessResponse(CategoryResponseDto, {
    isArray: true,
    description: 'List of categories with included menu items.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid storeId.',
    type: StandardApiResponse,
  })
  async findAll(
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<StandardApiResponse<CategoryResponseDto[]>> {
    const method = this.findAll.name;
    const includeItems = true;

    this.logger.log(
      `[${method}] Fetching categories for Store ${storeId}, includeItems: ${includeItems}`,
    );
    const categories = await this.categoryService.findAll(
      storeId,
      includeItems,
    );
    return StandardApiResponse.success(
      categories as any,
      'Categories retrieved successfully.',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific category by ID (Public)' })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve' })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: Number,
    description: 'ID of the store this category belongs to',
    example: 1,
  })
  @ApiSuccessResponse(
    CategoryBasicResponseDto,
    'Category retrieved successfully.',
  )
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
    type: StandardApiResponse,
  })
  async findOne(
    @Param('id', ParseIntPipe) categoryId: number,
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeId} context.`,
    );

    const category = await this.categoryService.findOne(categoryId, storeId);
    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      'Category retrieved successfully.',
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category name (OWNER/ADMIN Required)' })
  @ApiParam({ name: 'id', description: 'ID of the category to update' })
  @ApiSuccessResponse(
    CategoryBasicResponseDto,
    'Category updated successfully.',
  )
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
    type: StandardApiResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
    type: StandardApiResponse,
  })
  async update(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const userId = req.user.sub;
    const method = this.update.name;
    this.logger.log(
      `[${method}] User ${userId} updating category ID ${categoryId} in Store ${storeId}.`,
    );
    const updatedCategory = await this.categoryService.update(
      userId,
      storeId,
      categoryId,
      dto,
    );
    return StandardApiResponse.success(
      updatedCategory as CategoryBasicResponseDto,
      'Category updated successfully.',
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category (OWNER/ADMIN Required)' })
  @ApiParam({ name: 'id', description: 'ID of the category to delete' })
  @ApiSuccessResponse(
    CategoryDeletedResponseDto,
    'Category deleted successfully.',
  )
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
    type: StandardApiResponse,
  })
  async remove(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<StandardApiResponse<CategoryDeletedResponseDto>> {
    const userId = req.user.sub;
    const method = this.remove.name;
    this.logger.log(
      `[${method}] User ${userId} deleting category ID ${categoryId} from Store ${storeId}.`,
    );
    const deletedResult = await this.categoryService.remove(
      userId,
      storeId,
      categoryId,
    );
    return StandardApiResponse.success(
      deletedResult,
      'Category deleted successfully.',
    );
  }

  @Patch('sort')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reorder categories and their menu items (OWNER/ADMIN Required)',
  })
  @ApiSuccessResponse(String, {
    description: 'Categories and items reordered successfully.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories and items reordered successfully.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(StandardApiResponse) },
        {
          properties: {
            data: { type: 'object', nullable: true, example: null },
            errors: { example: null },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid sorting payload.',
    type: StandardApiResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission.',
    type: StandardApiResponse,
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Body() payload: SortCategoriesPayloadDto,
  ): Promise<StandardApiResponse<null>> {
    const userId = req.user.sub;
    const method = this.sortCategories.name;
    this.logger.log(
      `[${method}] User ${userId} sorting categories/items in Store ${storeId}.`,
    );
    const result = await this.categoryService.sortCategoriesAndMenuItems(
      userId,
      storeId,
      payload,
    );

    return StandardApiResponse.success(null, result.message);
  }
}
