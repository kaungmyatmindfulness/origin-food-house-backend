import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import {
  ApiAuthWithRoles,
  ApiPublicAction,
  ApiStandardErrors,
} from "../../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { AdminPermissionsResponseDto } from "../dto/admin-permissions-response.dto";
import { AdminProfileResponseDto } from "../dto/admin-profile-response.dto";
import { ValidateAdminResponseDto } from "../dto/validate-admin-response.dto";
import { ValidateAdminTokenDto } from "../dto/validate-admin-token.dto";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { AdminAuthService } from "../services/admin-auth.service";

@ApiTags("Admin Authentication")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("validate")
  @ApiPublicAction(
    ValidateAdminResponseDto,
    "Validate Auth0 token and sync admin user",
    "Token validated successfully, admin user synced",
  )
  @ApiStandardErrors()
  async validateToken(
    @Body() dto: ValidateAdminTokenDto,
  ): Promise<ValidateAdminResponseDto> {
    return await this.adminAuthService.validateAndSyncAdmin(dto.auth0Token);
  }

  @Get("profile")
  @UseGuards(PlatformAdminGuard)
  @ApiAuthWithRoles()
  @ApiSuccessResponse(
    AdminProfileResponseDto,
    "Admin profile retrieved successfully",
  )
  async getProfile(@GetUser("adminId") adminId: string) {
    return await this.adminAuthService.getAdminProfile(adminId);
  }

  @Get("permissions")
  @UseGuards(PlatformAdminGuard)
  @ApiAuthWithRoles()
  @ApiSuccessResponse(
    AdminPermissionsResponseDto,
    "Admin permissions retrieved successfully",
  )
  async getPermissions(@GetUser("adminId") adminId: string) {
    const permissions =
      await this.adminAuthService.getAdminPermissions(adminId);
    return { permissions };
  }
}
