// src/common/upload/upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from '../infra/s3.service';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  constructor(private s3Service: S3Service) {}

  /**
   * A generic method that takes an uploaded file (Multer) and
   * optionally resizes it to multiple variants. Returns the S3 keys.
   */
  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const originalBuffer = file.buffer;
    const contentType = file.mimetype;
    const baseKey = `uploads/${uuidv4()}`;

    // For example, create 3 versions. Or just store the original once.
    const [originalKey, mediumKey, thumbKey] = await Promise.all([
      this.uploadOriginal(originalBuffer, baseKey, contentType),
      this.uploadResized(originalBuffer, baseKey, contentType, 800, 'medium'),
      this.uploadResized(originalBuffer, baseKey, contentType, 200, 'thumb'),
    ]);

    return {
      originalKey,
      mediumKey,
      thumbKey,
    };
  }

  private async uploadOriginal(
    buffer: Buffer,
    baseKey: string,
    contentType: string,
  ) {
    const key = `${baseKey}-original`;
    await this.s3Service.uploadFile(key, buffer, contentType);
    return key;
  }

  private async uploadResized(
    buffer: Buffer,
    baseKey: string,
    contentType: string,
    width: number,
    suffix: string,
  ) {
    const resized = await sharp(buffer).resize(width).toBuffer();
    const key = `${baseKey}-${suffix}`;
    await this.s3Service.uploadFile(key, resized, contentType);
    return key;
  }
}
