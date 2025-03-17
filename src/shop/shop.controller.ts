import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShopService } from './shop.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

@ApiTags('shops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shop (creator is OWNER)' })
  async createShop(
    @Req() req: RequestWithUser,
    @Body() dto: CreateShopDto,
  ): Promise<BaseApiResponse<any>> {
    const userId = req.user.id;
    const shop = await this.shopService.createShop(userId, dto);
    return {
      status: 'success',
      data: shop,
      message: 'Shop created successfully. You are the OWNER.',
      error: null,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a shop (OWNER or ADMIN only)' })
  async updateShop(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) shopId: number,
    @Body() dto: UpdateShopDto,
  ): Promise<BaseApiResponse<any>> {
    const userId = req.user.id;
    const updated = await this.shopService.updateShop(userId, shopId, dto);
    return {
      status: 'success',
      data: updated,
      message: 'Shop updated',
      error: null,
    };
  }

  @Post(':id/invite-by-email')
  @ApiOperation({
    summary:
      'Invite/assign role by email; OWNER can assign any role, ADMIN can assign SALE/CHEF',
  })
  async inviteOrAssignRoleByEmail(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) shopId: number,
    @Body() dto: InviteOrAssignRoleDto,
  ): Promise<BaseApiResponse<any>> {
    const userId = req.user.id;
    const result = await this.shopService.inviteOrAssignRoleByEmail(
      userId,
      shopId,
      dto,
    );

    return {
      status: 'success',
      data: result,
      message: `User with email=${dto.email} assigned role ${dto.role}`,
      error: null,
    };
  }
}
