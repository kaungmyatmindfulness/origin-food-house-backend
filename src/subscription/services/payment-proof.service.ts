import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { S3Service } from "../../common/infra/s3.service";
import { UploadService } from "../../common/upload/upload.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentProofService {
  private readonly logger = new Logger(PaymentProofService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Deletes a payment proof file from S3.
   * @param fileKey The S3 key of the file to delete.
   */
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

  /**
   * Uploads a payment proof file for a payment request.
   * Uses the common UploadService with 'payment-proof' preset (no resizing).
   *
   * @param userId The user uploading the proof
   * @param paymentRequestId The payment request ID
   * @param file The uploaded file (image or PDF)
   * @returns Object containing the payment proof URL
   * @throws {BadRequestException} If user is not authorized or file is invalid
   * @throws {NotFoundException} If subscription not found
   * @throws {InternalServerErrorException} On unexpected errors
   */
  async uploadPaymentProof(
    userId: string,
    paymentRequestId: string,
    file: Express.Multer.File,
  ): Promise<{ paymentProofPath: string }> {
    const method = "uploadPaymentProof";
    this.logger.log(
      `[${method}] User ${userId} uploading payment proof for request ${paymentRequestId}`,
    );

    try {
      // Verify payment request ownership
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

      // Get store ID for S3 prefix
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: paymentRequest.subscriptionId },
        select: { storeId: true },
      });

      if (!subscription) {
        throw new NotFoundException("Subscription not found");
      }

      // Upload using UploadService with 'payment-proof' preset
      // This preset skips resizing and uses 'payment-proofs/{storeId}/' prefix
      const uploadResult = await this.uploadService.uploadImage(
        file,
        "payment-proof",
        subscription.storeId,
      );

      // Update payment request with the uploaded file path
      await this.prisma.paymentRequest.update({
        where: { id: paymentRequestId },
        data: {
          paymentProofPath: uploadResult.basePath,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `[${method}] Payment proof uploaded successfully: ${uploadResult.basePath}`,
      );

      return { paymentProofPath: uploadResult.basePath };
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
          select: { paymentProofPath: true },
        },
      );

      if (!paymentRequest.paymentProofPath) {
        throw new NotFoundException(
          "No payment proof uploaded for this request",
        );
      }

      return paymentRequest.paymentProofPath;
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
