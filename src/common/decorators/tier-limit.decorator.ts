import { SetMetadata } from '@nestjs/common';

export const TIER_LIMIT_KEY = 'tierLimit';

export interface TierLimitConfig {
  resource: 'tables' | 'menuItems' | 'staff' | 'monthlyOrders';
  increment?: number;
}

/**
 * Decorator to enforce tier-based limits on actions
 *
 * Usage:
 * @UseTierLimit({ resource: 'tables', increment: 1 })
 * @Post()
 * async createTable(...) { ... }
 *
 * This will check if the store has reached its tier limit for tables
 * before allowing the action to proceed.
 */
export const UseTierLimit = (config: TierLimitConfig) =>
  SetMetadata(TIER_LIMIT_KEY, config);
