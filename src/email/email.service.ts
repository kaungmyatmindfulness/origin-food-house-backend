import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly mailFrom: string;
  private readonly appName: string;
  private readonly frontendUrl: string;

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>("MAIL_USER");
    const pass = this.configService.get<string>("MAIL_PASS");
    const service = this.configService.get<string>("MAIL_SERVICE", "gmail"); // Default to gmail

    if (!user || !pass) {
      this.logger.error(
        "MAIL_USER or MAIL_PASS configuration missing. Email service will not work.",
      );
      // Optionally throw an error or handle appropriately if email is critical
      // For now, let transporter creation potentially fail or be unusable
    }

    this.transporter = nodemailer.createTransport({
      service, // Use configured service
      auth: {
        user,
        pass,
      },
    });

    // Configuration for email content
    this.appName = this.configService.get<string>("APP_NAME", "My App"); // Default App Name
    this.mailFrom = `"${this.appName}" <${user}>`;
    this.frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    ); // Default Frontend URL

    this.logger.log(`Email Service configured for user ${user} via ${service}`);
    this.logger.log(`Using Frontend URL: ${this.frontendUrl}`);
  }

  /**
   * Sends an email verification link to the user.
   * @param to Recipient email address.
   * @param token The verification token.
   */
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    // Construct verification link (points to backend verify endpoint)
    // Ensure your backend URL is configurable if needed, here using relative path assumption
    // Or use a full base URL from config: `${this.configService.get('API_BASE_URL')}/auth/verify?token=${token}`
    const verificationLink = `${this.frontendUrl}/auth/verify?token=${token}`; // Link to frontend which calls backend /auth/verify internally maybe? Or direct backend link? Assuming frontend handles verification flow trigger. Adjust if backend link is direct.

    const mailOptions = {
      from: this.mailFrom,
      to,
      subject: `Verify Your Email for ${this.appName}`,
      html: `
        <h2>Welcome to ${this.appName}!</h2>
        <p>Thanks for signing up! Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${verificationLink}</p>
        <br>
        <p>If you didn't sign up for ${this.appName}, please ignore this email.</p>
      `,
      text: `Welcome to ${this.appName}! Verify your email: ${verificationLink}`, // Plain text version
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Verification email sent to ${to}. Message ID: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${to}`,

        error.stack,
      );
      // Re-throw the error so the caller (e.g., UserService/AuthController) knows about the failure
      throw new InternalServerErrorException(
        `Failed to send verification email to ${to}`,
      );
    }
  }

  /**
   * Sends a password reset link to the user.
   * @param to Recipient email address.
   * @param token The password reset token.
   */
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    // Construct password reset link (points to frontend reset page)
    const resetLink = `${this.frontendUrl}/reset-password?token=${token}`; // Example path

    const mailOptions = {
      from: this.mailFrom,
      to,
      subject: `Reset Your Password for ${this.appName}`,
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your account with ${this.appName}.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <br>
        <p>This link will expire in 1 hour.</p>  
        <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
      `,
      text: `Reset your password for ${this.appName}: ${resetLink}`, // Plain text version
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Password reset email sent to ${to}. Message ID: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${to}`,

        error.stack,
      );
      // Re-throw the error so the caller (AuthController) knows about the failure.
      // The AuthController can then decide whether to still return a generic success message to the user.
      throw new InternalServerErrorException(
        `Failed to send password reset email to ${to}`,
      );
    }
  }

  /**
   * Sends a staff invitation email to the recipient.
   * @param to Recipient email address.
   * @param invitationToken The invitation token.
   * @param storeId The store ID the user is being invited to.
   */
  async sendStaffInvitation(
    to: string,
    invitationToken: string,
    storeId: string,
  ): Promise<void> {
    // Construct invitation link (points to frontend acceptance page)
    const invitationLink = `${this.frontendUrl}/auth/accept-invitation?token=${invitationToken}`;

    const mailOptions = {
      from: this.mailFrom,
      to,
      subject: `You've been invited to join a restaurant team on ${this.appName}`,
      html: `
        <h2>You've been invited!</h2>
        <p>You've been invited to join a restaurant team on ${this.appName}.</p>
        <p>Click the link below to accept the invitation and set up your account:</p>
        <p><a href="${invitationLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p>${invitationLink}</p>
        <br>
        <p>This invitation will expire in 7 days.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `,
      text: `You've been invited to join a restaurant team on ${this.appName}. Accept invitation: ${invitationLink}`,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Staff invitation email sent to ${to} for store ${storeId}. Message ID: ${info.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send staff invitation email to ${to}`,

        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to send staff invitation email to ${to}`,
      );
    }
  }
}
