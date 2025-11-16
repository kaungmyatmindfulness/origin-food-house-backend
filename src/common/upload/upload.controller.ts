import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  Logger,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiExtraModels,
} from "@nestjs/swagger";
import { Express } from "express";

import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import { imageFileFilter } from "src/common/utils/file-filter.utils";

import { UploadImageResponseDto } from "./dto/upload-image-response.dto";
import { UploadService } from "./upload.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB;

@ApiTags("Upload")
@Controller("upload")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized." })
@ApiExtraModels(UploadImageResponseDto)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: imageFileFilter,
    }),
  )
  @ApiOperation({
    summary: "Upload an image file with configurable resizing",
    description:
      "Uploads an image file and generates optimized versions based on the selected preset. " +
      "Supports menu items, store logos, cover photos, and payment proofs (no resize).",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Image file to upload (jpg, jpeg, png, webp) with optional size preset",
    required: true,
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Image file (max 10MB)",
        },
        sizePreset: {
          type: "string",
          enum: ["menu-item", "store-logo", "cover-photo", "payment-proof"],
          description:
            "Size preset for image resizing (defaults to 'menu-item')",
          default: "menu-item",
        },
      },
      required: ["file"],
    },
  })
  @ApiSuccessResponse(
    UploadImageResponseDto,
    "Image uploaded and processed successfully",
  )
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: ".(png|jpeg|jpg|webp|pdf)" }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<StandardApiResponse<UploadImageResponseDto>> {
    const method = this.uploadImage.name;
    this.logger.log(
      `[${method}] Received file upload request: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`,
    );

    const result = await this.uploadService.uploadImage(file);

    return StandardApiResponse.success(
      result,
      "Image uploaded and processed successfully",
    );
  }
}
