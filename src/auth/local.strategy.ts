import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  UnauthorizedException,
  Logger, // Import Logger
} from '@nestjs/common';
import { AuthService } from './auth.service';
// Assume you have a User type/entity and define the payload for req.user
import { User } from '@prisma/client'; // Or your User entity path

/**
 * Define the structure of the object that will be attached to req.user
 * after successful local authentication. Include only necessary fields.
 */
export interface AuthUserPayload {
  sub: number; // Standard JWT claim for user ID (subject)
  email: string;
  // Add other fields needed for authorization/session context, e.g., roles
  // roles: string[]; // Example
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  // Optionally name the strategy 'local' explicitly
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // Use email field from request body
      // passwordField: 'password' // 'password' is default, no need to specify
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

    // Validate user credentials using the AuthService
    // Assuming validateUser returns the full User object or null
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      this.logger.warn(`Local validation failed for email: ${email}`);
      // Throw standard NestJS exception
      throw new UnauthorizedException('Invalid credentials');
    }

    // IMPORTANT: Return only the necessary user information for the session/token.
    // Do NOT return the full user object, especially if it contains sensitive data
    // like password hashes. Map it to the defined payload interface.
    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email,
      // Map other necessary fields, e.g.:
      // roles: user.roles,
    };

    this.logger.log(
      `Local validation successful for email: ${email}, User ID: ${user.id}`,
    );
    return payload;
  }
}
