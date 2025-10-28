import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";

import { BanUserDto } from "../dto/ban-user.dto";
import { ListUsersDto } from "../dto/list-users.dto";
import { ReactivateUserDto } from "../dto/reactivate-user.dto";
import { SuspendUserDto } from "../dto/suspend-user.dto";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { AdminAuditInterceptor } from "../interceptors/admin-audit.interceptor";
import { AdminUserService } from "../services/admin-user.service";

@ApiTags("Admin - User Management")
@Controller("admin/users")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@ApiBearerAuth()
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({
    summary: "List all users",
    description: "Get paginated list of all users with filters",
  })
  @ApiOkResponse({ description: "Users retrieved successfully" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async listUsers(@Query() query: ListUsersDto) {
    return await this.adminUserService.listUsers(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get user detail",
    description: "Get detailed information for a specific user",
  })
  @ApiOkResponse({ description: "User detail retrieved successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getUserDetail(@Param("id") id: string) {
    return await this.adminUserService.getUserDetail(id);
  }

  @Post(":id/suspend")
  @ApiOperation({
    summary: "Suspend user",
    description: "Temporarily suspend a user account",
  })
  @ApiOkResponse({ description: "User suspended successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiBadRequestResponse({ description: "User is already suspended" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async suspendUser(
    @Param("id") id: string,
    @Body() dto: SuspendUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.suspendUser(adminId, id, dto.reason);
  }

  @Post(":id/ban")
  @ApiOperation({
    summary: "Ban user",
    description: "Permanently ban a user from the platform",
  })
  @ApiOkResponse({ description: "User banned successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async banUser(
    @Param("id") id: string,
    @Body() dto: BanUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.banUser(adminId, id, dto.reason);
  }

  @Post(":id/reactivate")
  @ApiOperation({
    summary: "Reactivate user",
    description: "Reactivate a suspended user account",
  })
  @ApiOkResponse({ description: "User reactivated successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiBadRequestResponse({ description: "User is not suspended" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async reactivateUser(
    @Param("id") id: string,
    @Body() dto: ReactivateUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.reactivateUser(adminId, id, dto.note);
  }

  @Post(":id/password-reset")
  @ApiOperation({
    summary: "Force password reset",
    description: "Invalidate user JWT tokens to force re-authentication",
  })
  @ApiOkResponse({ description: "Password reset forced successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async forcePasswordReset(
    @Param("id") id: string,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.forcePasswordReset(adminId, id);
  }

  @Get(":id/activity")
  @ApiOperation({
    summary: "Get user activity",
    description: "Get activity history and statistics for a specific user",
  })
  @ApiOkResponse({ description: "User activity retrieved successfully" })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getUserActivity(@Param("id") id: string) {
    return await this.adminUserService.getUserActivity(id);
  }
}
