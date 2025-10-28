import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { S3Service } from "../../common/infra/s3.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentProofService {
  private readonly logger = new Logger(PaymentProofService.name);
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  private async uploadFileToS3(
    file: Express.Multer.File,
    requestId: string,
    storeId: string,
  ): Promise<string> {
    const method = this.uploadFileToS3.name;
    this.logger.log(
      `[${method}] Uploading payment proof to S3 for request ${requestId}, store ${storeId}`,
    );

    this.validateFile(file);

    try {
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `${timestamp}-${requestId}.${fileExtension}`;
      const key = `payment-proofs/${storeId}/${fileName}`;

      const fileUrl = await this.s3Service.uploadFile(
        key,
        file.buffer,
        file.mimetype,
      );

      this.logger.log(
        `[${method}] Payment proof uploaded successfully: ${fileUrl}`,
      );

      return fileUrl;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to upload payment proof`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException("Failed to upload payment proof");
    }
  }

  async getFileUrl(fileKey: string): Promise<string> {
    const method = this.getFileUrl.name;
    this.logger.log(`[${method}] Getting S3 URL for: ${fileKey}`);

    try {
      const fileUrl = this.s3Service.getObjectUrl(fileKey);

      this.logger.log(`[${method}] File URL retrieved successfully`);

      return fileUrl;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get file URL`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException("Failed to get file URL");
    }
  }

  async deletePaymentProof(fileKey: string): Promise<void> {
    const method = this.deletePaymentProof.name;
    this.logger.log(`[${method}] Deleting payment proof: ${fileKey}`);

    try {
      await this.s3Service.deleteFile(fileKey);

      this.logger.log(`[${method}] Payment proof deleted successfully`);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to delete payment proof`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException("Failed to delete payment proof");
    }
  }

  validateFile(file: Express.Multer.File): void {
    const method = this.validateFile.name;

    if (!file) {
      throw new BadRequestException("No file provided");
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    this.logger.log(
      `[${method}] File validation passed: ${file.originalname} (${file.mimetype}, ${(file.size / 1024).toFixed(2)}KB)`,
    );
  }

  async uploadPaymentProof(
    userId: string,
    paymentRequestId: string,
    file: Express.Multer.File,
  ): Promise<{ paymentProofUrl: string }> {
    const method = "uploadPaymentProof";
    this.logger.log(
      `[${method}] User ${userId} uploading payment proof for request ${paymentRequestId}`,
    );

    this.validateFile(file);

    try {
      const paymentRequest = await this.prisma.paymentRequest.findUniqueOrThrow(
        {
          where: { id: paymentRequestId },
        },
      );

      if (paymentRequest.requestedBy !== userId) {
        throw new BadRequestException(
          "You can only upload payment proof for your own requests",
        );
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: paymentRequest.subscriptionId },
        select: { storeId: true },
      });

      if (!subscription) {
        throw new NotFoundException("Subscription not found");
      }

      const fileUrl = await this.uploadFileToS3(
        file,
        paymentRequestId,
        subscription.storeId,
      );

      await this.prisma.paymentRequest.update({
        where: { id: paymentRequestId },
        data: {
          paymentProofUrl: fileUrl,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[${method}] Payment proof uploaded successfully: ${fileUrl}`,
      );

      return { paymentProofUrl: fileUrl };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to upload payment proof`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException("Failed to upload payment proof");
    }
  }

  async getPaymentProofUrl(paymentRequestId: string): Promise<string> {
    const method = "getPaymentProofUrl";
    this.logger.log(
      `[${method}] Getting payment proof URL for request ${paymentRequestId}`,
    );

    try {
      const paymentRequest = await this.prisma.paymentRequest.findUniqueOrThrow(
        {
          where: { id: paymentRequestId },
          select: { paymentProofUrl: true },
        },
      );

      if (!paymentRequest.paymentProofUrl) {
        throw new NotFoundException(
          "No payment proof uploaded for this request",
        );
      }

      return paymentRequest.paymentProofUrl;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get payment proof URL`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException("Failed to get payment proof URL");
    }
  }
}
