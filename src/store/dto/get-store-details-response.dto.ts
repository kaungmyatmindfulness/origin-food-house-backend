import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import { SuspensionStatus } from "src/generated/prisma/client";

import { StoreInformationResponseDto } from "./store-information-response.dto";
import { StoreSettingResponseDto } from "./store-setting-response.dto";

export class GetStoreDetailsResponseDto {
  @ApiProperty({ format: "uuid", description: "Store's unique identifier" })
  id: string;

  @ApiProperty({ description: "Store's unique URL slug", example: "demo-cafe" })
  slug: string;

  @ApiProperty({
    enum: SuspensionStatus,
    example: SuspensionStatus.ACTIVE,
    description: "Current suspension status of the store",
  })
  suspensionStatus: SuspensionStatus;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: "Date when the store was suspended",
  })
  suspendedAt?: Date | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Reason for store suspension",
  })
  suspensionReason?: string | null;

  @ApiProperty({ type: () => StoreInformationResponseDto, nullable: true })
  @Type(() => StoreInformationResponseDto)
  information?: StoreInformationResponseDto | null;

  @ApiProperty({ type: () => StoreSettingResponseDto, nullable: true })
  @Type(() => StoreSettingResponseDto)
  setting?: StoreSettingResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
