import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Store information for user's store association
 */
export class UserStoreInfoDto {
  @ApiProperty({ description: "Store name" })
  name: string;
}

/**
 * Store details for user's store association
 */
export class UserStoreDetailsDto {
  @ApiProperty({ description: "Store ID" })
  id: string;

  @ApiProperty({ description: "Store slug" })
  slug: string;

  @ApiPropertyOptional({
    description: "Store information",
    type: UserStoreInfoDto,
  })
  information: UserStoreInfoDto | null;
}

/**
 * User's store association
 */
export class UserStoreAssociationDto {
  @ApiProperty({ description: "User store relation ID" })
  id: string;

  @ApiProperty({ description: "User ID" })
  userId: string;

  @ApiProperty({ description: "Store ID" })
  storeId: string;

  @ApiProperty({ description: "User role in store" })
  role: string;

  @ApiProperty({ description: "Store details", type: UserStoreDetailsDto })
  store: UserStoreDetailsDto;
}

/**
 * User counts
 */
export class UserCountsDto {
  @ApiProperty({ description: "Number of stores user belongs to" })
  userStores: number;
}

/**
 * User list item response (for listing users)
 */
export class UserResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "User name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({ description: "User suspended status" })
  isSuspended: boolean;

  @ApiPropertyOptional({
    type: Date,
    description: "Suspended at timestamp",
    nullable: true,
  })
  suspendedAt: Date | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;

  @ApiProperty({
    description: "User's store associations",
    type: [UserStoreAssociationDto],
  })
  userStores: UserStoreAssociationDto[];

  @ApiProperty({ description: "User counts", type: UserCountsDto })
  _count: UserCountsDto;
}

/**
 * User detail response (for single user)
 */
export class UserDetailResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "User name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({ description: "User suspended status" })
  isSuspended: boolean;

  @ApiPropertyOptional({
    type: Date,
    description: "Suspended at timestamp",
    nullable: true,
  })
  suspendedAt: Date | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;

  @ApiProperty({
    description: "User's store associations",
    type: [UserStoreAssociationDto],
  })
  userStores: UserStoreAssociationDto[];

  @ApiProperty({ description: "User counts", type: UserCountsDto })
  _count: UserCountsDto;
}

/**
 * User action response (for suspend, ban, reactivate)
 */
export class UserActionResponseDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "User name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({ description: "User suspended status" })
  isSuspended: boolean;

  @ApiPropertyOptional({
    type: Date,
    description: "Suspended at timestamp",
    nullable: true,
  })
  suspendedAt: Date | null;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * Admin info nested in suspension history
 */
export class UserAdminInfoDto {
  @ApiProperty({ description: "Admin ID" })
  id: string;

  @ApiProperty({ description: "Admin email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "Admin name",
    nullable: true,
  })
  name: string | null;
}

/**
 * User suspension history item
 */
export class UserSuspensionHistoryItemDto {
  @ApiProperty({ description: "Suspension ID" })
  id: string;

  @ApiProperty({ description: "Suspension reason" })
  reason: string;

  @ApiProperty({ description: "Suspended at timestamp" })
  suspendedAt: Date;

  @ApiPropertyOptional({
    type: Date,
    description: "Reactivated at timestamp",
    nullable: true,
  })
  reactivatedAt: Date | null;

  @ApiPropertyOptional({
    description: "Admin who suspended",
    type: UserAdminInfoDto,
  })
  suspendedByAdmin: UserAdminInfoDto | null;

  @ApiPropertyOptional({
    description: "Admin who reactivated",
    type: UserAdminInfoDto,
  })
  reactivatedByAdmin: UserAdminInfoDto | null;
}

/**
 * User info in activity response
 */
export class ActivityUserInfoDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "User name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "User suspended status" })
  isSuspended: boolean;

  @ApiPropertyOptional({
    type: Date,
    description: "Suspended at timestamp",
    nullable: true,
  })
  suspendedAt: Date | null;
}

/**
 * User activity response
 */
export class UserActivityResponseDto {
  @ApiProperty({ description: "User info", type: ActivityUserInfoDto })
  user: ActivityUserInfoDto;

  @ApiProperty({ description: "Number of stores user belongs to" })
  storeCount: number;

  @ApiProperty({
    description: "Suspension history",
    type: [UserSuspensionHistoryItemDto],
  })
  suspensionHistory: UserSuspensionHistoryItemDto[];
}
