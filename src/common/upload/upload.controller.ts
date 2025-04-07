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
  ApiExtraModels,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { Express } from 'express';
import { UploadImageResponseDto } from './dto/upload-image-response.dto';

import { imageFileFilter } from 'src/common/utils/file-filter.utils';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB;

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
@ApiExtraModels(UploadImageResponseDto)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
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
  @ApiSuccessResponse(UploadImageResponseDto, 'Image uploaded successfully')
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
  ): Promise<StandardApiResponse<UploadImageResponseDto>> {
    const method = this.uploadImage.name;
    this.logger.log(
      `[${method}] Received image upload request: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`,
    );

    const mediumImageUrl = await this.uploadService.uploadImage(file);

    return StandardApiResponse.success(
      { imageUrl: mediumImageUrl },
      'Image uploaded successfully',
    );
  }
}
