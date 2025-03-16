import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BaseApiResponse<any>> {
    const keys = await this.uploadService.uploadImage(file);
    return {
      status: 'success',
      data: keys, // { originalKey, mediumKey, thumbKey }
      message: 'Image uploaded successfully',
      error: null,
    };
  }
}
