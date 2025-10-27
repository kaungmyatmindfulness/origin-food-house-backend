# Slice B Database Migration Guide

**Created**: October 25, 2025
**Status**: Ready for Execution
**Estimated Time**: 10 minutes

## Overview

This guide documents the database migration process for Slice B features:
- **StoreTier** model for freemium tier management
- **AuditLog** model for immutable audit trails
- **StaffInvitation** model for pending staff invites
- **StoreSetting** expansion for business hours and loyalty rules
- **User** expansion for suspension tracking

## Prerequisites

1. ✅ Prisma schema updated and validated
2. ✅ Redis added to docker-compose.yml
3. ⚠️ Docker services running (PostgreSQL + Redis)
4. ⚠️ `.env` file configured with `DATABASE_URL` and `REDIS_URL`

## Migration Steps

### Step 1: Start Infrastructure Services

```bash
cd origin-food-house-backend
npm run docker:up
```

**Wait for health checks**:
- PostgreSQL: `docker ps` shows "healthy"
- Redis: `docker ps` shows "healthy"

### Step 2: Create Migration

```bash
npx prisma migrate dev --name add_slice_b_schema_changes
```

This will:
- Generate SQL migration file
- Apply migration to database
- Regenerate Prisma client

**Expected Output**:
```
✔ Prisma schema loaded from prisma/schema.prisma
✔ Migration created: 20251025_add_slice_b_schema_changes
✔ Applied migrations:
  └─ 20251025_add_slice_b_schema_changes
✔ Generated Prisma Client
```

### Step 3: Verify Migration

```bash
npx prisma studio
```

Navigate to:
- **StoreTier** table (should exist, empty)
- **AuditLog** table (should exist, empty)
- **StaffInvitation** table (should exist, empty)
- **StoreSetting** table (check new columns exist)
- **User** table (check suspension columns exist)

### Step 4: Backfill Existing Stores

**Script Location**: `prisma/scripts/backfill-store-tiers.ts`

**Run backfill**:
```bash
npx ts-node prisma/scripts/backfill-store-tiers.ts
```

**Expected Output**:
```
[Backfill] Starting store tier backfill...
[Backfill] Found 5 stores without tiers
[Backfill] Created tier for store: abc123 (FREE tier, trial ends: 2026-01-23)
[Backfill] Created tier for store: def456 (FREE tier, trial ends: 2026-01-23)
[Backfill] ✅ Backfill complete: 5/5 stores migrated
```

### Step 5: Verify Backfill

```bash
npx prisma studio
```

Check **StoreTier** table:
- All existing stores should have `tier = 'FREE'`
- `trialEndsAt` should be ~90 days from now
- `subscriptionStatus = 'ACTIVE'`

## Rollback Procedure (Emergency Only)

If migration fails:

```bash
# Rollback last migration
npx prisma migrate resolve --rolled-back 20251025_add_slice_b_schema_changes

# Restore schema to previous state
git checkout HEAD -- prisma/schema.prisma

# Regenerate client
npx prisma generate
```

## Post-Migration Checklist

- [ ] All 3 new tables exist (StoreTier, AuditLog, StaffInvitation)
- [ ] StoreSetting has 7 new columns
- [ ] User has 3 new suspension columns
- [ ] All existing stores have FREE tier assigned
- [ ] Prisma client regenerated (`node_modules/.prisma/client`)
- [ ] No breaking changes to existing queries
- [ ] Backend builds successfully (`npm run build`)

## Migration SQL Preview

**New Tables**:
```sql
-- StoreTier
CREATE TABLE "StoreTier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL UNIQUE,
  "tier" "Tier" NOT NULL DEFAULT 'FREE',
  "subscriptionId" TEXT,
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "currentPeriodStart" TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP,
  "trialEndsAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);

-- AuditLog
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE
);

-- StaffInvitation
CREATE TABLE "StaffInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "invitationToken" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "acceptedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE,
  UNIQUE ("storeId", "email")
);
```

**New Enums**:
```sql
CREATE TYPE "Tier" AS ENUM ('FREE', 'STANDARD', 'PREMIUM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "AuditAction" AS ENUM (
  'STORE_SETTING_CHANGED',
  'MENU_PRICE_CHANGED',
  'MENU_ITEM_86D',
  'PAYMENT_REFUNDED',
  'ORDER_VOIDED',
  'USER_ROLE_CHANGED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'TIER_UPGRADED',
  'TIER_DOWNGRADED'
);
```

**Column Additions**:
```sql
-- User table
ALTER TABLE "User" ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "suspendedReason" TEXT;

-- StoreSetting table
ALTER TABLE "StoreSetting" ADD COLUMN "businessHours" JSONB;
ALTER TABLE "StoreSetting" ADD COLUMN "specialHours" JSONB;
ALTER TABLE "StoreSetting" ADD COLUMN "acceptOrdersWhenClosed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSetting" ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSetting" ADD COLUMN "loyaltyPointRate" DECIMAL(10,4);
ALTER TABLE "StoreSetting" ADD COLUMN "loyaltyRedemptionRate" DECIMAL(10,4);
ALTER TABLE "StoreSetting" ADD COLUMN "loyaltyPointExpiryDays" INTEGER DEFAULT 365;
```

## Troubleshooting

### Error: "Can't reach database server"
**Solution**: Start Docker services with `npm run docker:up`

### Error: "Migration failed: Column already exists"
**Solution**: Database might already have partial migration. Check `npx prisma migrate status`

### Error: "Prisma client out of sync"
**Solution**: Regenerate client with `npx prisma generate`

## Next Steps

After successful migration:
1. ✅ Generate Prisma client: `npm run generate:db`
2. ✅ Create TierModule scaffold
3. ✅ Create AuditLogModule scaffold
4. ✅ Implement tier limit middleware
5. ✅ Run quality gates

---

**Migration Status**: ⚠️ Ready to Execute (requires Docker running)
