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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { Express } from 'express';
import { UploadImageResponseDto } from './dto/upload-image-response.dto';

import { imageFileFilter } from 'src/common/utils/file-filter.utils';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: imageFileFilter,
    }),
  )
  @ApiOperation({ summary: 'Upload an image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to upload (jpg, jpeg, png, webp)',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image uploaded successfully, returns the image URL.',
    // Specify the type using the generic BaseApiResponse and the specific data DTO
    schema: {
      allOf: [
        { $ref: getSchemaPath(BaseApiResponse) }, // Reference the base structure
        {
          // Specify the generic type T as UploadImageResponseDto
          properties: {
            data: { $ref: getSchemaPath(UploadImageResponseDto) },
            errors: { type: 'array', nullable: true, example: null }, // Explicitly show errors as null
            status: { type: 'string', example: 'success' },
            message: { type: 'string', example: 'Image uploaded successfully' },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file type, size, or no file uploaded.',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Image processing or upload failed.',
  })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES }),
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<BaseApiResponse<UploadImageResponseDto>> {
    const method = this.uploadImage.name;
    this.logger.log(
      `[${method}] Received image upload request: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`,
    );

    const mediumImageUrl = await this.uploadService.uploadImage(file);

    return BaseApiResponse.success(
      { imageUrl: mediumImageUrl },
      'Image uploaded successfully',
    );
  }
}
