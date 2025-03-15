import * as nodemailer from 'nodemailer';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const verificationLink = `http://localhost:3000/auth/verify?token=${token}`;
    const mailOptions = {
      from: `"My App" <${this.configService.get<string>('MAIL_USER')}>`,
      to,
      subject: 'Verify your email',
      html: `
        <p>Thanks for signing up! Please verify your email by clicking the link below:</p>
        <a href="${verificationLink}">${verificationLink}</a>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
    }
  }
}
