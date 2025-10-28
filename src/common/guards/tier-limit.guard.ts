import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { TierService } from "../../tier/tier.service";
import {
  TIER_LIMIT_KEY,
  TierLimitConfig,
} from "../decorators/tier-limit.decorator";

interface RequestWithStore {
  query?: { storeId?: string };
  params?: { storeId?: string };
  body?: { storeId?: string };
}

/**
 * TierLimitGuard enforces tier-based resource limits
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TierLimitGuard)
 * @UseTierLimit({ resource: 'tables', increment: 1 })
 * @Post()
 * async createTable(...) { ... }
 */
@Injectable()
export class TierLimitGuard implements CanActivate {
  private readonly logger = new Logger(TierLimitGuard.name);

  constructor(
    private reflector: Reflector,
    private tierService: TierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const method = this.canActivate.name;

    // Get tier limit configuration from decorator
    const tierLimitConfig = this.reflector.getAllAndOverride<TierLimitConfig>(
      TIER_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no tier limit configured, allow access
    if (!tierLimitConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithStore>();
    const storeId =
      request.query?.storeId ??
      request.params?.storeId ??
      request.body?.storeId;

    if (!storeId) {
      this.logger.error(
        `[${method}] Tier limit check failed: No storeId in request`,
      );
      throw new ForbiddenException(
        "Store ID is required for tier limit validation",
      );
    }

    const { resource, increment = 1 } = tierLimitConfig;

    try {
      const check = await this.tierService.checkTierLimit(
        storeId,
        resource,
        increment,
      );

      if (!check.allowed) {
        this.logger.warn(
          `[${method}] Tier limit exceeded for store ${storeId}: ` +
            `${resource} (${check.currentUsage}/${check.limit})`,
        );

        throw new ForbiddenException({
          message: `Your ${check.tier} tier plan has reached the limit for ${resource}`,
          details: {
            resource,
            currentUsage: check.currentUsage,
            limit: check.limit,
            tier: check.tier,
            usagePercentage: Math.round(
              (check.currentUsage / check.limit) * 100,
            ),
            upgradeRequired: true,
          },
        });
      }

      // Log successful check (at 90%+ usage for warning)
      const usagePercentage = (check.currentUsage / check.limit) * 100;
      if (usagePercentage >= 90) {
        this.logger.warn(
          `[${method}] Store ${storeId} approaching ${resource} limit: ` +
            `${check.currentUsage}/${check.limit} (${Math.round(usagePercentage)}%)`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Error checking tier limit for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );

      // On error, fail open (allow access but log error)
      // This prevents tier service failures from blocking all operations
      return true;
    }
  }
}
