import * as crypto from "crypto";

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  Prisma,
  OwnershipTransfer,
  TransferStatus,
  Role,
} from "@prisma/client";

import { AuditLogService } from "../../audit-log/audit-log.service";
import { getErrorDetails } from "../../common/utils/error.util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OwnershipTransferService {
  private readonly logger = new Logger(OwnershipTransferService.name);
  private readonly OTP_EXPIRY_MINUTES = 15;
  private readonly MAX_OTP_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async initiateTransfer(
    currentOwnerId: string,
    storeId: string,
    newOwnerEmail: string,
  ): Promise<OwnershipTransfer> {
    const method = this.initiateTransfer.name;
    this.logger.log(
      `[${method}] Initiating ownership transfer for store ${storeId} from ${currentOwnerId} to ${newOwnerEmail}`,
    );

    const isOwner = await this.prisma.userStore.findFirst({
      where: {
        userId: currentOwnerId,
        storeId,
        role: Role.OWNER,
      },
    });

    if (!isOwner) {
      throw new ForbiddenException(
        "Only the store owner can transfer ownership",
      );
    }

    const otpCode = this.generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + this.OTP_EXPIRY_MINUTES);

    try {
      const transfer = await this.prisma.ownershipTransfer.create({
        data: {
          storeId,
          currentOwnerId,
          newOwnerEmail,
          otpCode,
          otpGeneratedAt: new Date(),
          otpExpiresAt: otpExpiry,
          status: TransferStatus.PENDING_OTP,
        },
      });

      await this.auditLogService.createLog({
        storeId,
        userId: currentOwnerId,
        action: "OWNERSHIP_TRANSFER_INITIATED",
        entityType: "OwnershipTransfer",
        entityId: transfer.id,
        details: {
          currentOwnerId,
          newOwnerEmail,
          otpExpiresAt: otpExpiry.toISOString(),
        },
      });

      this.logger.log(
        `[${method}] Ownership transfer initiated: ${transfer.id}`,
      );

      return transfer;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to initiate ownership transfer`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to initiate ownership transfer",
      );
    }
  }

  async verifyOtp(
    userId: string,
    transferId: string,
    otpCode: string,
  ): Promise<void> {
    const method = this.verifyOtp.name;
    this.logger.log(`[${method}] Verifying OTP for transfer ${transferId}`);

    let transfer: OwnershipTransfer;

    try {
      transfer = await this.prisma.ownershipTransfer.findUniqueOrThrow({
        where: { id: transferId },
      });
    } catch (_error) {
      throw new NotFoundException("Transfer not found");
    }

    if (transfer.status !== TransferStatus.PENDING_OTP) {
      throw new BadRequestException("Transfer is not in pending status");
    }

    if (new Date() > transfer.otpExpiresAt) {
      await this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.EXPIRED,
          cancellationReason: "OTP expired",
        },
      });
      throw new UnauthorizedException("OTP has expired");
    }

    if (transfer.otpAttempts >= this.MAX_OTP_ATTEMPTS) {
      await this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CANCELLED,
          cancellationReason: "Too many failed OTP attempts",
        },
      });
      throw new UnauthorizedException(
        "Too many failed attempts. Transfer cancelled.",
      );
    }

    if (transfer.otpCode !== otpCode) {
      await this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: { otpAttempts: { increment: 1 } },
      });

      const attemptsRemaining =
        this.MAX_OTP_ATTEMPTS - transfer.otpAttempts - 1;
      throw new UnauthorizedException(
        `Invalid OTP. ${attemptsRemaining} attempts remaining.`,
      );
    }

    try {
      await this.completeOwnershipTransfer(transferId, userId);
      this.logger.log(
        `[${method}] Ownership transferred successfully: ${transferId}`,
      );
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to complete ownership transfer`,
        stack,
      );
      throw error;
    }
  }

  async completeOwnershipTransfer(
    transferId: string,
    newOwnerUserId: string,
  ): Promise<void> {
    const method = this.completeOwnershipTransfer.name;
    this.logger.log(`[${method}] Completing ownership transfer: ${transferId}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        const transfer = await tx.ownershipTransfer.findUniqueOrThrow({
          where: { id: transferId },
        });

        await tx.ownershipTransfer.update({
          where: { id: transferId },
          data: {
            newOwnerId: newOwnerUserId,
            status: TransferStatus.COMPLETED,
            otpVerifiedAt: new Date(),
            completedAt: new Date(),
          },
        });

        await tx.userStore.updateMany({
          where: {
            userId: transfer.currentOwnerId,
            storeId: transfer.storeId,
            role: Role.OWNER,
          },
          data: { role: Role.ADMIN },
        });

        await tx.userStore.upsert({
          where: {
            userId_storeId: {
              userId: newOwnerUserId,
              storeId: transfer.storeId,
            },
          },
          update: { role: Role.OWNER },
          create: {
            userId: newOwnerUserId,
            storeId: transfer.storeId,
            role: Role.OWNER,
          },
        });

        await tx.auditLog.create({
          data: {
            storeId: transfer.storeId,
            userId: newOwnerUserId,
            action: "OWNERSHIP_TRANSFER_COMPLETED",
            entityType: "OwnershipTransfer",
            entityId: transferId,
            details: {
              previousOwnerId: transfer.currentOwnerId,
              newOwnerId: newOwnerUserId,
            },
          },
        });
      });

      this.logger.log(
        `[${method}] Ownership transfer completed successfully: ${transferId}`,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Transfer not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to complete ownership transfer`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to complete ownership transfer",
      );
    }
  }

  async cancelTransfer(
    userId: string,
    transferId: string,
    reason: string = "Cancelled by owner",
  ): Promise<void> {
    const method = this.cancelTransfer.name;
    this.logger.log(
      `[${method}] Cancelling transfer ${transferId} by user ${userId}`,
    );

    try {
      const transfer = await this.prisma.ownershipTransfer.findUniqueOrThrow({
        where: { id: transferId },
      });

      if (transfer.currentOwnerId !== userId) {
        throw new ForbiddenException(
          "Only the current owner can cancel the transfer",
        );
      }

      if (transfer.status !== TransferStatus.PENDING_OTP) {
        throw new BadRequestException("Transfer cannot be cancelled");
      }

      await this.prisma.ownershipTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      this.logger.log(`[${method}] Transfer cancelled: ${transferId}`);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Transfer not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to cancel transfer`, stack);
      throw new InternalServerErrorException("Failed to cancel transfer");
    }
  }

  private generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
