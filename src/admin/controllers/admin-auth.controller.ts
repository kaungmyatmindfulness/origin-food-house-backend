import { Controller, Post, Get, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";

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
  @ApiOperation({
    summary: "Validate Auth0 token and sync admin user",
    description:
      "Validates admin Auth0 token from separate admin tenant, syncs user to database, and returns internal JWT with permissions",
  })
  @ApiOkResponse({
    description: "Token validated successfully, admin user synced",
    type: ValidateAdminResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid request body" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired Auth0 token" })
  @ApiForbiddenResponse({ description: "Admin account is inactive" })
  async validateToken(
    @Body() dto: ValidateAdminTokenDto,
  ): Promise<ValidateAdminResponseDto> {
    return await this.adminAuthService.validateAndSyncAdmin(dto.auth0Token);
  }

  @Get("profile")
  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current admin profile",
    description: "Returns profile information for the authenticated admin user",
  })
  @ApiOkResponse({
    description: "Admin profile retrieved successfully",
    type: AdminProfileResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Not authenticated" })
  @ApiForbiddenResponse({ description: "Not authorized as admin" })
  async getProfile(@GetUser("adminId") adminId: string) {
    return await this.adminAuthService.getAdminProfile(adminId);
  }

  @Get("permissions")
  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get admin permissions for frontend RBAC",
    description:
      "Returns list of permissions based on admin role for frontend authorization checks",
  })
  @ApiOkResponse({
    description: "Admin permissions retrieved successfully",
    type: AdminPermissionsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Not authenticated" })
  @ApiForbiddenResponse({ description: "Not authorized as admin" })
  async getPermissions(@GetUser("adminId") adminId: string) {
    const permissions =
      await this.adminAuthService.getAdminPermissions(adminId);
    return { permissions };
  }
}
