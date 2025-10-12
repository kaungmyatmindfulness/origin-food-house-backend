import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from './auth.service';

/**
 * Define the structure of the object that will be attached to req.user
 * after successful local authentication. Include only necessary fields.
 */
export interface AuthUserPayload {
  sub: string;
  email: string;
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
    });
    this.logger.log('Local strategy initialized');
  }

  /**
   * This method is automatically called by Passport when the local strategy is used.
   * It receives credentials extracted based on the options passed to super().
   * @param email The email extracted from the request (based on usernameField).
   * @param password The password extracted from the request.
   * @returns The payload to attach to req.user if validation succeeds.
   * @throws {UnauthorizedException} If validation fails.
   */
  async validate(email: string, password: string): Promise<AuthUserPayload> {
    this.logger.verbose(`Attempting local validation for email: ${email}`);

    const user = await this.authService.validateUser(email, password);

    if (!user) {
      this.logger.warn(`Local validation failed for email: ${email}`);

      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email,
    };

    this.logger.log(
      `Local validation successful for email: ${email}, User ID: ${user.id}`,
    );
    return payload;
  }
}
