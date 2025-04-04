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
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

@ApiTags('stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stores')
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Post()
  @ApiOperation({ summary: 'Create a store (creator is OWNER)' })
  async createStore(
    @Req() req: RequestWithUser,
    @Body() dto: CreateStoreDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const store = await this.storeService.createStore(userId, dto);
    return {
      status: 'success',
      data: store,
      message: 'Store created successfully. You are the OWNER.',
      error: null,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a store (OWNER or ADMIN only)' })
  async updateStore(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) storeId: number,
    @Body() dto: UpdateStoreDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const updated = await this.storeService.updateStore(userId, storeId, dto);
    return {
      status: 'success',
      data: updated,
      message: 'Store updated',
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
    @Param('id', ParseIntPipe) storeId: number,
    @Body() dto: InviteOrAssignRoleDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const result = await this.storeService.inviteOrAssignRoleByEmail(
      userId,
      storeId,
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
