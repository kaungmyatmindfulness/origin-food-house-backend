import { ApiProperty } from "@nestjs/swagger";

import { ImageMetadata, VersionMetadata } from "../types/image-metadata.type";
import { ImageSizeVersion } from "../types/image-size-config.type";

export class VersionMetadataDto implements VersionMetadata {
  @ApiProperty({
    description: "Width in pixels",
    example: 400,
    required: false,
  })
  width?: number;

  @ApiProperty({
    description: "Height in pixels",
    example: 300,
    required: false,
  })
  height?: number;

  @ApiProperty({
    description: "File size in bytes",
    example: 51200,
    required: false,
  })
  size?: number;
}

export class ImageMetadataDto implements ImageMetadata {
  @ApiProperty({
    description: "Original image width in pixels",
    example: 1920,
    required: false,
  })
  originalWidth?: number;

  @ApiProperty({
    description: "Original image height in pixels",
    example: 1080,
    required: false,
  })
  originalHeight?: number;

  @ApiProperty({
    description: "Image format (e.g., 'jpeg', 'png', 'webp', 'pdf')",
    example: "jpeg",
    required: false,
  })
  format?: string;

  @ApiProperty({
    description: "Original file size in bytes",
    example: 2048576,
  })
  originalSize: number;

  @ApiProperty({
    description: "Whether the image has transparency (alpha channel)",
    example: false,
    required: false,
  })
  hasAlpha?: boolean;

  @ApiProperty({
    description: "Color space of the image (e.g., 'srgb', 'cmyk')",
    example: "srgb",
    required: false,
  })
  space?: string;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description:
      "Generated versions with their metadata (dimensions and sizes, no URLs)",
    example: {
      small: {
        width: 400,
        height: 300,
        size: 51200,
      },
      medium: {
        width: 800,
        height: 600,
        size: 102400,
      },
      large: {
        width: 1200,
        height: 900,
        size: 204800,
      },
    },
  })
  versions: Partial<Record<ImageSizeVersion, VersionMetadata>>;
}

export class UploadImageResponseDto {
  @ApiProperty({
    description:
      "Base S3 path without version suffix. Frontend constructs full URLs using: baseUrl + basePath + '-' + size + '.webp'",
    example: "uploads/abc-123-def-456",
  })
  basePath: string;

  @ApiProperty({
    description: "Available image sizes generated for this upload",
    example: ["small", "medium", "large"],
    type: [String],
  })
  availableSizes: ImageSizeVersion[];

  @ApiProperty({
    description:
      "Primary/default size for this preset (recommended size to display)",
    example: "medium",
    enum: ["original", "small", "medium", "large"],
  })
  primarySize: ImageSizeVersion;

  @ApiProperty({
    description:
      "Metadata about the uploaded image including dimensions, file sizes, and format details for all generated versions.",
    type: ImageMetadataDto,
  })
  metadata: ImageMetadataDto;
}
