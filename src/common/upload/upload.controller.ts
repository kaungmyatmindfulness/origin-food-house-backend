import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Generic upload endpoint returning S3 keys' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
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
    status: 200,
    description: 'Image was uploaded successfully.',
    schema: {
      example: {
        status: 'success',
        data: {
          imageKey: 'uploads/81eaa567-d441-4d16-8f56-74d708a7b622',
        },
        message: 'Image uploaded successfully',
        error: null,
      },
    },
  })
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BaseApiResponse<any>> {
    const imageKey = await this.uploadService.uploadImage(file);

    return {
      status: 'success',
      data: { imageKey },
      message: 'Image uploaded successfully',
      error: null,
    };
  }
}
