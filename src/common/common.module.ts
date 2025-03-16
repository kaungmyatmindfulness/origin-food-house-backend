import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './infra/s3.service';
import { UploadService } from './upload/upload.service';
import { UploadController } from './upload/upload.controller';

@Module({
  imports: [
    ConfigModule, // for environment variables if S3Service uses it
  ],
  providers: [S3Service, UploadService],
  controllers: [UploadController],
  exports: [
    S3Service,
    UploadService, // so other modules can import and use them if needed
  ],
})
export class CommonModule {}
