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
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { MenuItem as MenuItemModel } from "src/generated/prisma/client";
import { CategoryResponseDto } from "src/menu/dto/category-response.dto";
import { CustomizationGroupResponseDto } from "src/menu/dto/customization-group-response.dto";
import { CustomizationOptionResponseDto } from "src/menu/dto/customization-option-response.dto";
import { MenuItemDeletedResponseDto } from "src/menu/dto/menu-item-deleted-response.dto";
import { MenuItemResponseDto } from "src/menu/dto/menu-item-response.dto";

import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import {
  UpdateMenuItemTranslationsDto,
  UpdateCustomizationGroupTranslationsDto,
  UpdateCustomizationOptionTranslationsDto,
} from "./dto/update-translations.dto";
import { MenuService } from "./menu.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UseTierLimit } from "../common/decorators/tier-limit.decorator";
import { TierLimitGuard } from "../common/guards/tier-limit.guard";

@ApiTags("Menu")
@Controller("menu-items")
@ApiExtraModels(
  MenuItemDeletedResponseDto,
  MenuItemResponseDto,
  CategoryResponseDto,
  CustomizationGroupResponseDto,
  CustomizationOptionResponseDto,
  StandardApiErrorDetails,
  StandardApiResponse,
)
export class MenuController {
  private readonly logger = new Logger(MenuController.name);

  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: "Get all menu items for a specific store (Public)" })
  @ApiQuery({
    name: "storeId",
    required: true,
    type: String,
    format: "uuid",
    description: "ID (UUID) of the store whose menu items to fetch",
    example: "018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e",
  })
  @ApiSuccessResponse(MenuItemResponseDto, {
    isArray: true,
    description: "List of menu items retrieved successfully.",
  })
  async getStoreMenuItems(
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<MenuItemModel[]>> {
    const method = this.getStoreMenuItems.name;
    this.logger.log(`[${method}] Fetching menu items for Store ${storeId}`);
    const items = await this.menuService.getStoreMenuItems(storeId);

    return StandardApiResponse.success(
      items,
      "Menu items retrieved successfully",
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single menu item by ID (Public)" })
  @ApiSuccessResponse(
    MenuItemResponseDto,
    "Menu item details retrieved successfully.",
  )
  async getMenuItemById(
    @Param("id", new ParseUUIDPipe({ version: "7" })) itemId: string,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.getMenuItemById.name;
    this.logger.log(`[${method}] Fetching menu item by ID ${itemId}`);
    const item = await this.menuService.getMenuItemById(itemId);
    return StandardApiResponse.success(
      item,
      "Menu item retrieved successfully",
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, TierLimitGuard)
  @UseTierLimit({ resource: "menuItems", increment: 1 })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a menu item (OWNER or ADMIN)" })
  @ApiSuccessResponse(String, {
    status: HttpStatus.CREATED,
    description: "Menu item created successfully.",
  })
  async createMenuItem(
    @Req() req: RequestWithUser,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: CreateMenuItemDto,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.createMenuItem.name;
    const userId = req.user.sub;

    this.logger.log(
      `[${method}] User ${userId} creating menu item in Store ${storeId}`,
    );
    const newItem = await this.menuService.createMenuItem(userId, storeId, dto);
    return StandardApiResponse.success(
      newItem,
      "Menu item created successfully",
    );
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a menu item (OWNER or ADMIN)" })
  @ApiSuccessResponse(MenuItemResponseDto, {
    description: "Menu item updated successfully.",
  })
  async updateMenuItem(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) itemId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.updateMenuItem.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating menu item ${itemId} in Store ${storeId}`,
    );
    const updatedItem = await this.menuService.updateMenuItem(
      userId,
      storeId,
      itemId,
      dto,
    );
    return StandardApiResponse.success(
      updatedItem,
      "Menu item updated successfully",
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a menu item (OWNER or ADMIN)" })
  @ApiSuccessResponse(
    MenuItemDeletedResponseDto,
    "Menu item deleted successfully.",
  )
  async deleteMenuItem(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) itemId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.deleteMenuItem.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} deleting menu item ${itemId} from Store ${storeId}`,
    );
    const deletedResult = await this.menuService.deleteMenuItem(
      userId,
      storeId,
      itemId,
    );
    return StandardApiResponse.success(
      deletedResult,
      "Menu item deleted successfully",
    );
  }

  /**
   * ============================================================================
   * TRANSLATION MANAGEMENT ENDPOINTS
   * ============================================================================
   */

  @Put(":id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update menu item translations (OWNER or ADMIN)",
    description:
      "Add or update translations for a menu item. Supports multiple locales: en, zh, my, th",
  })
  @ApiBody({
    type: UpdateMenuItemTranslationsDto,
    examples: {
      withDescriptions: {
        summary: "Translations with names and descriptions",
        value: {
          translations: [
            {
              locale: "th",
              name: "ผัดไทย",
              description: "ก๋วยเตี๋ยวผัดไทยรสอร่อย",
            },
            {
              locale: "zh",
              name: "泰式炒河粉",
              description: "美味的泰国炒面",
            },
          ],
        },
      },
      namesOnly: {
        summary: "Translations with names only",
        value: {
          translations: [
            { locale: "th", name: "ผัดไทย" },
            { locale: "zh", name: "泰式炒河粉" },
          ],
        },
      },
    },
  })
  @ApiSuccessResponse(String, "Menu item translations updated successfully.")
  async updateMenuItemTranslations(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) itemId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: UpdateMenuItemTranslationsDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.updateMenuItemTranslations.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating translations for menu item ${itemId}`,
    );

    await this.menuService.updateMenuItemTranslations(
      userId,
      storeId,
      itemId,
      dto.translations,
    );

    return StandardApiResponse.success(
      undefined,
      "Menu item translations updated successfully",
    );
  }

  @Delete(":id/translations/:locale")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete a specific translation for a menu item (OWNER or ADMIN)",
    description:
      "Remove a translation in a specific locale (en, zh, my, th) from a menu item",
  })
  @ApiParam({
    name: "locale",
    description: "Locale to delete (en, zh, my, th)",
    type: String,
    enum: SUPPORTED_LOCALES,
  })
  @ApiSuccessResponse(String, "Menu item translation deleted successfully.")
  async deleteMenuItemTranslation(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) itemId: string,
    @Param("locale", ParseLocalePipe) locale: SupportedLocale,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.deleteMenuItemTranslation.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} deleting ${locale} translation for menu item ${itemId}`,
    );

    await this.menuService.deleteMenuItemTranslation(
      userId,
      storeId,
      itemId,
      locale,
    );

    return StandardApiResponse.success(
      undefined,
      `Menu item translation for locale '${locale}' deleted successfully`,
    );
  }
}

/**
 * Controller for customization group and option translations
 */
@ApiTags("Menu - Customizations")
@Controller("customizations")
export class CustomizationController {
  private readonly logger = new Logger(CustomizationController.name);

  constructor(private readonly menuService: MenuService) {}

  @Put("groups/:id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update customization group translations (OWNER or ADMIN)",
    description:
      "Add or update translations for a customization group (e.g., 'Size', 'Spice Level')",
  })
  @ApiSuccessResponse(
    String,
    "Customization group translations updated successfully.",
  )
  async updateGroupTranslations(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) groupId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: UpdateCustomizationGroupTranslationsDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.updateGroupTranslations.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating translations for customization group ${groupId}`,
    );

    await this.menuService.updateCustomizationGroupTranslations(
      userId,
      storeId,
      groupId,
      dto.translations,
    );

    return StandardApiResponse.success(
      undefined,
      "Customization group translations updated successfully",
    );
  }

  @Put("options/:id/translations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update customization option translations (OWNER or ADMIN)",
    description:
      "Add or update translations for a customization option (e.g., 'Large', 'Spicy')",
  })
  @ApiSuccessResponse(
    String,
    "Customization option translations updated successfully.",
  )
  async updateOptionTranslations(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) optionId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: UpdateCustomizationOptionTranslationsDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.updateOptionTranslations.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating translations for customization option ${optionId}`,
    );

    await this.menuService.updateCustomizationOptionTranslations(
      userId,
      storeId,
      optionId,
      dto.translations,
    );

    return StandardApiResponse.success(
      undefined,
      "Customization option translations updated successfully",
    );
  }
}
