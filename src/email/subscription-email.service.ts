import * as fs from "fs";
import * as path from "path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as nodemailer from "nodemailer";

import { getErrorDetails } from "../common/utils/error.util";

export interface PaymentRequestEmailData {
  ownerName: string;
  storeName: string;
  requestedTier: string;
  amount: string;
  referenceNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  uploadProofUrl: string;
  year: number;
}

export interface PaymentProofUploadedEmailData {
  ownerName: string;
  storeName: string;
  referenceNumber: string;
  requestedTier: string;
  amount: string;
  year: number;
}

export interface PaymentVerifiedEmailData {
  ownerName: string;
  storeName: string;
  tier: string;
  amount: string;
  validUntil: string;
  isPremium: boolean;
  storeSettingsUrl: string;
  year: number;
}

export interface PaymentRejectedEmailData {
  ownerName: string;
  storeName: string;
  referenceNumber: string;
  requestedTier: string;
  amount: string;
  rejectionReason: string;
  uploadProofUrl: string;
  year: number;
}

export interface TrialStartedEmailData {
  ownerName: string;
  storeName: string;
  trialStartedAt: string;
  trialEndsAt: string;
  dashboardUrl: string;
  year: number;
}

export interface TrialWarningEmailData {
  ownerName: string;
  storeName: string;
  daysRemaining: number;
  trialEndsAt: string;
  upgradeUrl: string;
  year: number;
}

export interface TrialExpiredEmailData {
  ownerName: string;
  storeName: string;
  downgradedAt: string;
  upgradeUrl: string;
  year: number;
}

export interface OwnershipTransferOTPEmailData {
  userName: string;
  storeName: string;
  otpCode: string;
  expiresIn: string;
  newOwnerEmail: string;
  otpExpiresAt: string;
  year: number;
}

export interface OwnershipTransferInviteEmailData {
  storeName: string;
  currentOwnerName: string;
  initiatedAt: string;
  needsAccount: boolean;
  signupUrl: string;
  year: number;
}

export interface OwnershipTransferCompleteOldEmailData {
  oldOwnerName: string;
  storeName: string;
  newOwnerName: string;
  newOwnerEmail: string;
  completedAt: string;
  storeUrl: string;
  year: number;
}

export interface OwnershipTransferCompleteNewEmailData {
  newOwnerName: string;
  storeName: string;
  oldOwnerName: string;
  completedAt: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  subscriptionEndsAt?: string;
  dashboardUrl: string;
  year: number;
}

export interface RefundProcessedEmailData {
  ownerName: string;
  storeName: string;
  originalAmount: string;
  refundAmount: string;
  refundMethod: string;
  processedAt: string;
  refundReference?: string;
  isBankTransfer: boolean;
  subscriptionEndsAt: string;
  hasNote: boolean;
  adminNote?: string;
  billingHistoryUrl: string;
  year: number;
}

@Injectable()
export class SubscriptionEmailService {
  private readonly logger = new Logger(SubscriptionEmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly mailFrom: string;
  private readonly appName: string;
  private readonly frontendUrl: string;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>("MAIL_USER");
    const pass = this.configService.get<string>("MAIL_PASS");
    const service = this.configService.get<string>("MAIL_SERVICE", "gmail");

    this.transporter = nodemailer.createTransport({
      service,
      auth: {
        user,
        pass,
      },
    });

    this.appName = this.configService.get<string>(
      "APP_NAME",
      "Origin Food House",
    );
    this.mailFrom = `"${this.appName}" <${user}>`;
    this.frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3002",
    );

    this.loadTemplates();
    this.logger.log(`Subscription Email Service initialized`);
  }

  private loadTemplates(): void {
    const templateDir = path.join(__dirname, "templates");
    const templateFiles = [
      "payment-request-created.hbs",
      "payment-proof-uploaded.hbs",
      "payment-verified.hbs",
      "payment-rejected.hbs",
      "trial-started.hbs",
      "trial-warning.hbs",
      "trial-expired.hbs",
      "ownership-transfer-otp.hbs",
      "ownership-transfer-invite.hbs",
      "ownership-transfer-complete-old.hbs",
      "ownership-transfer-complete-new.hbs",
      "refund-processed.hbs",
    ];

    for (const file of templateFiles) {
      try {
        const templatePath = path.join(templateDir, file);
        const template = fs.readFileSync(templatePath, "utf-8");
        const templateName = file.replace(".hbs", "");
        this.templates.set(templateName, Handlebars.compile(template));
        this.logger.log(`Loaded email template: ${templateName}`);
      } catch (error) {
        const { message, stack } = getErrorDetails(error);
        this.logger.error(`Failed to load template ${file}: ${message}`, stack);
      }
    }
  }

  async sendPaymentRequestCreated(
    to: string,
    data: PaymentRequestEmailData,
  ): Promise<void> {
    const method = this.sendPaymentRequestCreated.name;

    try {
      const template = this.templates.get("payment-request-created");
      if (!template) {
        throw new Error("Template not found: payment-request-created");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `Payment Request Created - ${data.storeName}`,
        html,
      });

      this.logger.log(
        `[${method}] Payment request created email sent to ${to}`,
      );
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendPaymentProofUploaded(
    to: string,
    data: PaymentProofUploadedEmailData,
  ): Promise<void> {
    const method = this.sendPaymentProofUploaded.name;

    try {
      const template = this.templates.get("payment-proof-uploaded");
      if (!template) {
        throw new Error("Template not found: payment-proof-uploaded");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `Payment Proof Received - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Payment proof uploaded email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendPaymentVerified(
    to: string,
    data: PaymentVerifiedEmailData,
  ): Promise<void> {
    const method = this.sendPaymentVerified.name;

    try {
      const template = this.templates.get("payment-verified");
      if (!template) {
        throw new Error("Template not found: payment-verified");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `✅ Payment Verified - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Payment verified email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendPaymentRejected(
    to: string,
    data: PaymentRejectedEmailData,
  ): Promise<void> {
    const method = this.sendPaymentRejected.name;

    try {
      const template = this.templates.get("payment-rejected");
      if (!template) {
        throw new Error("Template not found: payment-rejected");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `Payment Verification Issue - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Payment rejected email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendTrialStarted(
    to: string,
    data: TrialStartedEmailData,
  ): Promise<void> {
    const method = this.sendTrialStarted.name;

    try {
      const template = this.templates.get("trial-started");
      if (!template) {
        throw new Error("Template not found: trial-started");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `🎉 Welcome to Origin Food House - Your 30-Day Trial Starts Now`,
        html,
      });

      this.logger.log(`[${method}] Trial started email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendTrialWarning(
    to: string,
    data: TrialWarningEmailData,
  ): Promise<void> {
    const method = this.sendTrialWarning.name;

    try {
      const template = this.templates.get("trial-warning");
      if (!template) {
        throw new Error("Template not found: trial-warning");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `⏰ Your Trial is Ending in ${data.daysRemaining} Days - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Trial warning email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendTrialExpired(
    to: string,
    data: TrialExpiredEmailData,
  ): Promise<void> {
    const method = this.sendTrialExpired.name;

    try {
      const template = this.templates.get("trial-expired");
      if (!template) {
        throw new Error("Template not found: trial-expired");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `Your Trial Has Ended - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Trial expired email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendOwnershipTransferOTP(
    to: string,
    data: OwnershipTransferOTPEmailData,
  ): Promise<void> {
    const method = this.sendOwnershipTransferOTP.name;

    try {
      const template = this.templates.get("ownership-transfer-otp");
      if (!template) {
        throw new Error("Template not found: ownership-transfer-otp");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `🔐 Ownership Transfer OTP - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Ownership transfer OTP email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendOwnershipTransferInvite(
    to: string,
    data: OwnershipTransferInviteEmailData,
  ): Promise<void> {
    const method = this.sendOwnershipTransferInvite.name;

    try {
      const template = this.templates.get("ownership-transfer-invite");
      if (!template) {
        throw new Error("Template not found: ownership-transfer-invite");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `🎉 You've Been Invited to Own ${data.storeName}`,
        html,
      });

      this.logger.log(
        `[${method}] Ownership transfer invite email sent to ${to}`,
      );
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendOwnershipTransferCompleteOld(
    to: string,
    data: OwnershipTransferCompleteOldEmailData,
  ): Promise<void> {
    const method = this.sendOwnershipTransferCompleteOld.name;

    try {
      const template = this.templates.get("ownership-transfer-complete-old");
      if (!template) {
        throw new Error("Template not found: ownership-transfer-complete-old");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `✅ Ownership Transfer Complete - ${data.storeName}`,
        html,
      });

      this.logger.log(
        `[${method}] Ownership transfer complete (old owner) email sent to ${to}`,
      );
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendOwnershipTransferCompleteNew(
    to: string,
    data: OwnershipTransferCompleteNewEmailData,
  ): Promise<void> {
    const method = this.sendOwnershipTransferCompleteNew.name;

    try {
      const template = this.templates.get("ownership-transfer-complete-new");
      if (!template) {
        throw new Error("Template not found: ownership-transfer-complete-new");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `🎉 Congratulations! You Are Now The Owner of ${data.storeName}`,
        html,
      });

      this.logger.log(
        `[${method}] Ownership transfer complete (new owner) email sent to ${to}`,
      );
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }

  async sendRefundProcessed(
    to: string,
    data: RefundProcessedEmailData,
  ): Promise<void> {
    const method = this.sendRefundProcessed.name;

    try {
      const template = this.templates.get("refund-processed");
      if (!template) {
        throw new Error("Template not found: refund-processed");
      }

      const html = template(data);

      await this.transporter.sendMail({
        from: this.mailFrom,
        to,
        subject: `✅ Refund Processed - ${data.storeName}`,
        html,
      });

      this.logger.log(`[${method}] Refund processed email sent to ${to}`);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send email to ${to}`, stack);
      throw error;
    }
  }
}
