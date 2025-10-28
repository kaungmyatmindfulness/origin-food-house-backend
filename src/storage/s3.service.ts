import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BadRequestException,
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fileTypeFromBuffer } from "file-type";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>("AWS_REGION", "us-east-1");
    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>(
      "AWS_SECRET_ACCESS_KEY",
    );
    this.bucketName = this.configService.get<string>(
      "S3_PAYMENT_PROOF_BUCKET",
      "origin-food-house-payment-proofs",
    );

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        "AWS credentials not configured. S3 service will not work.",
      );
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId ?? "",
        secretAccessKey: secretAccessKey ?? "",
      },
    });

    this.logger.log(
      `S3 Service initialized for bucket: ${this.bucketName} in region: ${this.region}`,
    );
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const method = this.uploadFile.name;

    try {
      await this.validateFile(file);

      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        "_",
      );
      const s3Key = `${folder}/${timestamp}-${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      this.logger.log(`[${method}] File uploaded successfully: ${s3Key}`);

      return s3Key;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(`[${method}] S3 upload failed`, error.stack);
      throw new InternalServerErrorException("File upload failed");
    }
  }

  async uploadPaymentProof(
    file: Express.Multer.File,
    storeId: string,
  ): Promise<string> {
    const method = this.uploadPaymentProof.name;

    try {
      const folder = `payment-proofs/${storeId}`;
      const s3Key = await this.uploadFile(file, folder);

      this.logger.log(
        `[${method}] Payment proof uploaded for store ${storeId}: ${s3Key}`,
      );

      return s3Key;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to upload payment proof for store ${storeId}`,
        error.stack,
      );
      throw error;
    }
  }

  async getPresignedUrl(
    s3Key: string,
    expirySeconds: number = 900,
  ): Promise<string> {
    const method = this.getPresignedUrl.name;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirySeconds,
      });

      this.logger.log(
        `[${method}] Generated presigned URL for ${s3Key} (expires in ${expirySeconds}s)`,
      );

      return url;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to generate presigned URL for ${s3Key}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to generate file access URL",
      );
    }
  }

  async deleteFile(s3Key: string): Promise<void> {
    const method = this.deleteFile.name;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);

      this.logger.log(`[${method}] File deleted: ${s3Key}`);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to delete file ${s3Key}`,
        error.stack,
      );
      throw new InternalServerErrorException("File deletion failed");
    }
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    const method = this.validateFile.name;

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException("File size exceeds 10MB limit");
    }

    const fileTypeResult = await fileTypeFromBuffer(file.buffer);

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!fileTypeResult || !allowedMimeTypes.includes(fileTypeResult.mime)) {
      this.logger.warn(
        `[${method}] Invalid file type attempted: ${fileTypeResult?.mime ?? "unknown"}`,
      );
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}`,
      );
    }

    this.logger.log(
      `[${method}] File validation passed: ${fileTypeResult.mime}, ${(file.size / 1024).toFixed(2)}KB`,
    );
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getRegion(): string {
    return this.region;
  }
}
