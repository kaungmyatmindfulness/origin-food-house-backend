import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from "@nestjs/common";

import { AdminUser } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

interface RequestWithUser {
  user?: {
    sub: string;
    [key: string]: unknown;
  };
  adminUser?: AdminUser;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly logger = new Logger(PlatformAdminGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.sub;

    if (!userId) {
      this.logger.warn("PlatformAdminGuard: No user ID found in request");
      throw new ForbiddenException("Authentication required");
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { auth0Id: userId },
    });

    if (!adminUser) {
      this.logger.warn(
        `PlatformAdminGuard: User ${userId} is not an admin user`,
      );
      throw new ForbiddenException("Admin access required");
    }

    if (!adminUser.isActive) {
      this.logger.warn(
        `PlatformAdminGuard: Admin user ${adminUser.id} is not active`,
      );
      throw new ForbiddenException("Admin account is inactive");
    }

    const allowedRoles = ["SUPER_ADMIN", "PLATFORM_ADMIN"];
    if (!allowedRoles.includes(adminUser.role)) {
      this.logger.warn(
        `PlatformAdminGuard: Admin user ${adminUser.id} has insufficient role: ${adminUser.role}`,
      );
      throw new ForbiddenException("Insufficient permissions");
    }

    request.adminUser = adminUser;
    this.logger.log(
      `PlatformAdminGuard: Admin user ${adminUser.id} (${adminUser.role}) authorized`,
    );

    return true;
  }
}
