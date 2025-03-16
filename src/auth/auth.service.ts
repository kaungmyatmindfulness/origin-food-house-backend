import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validate credentials, ensuring the user is verified.
   */
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
   * Step 1: After local strategy validates credentials,
   * issue a JWT with just userId (sub).
   */
  loginNoShop(user: RequestWithUser['user']) {
    const payload = { sub: user.userId }; // no shopId yet
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  /**
   * Step 2: The user picks a shop. We verify membership, then
   * issue a new token embedding shopId and role.
   */
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

  /**
   * Verify user email from a token.
   */
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
}
