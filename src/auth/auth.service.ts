import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Response } from 'express';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;
    if (!user.verified) {
      throw new UnauthorizedException('Please verify your email first');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  /**
   * Issues a token with sub=user.id, sets it in an HTTP-only cookie, and also returns the token in JSON.
   */
  loginNoStore(user: RequestWithUser['user'], res: Response) {
    const payload = { sub: user.id };
    const access_token = this.jwtService.sign(payload);

    // Attach the token in a cookie
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'dev',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 day, for example
    });

    return { access_token };
  }

  /**
   * After picking a store, embed userId + storeId + role in the token, set it in an HTTP-only cookie, and return JSON.
   */
  async loginWithStore(userId: number, storeId: number, res: Response) {
    const memberships = await this.userService.getUserStores(userId);
    const membership = memberships.find((m) => m.storeId === storeId);
    if (!membership) {
      throw new UnauthorizedException(
        'User is not a member of the chosen store',
      );
    }
    const payload = {
      sub: userId,
      storeId: membership.storeId,
      role: membership.role,
    };
    const access_token = this.jwtService.sign(payload);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'dev',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 day, for example
    });

    return { access_token };
  }

  async verifyEmail(token: string) {
    const user = await this.userService.findByVerificationToken(token);
    if (!user) return null;
    const now = new Date();
    if (user.verificationExpiry && user.verificationExpiry < now) {
      return null;
    }
    await this.userService.markUserVerified(user.id);
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // Do not reveal whether the email exists
      return {
        message: 'If that email is in our system, you will get a reset link.',
      };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour expiry
    await this.userService.setResetToken(user.id, token, expiry);
    // TODO: Send reset email with a link e.g. https://yourapp.com/reset-password?token=${token}
    return { message: 'Reset token generated. Please check your email.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userService.findByResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Reset token expired');
    }
    const saltRounds = 12;
    const hashedPass = await bcrypt.hash(newPassword, saltRounds);
    await this.userService.updatePasswordAndClearResetToken(
      user.id,
      hashedPass,
    );
    return { message: 'Password reset successful. You can now log in.' };
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Old password is incorrect');
    }
    const saltRounds = 12;
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    await this.userService.updatePassword(user.id, hashed);
    return { message: 'Password changed successfully' };
  }
}
