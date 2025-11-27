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
import { ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import {
  ApiAuthWithRoles,
  ApiGetAll,
  ApiGetOneAuth,
  ApiAction,
  ApiResourceErrors,
} from "src/common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { GetUser } from "src/common/decorators/get-user.decorator";

import { BanUserDto } from "../dto/ban-user.dto";
import { ListUsersDto } from "../dto/list-users.dto";
import { ReactivateUserDto } from "../dto/reactivate-user.dto";
import { SuspendUserDto } from "../dto/suspend-user.dto";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { AdminAuditInterceptor } from "../interceptors/admin-audit.interceptor";
import { AdminUserService } from "../services/admin-user.service";

// Placeholder response class for untyped responses
class UserResponseDto {}
class UserDetailResponseDto {}
class UserActionResponseDto {}
class UserActivityResponseDto {}

@ApiTags("Admin - User Management")
@Controller("admin/users")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiAuthWithRoles()
  @ApiGetAll(UserResponseDto, "users", {
    summary: "List all users",
    description: "Users retrieved successfully",
  })
  async listUsers(@Query() query: ListUsersDto) {
    return await this.adminUserService.listUsers(query);
  }

  @Get(":id")
  @ApiGetOneAuth(UserDetailResponseDto, "user", {
    summary: "Get user detail",
    description: "User detail retrieved successfully",
  })
  async getUserDetail(@Param("id") id: string) {
    return await this.adminUserService.getUserDetail(id);
  }

  @Post(":id/suspend")
  @ApiAction(UserActionResponseDto, "suspend", "user", {
    summary: "Suspend user",
    description: "User suspended successfully",
  })
  async suspendUser(
    @Param("id") id: string,
    @Body() dto: SuspendUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.suspendUser(adminId, id, dto.reason);
  }

  @Post(":id/ban")
  @ApiAction(UserActionResponseDto, "ban", "user", {
    summary: "Ban user",
    description: "User banned successfully",
  })
  async banUser(
    @Param("id") id: string,
    @Body() dto: BanUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.banUser(adminId, id, dto.reason);
  }

  @Post(":id/reactivate")
  @ApiAction(UserActionResponseDto, "reactivate", "user", {
    summary: "Reactivate user",
    description: "User reactivated successfully",
  })
  async reactivateUser(
    @Param("id") id: string,
    @Body() dto: ReactivateUserDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.reactivateUser(adminId, id, dto.note);
  }

  @Post(":id/password-reset")
  @ApiAction(UserActionResponseDto, "force password reset for", "user", {
    summary: "Force password reset",
    description: "Password reset forced successfully",
  })
  async forcePasswordReset(
    @Param("id") id: string,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminUserService.forcePasswordReset(adminId, id);
  }

  @Get(":id/activity")
  @ApiAuthWithRoles()
  @ApiSuccessResponse(
    UserActivityResponseDto,
    "User activity retrieved successfully",
  )
  @ApiResourceErrors()
  async getUserActivity(@Param("id") id: string) {
    return await this.adminUserService.getUserActivity(id);
  }
}
