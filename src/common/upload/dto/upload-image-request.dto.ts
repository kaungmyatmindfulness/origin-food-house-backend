import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

import { ImageSizePreset } from "../types/image-size-config.type";

export class UploadImageRequestDto {
  @ApiProperty({
    type: "string",
    format: "binary",
    description:
      "The image file to upload (jpg, jpeg, png, webp are validated). Max size: 10MB.",
    required: true,
  })
  file: Express.Multer.File;

  @ApiPropertyOptional({
    description:
      "Image size preset to use for resizing. Determines target dimensions for medium and thumbnail versions.",
    enum: ["menu-item", "store-logo", "cover-photo", "payment-proof"],
    default: "menu-item",
    example: "menu-item",
  })
  @IsOptional()
  @IsEnum(["menu-item", "store-logo", "cover-photo", "payment-proof"])
  sizePreset?: ImageSizePreset;
}
