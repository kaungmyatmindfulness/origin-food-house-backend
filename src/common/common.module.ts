import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './infra/s3.service';
import { UploadService } from './upload/upload.service';
import { UploadController } from './upload/upload.controller';
import { HealthController } from 'src/common/health/health.controller';

@Module({
  imports: [ConfigModule],
  providers: [S3Service, UploadService],
  controllers: [UploadController, HealthController],
  exports: [S3Service, UploadService],
})
export class CommonModule {}
