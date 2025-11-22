import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { AdminRole } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { AdminAuth0Service, AdminAuth0UserInfo } from "./admin-auth0.service";

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  adminId: string;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private adminAuth0Service: AdminAuth0Service,
  ) {}

  async validateAuth0Token(token: string): Promise<AdminAuth0UserInfo> {
    const method = this.validateAuth0Token.name;

    try {
      const tokenPayload = await this.adminAuth0Service.validateToken(token);

      const userInfo: AdminAuth0UserInfo = {
        sub: tokenPayload.sub,
        email: tokenPayload.email ?? "",
        name: tokenPayload.name,
        email_verified: tokenPayload.email_verified,
      };

      this.logger.log(
        `[${method}] Admin Auth0 token validated for ${userInfo.email}`,
      );

      return userInfo;
    } catch (error) {
      this.logger.error(
        `[${method}] Admin Auth0 token validation failed`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new UnauthorizedException("Invalid admin Auth0 token");
    }
  }

  async syncAdminUser(auth0UserInfo: AdminAuth0UserInfo) {
    const method = this.syncAdminUser.name;

    try {
      const existingAdmin = await this.prisma.adminUser.findUnique({
        where: { auth0Id: auth0UserInfo.sub },
      });

      if (existingAdmin) {
        const updated = await this.prisma.adminUser.update({
          where: { id: existingAdmin.id },
          data: {
            email: auth0UserInfo.email,
            name: auth0UserInfo.name ?? existingAdmin.name,
            lastLoginAt: new Date(),
          },
        });

        this.logger.log(
          `[${method}] Admin user ${updated.id} synced and login time updated`,
        );

        return updated;
      }

      const newAdmin = await this.prisma.adminUser.create({
        data: {
          email: auth0UserInfo.email,
          name: auth0UserInfo.name ?? auth0UserInfo.email,
          auth0Id: auth0UserInfo.sub,
          role: AdminRole.SUPPORT_AGENT,
          isActive: false,
          lastLoginAt: new Date(),
        },
      });

      this.logger.warn(
        `[${method}] New admin user ${newAdmin.id} created (inactive by default - requires SUPER_ADMIN manual activation)`,
      );

      return newAdmin;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to sync admin user`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getOrCreateAdminUser(auth0UserInfo: AdminAuth0UserInfo) {
    const method = this.getOrCreateAdminUser.name;

    const admin = await this.syncAdminUser(auth0UserInfo);

    if (!admin.isActive) {
      this.logger.warn(
        `[${method}] Admin user ${admin.id} exists but is inactive`,
      );
      throw new ForbiddenException(
        "Admin account is inactive. Contact a SUPER_ADMIN for activation.",
      );
    }

    this.logger.log(
      `[${method}] Admin user ${admin.id} retrieved successfully`,
    );

    return admin;
  }

  generateJwtForAdmin(adminUser: {
    id: string;
    email: string;
    role: AdminRole;
    auth0Id: string | null;
  }): string {
    const method = this.generateJwtForAdmin.name;

    const payload: AdminJwtPayload = {
      sub: adminUser.auth0Id ?? adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      adminId: adminUser.id,
    };

    const token = this.jwtService.sign(payload);

    this.logger.log(
      `[${method}] JWT generated for admin user ${adminUser.id} (${adminUser.role})`,
    );

    return token;
  }

  async getAdminProfile(adminId: string) {
    const method = this.getAdminProfile.name;

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      this.logger.warn(`[${method}] Admin user ${adminId} not found`);
      throw new NotFoundException("Admin user not found");
    }

    this.logger.log(`[${method}] Admin profile retrieved for ${adminId}`);

    return admin;
  }

  async getAdminPermissions(adminId: string): Promise<string[]> {
    const method = this.getAdminPermissions.name;

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { role: true, isActive: true },
    });

    if (!admin) {
      throw new NotFoundException("Admin user not found");
    }

    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    const permissions = this.getPermissionsByRole(admin.role);

    this.logger.log(
      `[${method}] Retrieved ${permissions.length} permissions for admin ${adminId} (${admin.role})`,
    );

    return permissions;
  }

  getPermissionsByRole(role: AdminRole): string[] {
    const permissions: Record<AdminRole, string[]> = {
      [AdminRole.SUPER_ADMIN]: ["*"],
      [AdminRole.PLATFORM_ADMIN]: [
        "stores:read",
        "stores:suspend",
        "stores:ban",
        "stores:reactivate",
        "users:read",
        "users:suspend",
        "users:ban",
        "users:reactivate",
        "payments:verify",
        "payments:reject",
        "subscriptions:override",
      ],
      [AdminRole.FINANCE_ADMIN]: [
        "payments:verify",
        "payments:reject",
        "audit-logs:read",
        "audit-logs:export",
      ],
      [AdminRole.SUPPORT_AGENT]: [
        "stores:read",
        "users:read",
        "users:password-reset",
      ],
      [AdminRole.COMPLIANCE_OFFICER]: [
        "audit-logs:read",
        "audit-logs:export",
        "gdpr:process",
        "stores:read",
        "users:read",
      ],
    };

    return permissions[role] ?? [];
  }

  async checkAdminRole(
    adminId: string,
    allowedRoles: AdminRole[],
  ): Promise<void> {
    const method = this.checkAdminRole.name;

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { role: true, isActive: true },
    });

    if (!admin) {
      throw new NotFoundException("Admin user not found");
    }

    if (!admin.isActive) {
      throw new ForbiddenException("Admin account is inactive");
    }

    if (!allowedRoles.includes(admin.role)) {
      this.logger.warn(
        `[${method}] Admin ${adminId} (${admin.role}) attempted to access resource requiring: ${allowedRoles.join(", ")}`,
      );
      throw new ForbiddenException(
        `Requires one of: ${allowedRoles.join(", ")}`,
      );
    }

    this.logger.log(`[${method}] Admin ${adminId} role check passed`);
  }

  async validateAndSyncAdmin(auth0Token: string) {
    const method = this.validateAndSyncAdmin.name;

    const auth0User = await this.validateAuth0Token(auth0Token);

    const adminUser = await this.getOrCreateAdminUser(auth0User);

    const jwt = this.generateJwtForAdmin(adminUser);

    const permissions = this.getPermissionsByRole(adminUser.role);

    this.logger.log(
      `[${method}] Admin ${adminUser.id} validated and synced successfully`,
    );

    return {
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        isActive: adminUser.isActive,
        lastLoginAt: adminUser.lastLoginAt,
      },
      jwt,
      permissions,
    };
  }
}
