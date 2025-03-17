import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Service } from '../infra/s3.service';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  constructor(private s3Service: S3Service) {}

  /**
   * Upload an image, generating 3 versions: original, medium, thumb.
   * Returns the base imageKey (without the -original/-medium/-thumb suffix).
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File is not an image');
    }

    const originalBuffer = file.buffer;
    const contentType = file.mimetype;
    const imageKey = `uploads/${uuidv4()}`;

    // Create and upload:
    //  1) -original
    //  2) -medium (skip resizing if smaller than 800px wide)
    //  3) -thumb (200px wide)
    await Promise.all([
      this.uploadOriginal(originalBuffer, imageKey, contentType),
      this.uploadResized(originalBuffer, imageKey, contentType, 800, 'medium'),
      this.uploadResized(originalBuffer, imageKey, contentType, 200, 'thumb'),
    ]);

    // Return just the baseKey, e.g. "uploads/81eaa567-..."
    // The caller knows the actual keys will have suffixes.
    return imageKey;
  }

  private async uploadOriginal(
    buffer: Buffer,
    imageKey: string,
    contentType: string,
  ) {
    const key = `${imageKey}-original`;
    await this.s3Service.uploadFile(key, buffer, contentType);
  }

  /**
   * Resizes the image to `width` unless the original is already smaller,
   * in which case we just upload the original buffer.
   */
  private async uploadResized(
    buffer: Buffer,
    imageKey: string,
    contentType: string,
    width: number,
    suffix: string,
  ) {
    const key = `${imageKey}-${suffix}`;

    // Resize
    const resized = await sharp(buffer).resize(width).toBuffer();

    // Skip resizing if the result is larger than the original
    if (resized.byteLength >= buffer.byteLength) {
      await this.s3Service.uploadFile(key, buffer, contentType);
    } else {
      await this.s3Service.uploadFile(key, resized, contentType);
    }
  }
}
