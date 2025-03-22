// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

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

  loginNoShop(user: RequestWithUser['user']) {
    const payload = { sub: user.id };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  async loginWithShop(userId: number, shopId: number) {
    const memberships = await this.userService.getUserShops(userId);
    const membership = memberships.find((m) => m.shopId === shopId);
    if (!membership) {
      throw new UnauthorizedException(
        'User is not a member of the chosen shop',
      );
    }
    const payload = {
      sub: userId,
      shopId: membership.shopId,
      role: membership.role,
    };
    const access_token = this.jwtService.sign(payload);
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
