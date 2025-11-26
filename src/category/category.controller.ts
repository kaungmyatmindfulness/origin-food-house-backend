import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { RequestWithUser } from "src/auth/types";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { StandardApiErrorDetails } from "src/common/dto/standard-api-error-details.dto";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import {
  SupportedLocale,
  SUPPORTED_LOCALES,
} from "src/common/dto/translation.dto";
import { ParseLocalePipe } from "src/common/pipes/parse-locale.pipe";
import { UpdateCategoryTranslationsDto } from "src/menu/dto/update-translations.dto";

import { CategoryService } from "./category.service";
import { CategoryBasicResponseDto } from "./dto/category-basic-response.dto";
import { CategoryDeletedResponseDto } from "./dto/category-deleted-response.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CustomizationGroupResponseDto } from "./dto/customization-group-response.dto";
import { CustomizationOptionResponseDto } from "./dto/customization-option-response.dto";
import { MenuItemNestedResponseDto } from "./dto/menu-item-nested-response.dto";
import { SortCategoriesPayloadDto } from "./dto/sort-categories-payload.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Stores / Categories")
@Controller("stores/:storeId/categories")
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
  @ApiOperation({ summary: "Create a new category (OWNER/ADMIN Required)" })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(CategoryBasicResponseDto, {
    status: HttpStatus.CREATED,
    description: "Category created successfully.",
  })
  async create(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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
      "Category created successfully.",
    );
  }

  /**
   * GET All Categories for a Store
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Get all active categories (with items) for a specific store (Public)",
    description:
      "Retrieves categories for a store. The storeId parameter can be either a UUID or a store slug for public access.",
  })
  @ApiParam({
    name: "storeId",
    description: "Store UUID or slug",
    type: String,
  })
  @ApiSuccessResponse(CategoryResponseDto, {
    isArray: true,
    description: "List of active categories with included active menu items.",
  })
  async findAll(
    @Param("storeId") storeIdentifier: string,
  ): Promise<StandardApiResponse<CategoryResponseDto[]>> {
    const method = this.findAll.name;

    // Determine if it's a UUID or slug
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(storeIdentifier);

    const identifier = isUuid
      ? { storeId: storeIdentifier }
      : { storeSlug: storeIdentifier };

    const identifierLog = isUuid
      ? `ID ${storeIdentifier}`
      : `Slug ${storeIdentifier}`;
    const includeItems = true;

    this.logger.log(
      `[${method}] Fetching categories for Store [${identifierLog}], includeItems: ${includeItems}`,
    );

    const categories = await this.categoryService.findAll(
      identifier,
      includeItems,
    );

    return StandardApiResponse.success(
      categories,
      "Categories retrieved successfully.",
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific category by ID (Public)" })
  @ApiParam({
    name: "storeId",
    description: "Store UUID or slug",
    type: String,
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to fetch",
    type: String,
    format: "uuid",
  })
  async findOne(
    @Param("storeId") storeIdentifier: string,
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeIdentifier} context.`,
    );

    // Service accepts store identifier (UUID or slug)
    const category = await this.categoryService.findOne(
      categoryId,
      storeIdentifier,
    );
    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      "Category retrieved successfully.",
    );
  }

  @Patch("sort")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Reorder categories and their menu items (OWNER/ADMIN Required)",
  })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(String, {
    description: "Categories and items reordered successfully.",
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category name (OWNER/ADMIN Required)" })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to update",
    type: String,
    format: "uuid",
  })
  @ApiSuccessResponse(
    CategoryBasicResponseDto,
    "Category updated successfully.",
  )
  async update(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
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
      "Category updated successfully.",
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a category (OWNER/ADMIN Required)" })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to delete",
    type: String,
    format: "uuid",
  })
  @ApiSuccessResponse(
    CategoryDeletedResponseDto,
    "Category deleted successfully.",
  )
  async remove(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
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
      "Category deleted successfully.",
    );
  }

  /**
   * ============================================================================
   * TRANSLATION MANAGEMENT ENDPOINTS
   * ============================================================================
   */

  @Patch(":id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update category translations (OWNER or ADMIN)",
    description:
      "Add or update translations for a category. Supports multiple locales: en, zh, my, th",
  })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category",
    type: String,
    format: "uuid",
  })
  @ApiBody({
    type: UpdateCategoryTranslationsDto,
    examples: {
      multipleTranslations: {
        summary: "Multiple locale translations",
        value: {
          translations: [
            { locale: "th", name: "อาหารเรียกน้ำย่อย" },
            { locale: "zh", name: "开胃菜" },
            { locale: "my", name: "အစားအစာ" },
          ],
        },
      },
      singleTranslation: {
        summary: "Single locale translation",
        value: {
          translations: [{ locale: "th", name: "อาหารเรียกน้ำย่อย" }],
        },
      },
    },
  })
  @ApiSuccessResponse(String, "Category translations updated successfully.")
  async updateCategoryTranslations(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
    @Body() dto: UpdateCategoryTranslationsDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.updateCategoryTranslations.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating translations for category ${categoryId}`,
    );

    await this.categoryService.updateCategoryTranslations(
      userId,
      storeId,
      categoryId,
      dto.translations,
    );

    return StandardApiResponse.success(
      undefined,
      "Category translations updated successfully",
    );
  }

  @Delete(":id/translations/:locale")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete a specific translation for a category (OWNER or ADMIN)",
    description:
      "Remove a translation in a specific locale (en, zh, my, th) from a category",
  })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category",
    type: String,
    format: "uuid",
  })
  @ApiParam({
    name: "locale",
    description: "Locale to delete (en, zh, my, th)",
    type: String,
    enum: SUPPORTED_LOCALES,
  })
  @ApiSuccessResponse(String, "Category translation deleted successfully.")
  async deleteCategoryTranslation(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
    @Param("locale", ParseLocalePipe) locale: SupportedLocale,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.deleteCategoryTranslation.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} deleting ${locale} translation for category ${categoryId}`,
    );

    await this.categoryService.deleteCategoryTranslation(
      userId,
      storeId,
      categoryId,
      locale,
    );

    return StandardApiResponse.success(
      undefined,
      `Category translation for locale '${locale}' deleted successfully`,
    );
  }
}
