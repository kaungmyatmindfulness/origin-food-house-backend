import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RequestWithUser } from "src/auth/types";
import {
  ApiAuth,
  ApiAuthWithRoles,
  ApiResourceErrors,
  ApiStoreIdParam,
  ApiUuidParam,
} from "src/common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { UseTierLimit } from "src/common/decorators/tier-limit.decorator";
import { StandardApiErrorDetails } from "src/common/dto/standard-api-error-details.dto";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import { TierLimitGuard } from "src/common/guards/tier-limit.guard";
import {
  Prisma,
  UserStore,
  StaffInvitation,
  User,
} from "src/generated/prisma/client";
import { GetProfileQueryDto } from "src/user/dto/get-profile-query.dto";
import { UserProfileResponseDto } from "src/user/dto/user-profile-response.dto";

import { AddUserToStoreDto } from "./dto/add-user-to-store.dto";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { SuspendUserDto } from "./dto/suspend-user.dto";
import { UserPublicPayload } from "./types/user-payload.types";
import { UserService } from "./user.service";

@ApiTags("Users")
@Controller("users")
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  UserProfileResponseDto,
)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user (sends verification email)" })
  @ApiCreatedResponse({
    description: "User registered successfully. Verification email sent.",
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({
    description:
      "Validation error (e.g., email exists, disposable domain, invalid input)",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error (e.g., failed to send email)",
  })
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<StandardApiResponse<UserPublicPayload>> {
    this.logger.log(`Registration attempt for email: ${createUserDto.email}`);
    const user = await this.userService.createUser(createUserDto);
    return StandardApiResponse.success(
      user,
      "User registered successfully. Please check your email to verify your account.",
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("add-to-store")
  @ApiAuthWithRoles()
  @ApiSuccessResponse(
    StandardApiResponse,
    "User assigned/updated in store successfully.",
  )
  @ApiResourceErrors()
  async addUserToStore(
    @Body() dto: AddUserToStoreDto,
  ): Promise<StandardApiResponse<UserStore>> {
    this.logger.log(
      `Request to add/update User ID ${dto.userId} in Store ID ${dto.storeId}`,
    );
    const userStore = await this.userService.addUserToStore(dto);
    return StandardApiResponse.success(
      userStore,
      "User role in store updated successfully.",
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/stores")
  @ApiAuthWithRoles()
  @ApiOperation({
    summary: "Get all store memberships for a specific user (Protected)",
  })
  @ApiUuidParam("id", "ID (UUID) of the target user")
  @ApiSuccessResponse(
    StandardApiResponse,
    "List of user store memberships retrieved.",
  )
  @ApiResourceErrors()
  async getUserStores(
    @Param("id", new ParseUUIDPipe({ version: "7" })) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<
    StandardApiResponse<
      Array<UserStore & { store: Prisma.StoreGetPayload<true> }>
    >
  > {
    this.logger.log(
      `Request for stores of User ID: ${userId} by User ID: ${req.user.sub}`,
    );
    const userStores = await this.userService.getUserStores(userId);
    if (!userStores || userStores.length === 0) {
      const userExists = await this.userService.findById(userId);
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }
    }
    return StandardApiResponse.success(
      userStores,
      "User stores retrieved successfully.",
    );
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: "Get current logged-in user profile, optionally scoped to a store",
  })
  @ApiSuccessResponse(
    UserProfileResponseDto,
    "Current user profile retrieved successfully.",
  )
  @ApiQuery({
    name: "storeId",
    required: false,
    type: String,
    format: "uuid",
    description:
      "Optional: ID (UUID) of the store to get user context (e.g., role) for.",
    example: "018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e",
  })
  async getCurrentUser(
    @Req() req: RequestWithUser,
    @Query() query: GetProfileQueryDto,
  ): Promise<StandardApiResponse<UserProfileResponseDto>> {
    const userId = req.user.sub;
    const { storeId } = query;
    const method = this.getCurrentUser.name;

    if (storeId) {
      this.logger.log(
        `[${method}] Request for profile of User ID: ${userId} with Store Context ID: ${storeId} from query`,
      );
    } else {
      this.logger.log(
        `[${method}] Request for profile of User ID: ${userId} without specific store context from query`,
      );
    }

    const userProfile = await this.userService.findUserProfile(userId, storeId);

    return StandardApiResponse.success(
      userProfile,
      "Profile retrieved successfully.",
    );
  }

  @Post("stores/:storeId/invite-staff")
  @UseGuards(JwtAuthGuard, TierLimitGuard)
  @UseTierLimit({ resource: "staff", increment: 1 })
  @ApiAuthWithRoles()
  @ApiOperation({
    summary: "Invite a staff member to join a store (Owner/Admin only)",
  })
  @ApiStoreIdParam()
  @ApiCreatedResponse({
    description: "Staff invitation sent successfully.",
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or user already a member",
  })
  async inviteStaff(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: InviteStaffDto,
  ): Promise<StandardApiResponse<StaffInvitation | null>> {
    const method = this.inviteStaff.name;
    this.logger.log(
      `[${method}] User ${userId} inviting ${dto.email} to store ${storeId} as ${dto.role}`,
    );

    const invitation = await this.userService.inviteStaff(
      userId,
      storeId,
      dto.email,
      dto.role,
    );

    if (invitation === null) {
      return StandardApiResponse.success(
        null,
        "User already exists and has been added to the store.",
      );
    }

    return StandardApiResponse.success(
      invitation,
      "Staff invitation sent successfully.",
    );
  }

  @Patch("stores/:storeId/users/:targetUserId/role")
  @UseGuards(JwtAuthGuard)
  @ApiAuthWithRoles()
  @ApiOperation({ summary: "Change a user's role within a store (Owner only)" })
  @ApiStoreIdParam()
  @ApiUuidParam("targetUserId", "ID (UUID) of the user whose role to change")
  @ApiSuccessResponse(StandardApiResponse, "User role updated successfully.")
  @ApiResourceErrors()
  @ApiBadRequestResponse({
    description: "Cannot change own role",
  })
  async changeRole(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("targetUserId", new ParseUUIDPipe({ version: "7" }))
    targetUserId: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<StandardApiResponse<UserStore>> {
    const method = this.changeRole.name;
    this.logger.log(
      `[${method}] User ${userId} changing role of ${targetUserId} to ${dto.role} in store ${storeId}`,
    );

    const updated = await this.userService.changeUserRole(
      userId,
      targetUserId,
      storeId,
      dto.role,
    );

    return StandardApiResponse.success(
      updated,
      "User role updated successfully.",
    );
  }

  @Patch("stores/:storeId/users/:targetUserId/suspend")
  @UseGuards(JwtAuthGuard)
  @ApiAuthWithRoles()
  @ApiOperation({ summary: "Suspend a user account (Owner/Admin only)" })
  @ApiStoreIdParam()
  @ApiUuidParam("targetUserId", "ID (UUID) of the user to suspend")
  @ApiSuccessResponse(StandardApiResponse, "User suspended successfully.")
  @ApiResourceErrors()
  @ApiBadRequestResponse({
    description: "Cannot suspend yourself",
  })
  async suspendUser(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("targetUserId", new ParseUUIDPipe({ version: "7" }))
    targetUserId: string,
    @Body() dto: SuspendUserDto,
  ): Promise<StandardApiResponse<User>> {
    const method = this.suspendUser.name;
    this.logger.log(
      `[${method}] User ${userId} suspending ${targetUserId} in store ${storeId}. Reason: ${dto.reason}`,
    );

    const user = await this.userService.suspendUser(
      userId,
      targetUserId,
      storeId,
      dto.reason,
    );

    return StandardApiResponse.success(user, "User suspended successfully.");
  }

  @Patch("stores/:storeId/users/:targetUserId/reactivate")
  @UseGuards(JwtAuthGuard)
  @ApiAuthWithRoles()
  @ApiOperation({
    summary: "Reactivate a suspended user account (Owner/Admin only)",
  })
  @ApiStoreIdParam()
  @ApiUuidParam("targetUserId", "ID (UUID) of the user to reactivate")
  @ApiSuccessResponse(StandardApiResponse, "User reactivated successfully.")
  @ApiResourceErrors()
  async reactivateUser(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Param("targetUserId", new ParseUUIDPipe({ version: "7" }))
    targetUserId: string,
  ): Promise<StandardApiResponse<User>> {
    const method = this.reactivateUser.name;
    this.logger.log(
      `[${method}] User ${userId} reactivating ${targetUserId} in store ${storeId}`,
    );

    const user = await this.userService.reactivateUser(
      userId,
      targetUserId,
      storeId,
    );

    return StandardApiResponse.success(user, "User reactivated successfully.");
  }
}
