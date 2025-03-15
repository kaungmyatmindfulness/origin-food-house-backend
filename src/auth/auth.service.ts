import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';

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
    console.log('📝 -> AuthService -> validateUser -> user:', user);
    if (!user) return null;

    if (!user.verified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  /**
   * Step 2: User picks a shop to finalize login.
   * Embed shop + role in the JWT payload.
   */
  async loginWithShop(userId: number, shopId: number) {
    const memberships = await this.userService.getUserShops(userId);
    const shopMembership = memberships.find((m) => m.shopId === shopId);
    if (!shopMembership) {
      throw new UnauthorizedException('User not a member of this shop');
    }

    const payload = {
      sub: userId,
      shopId: shopMembership.shopId,
      role: shopMembership.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
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
