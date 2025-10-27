-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('FREE', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('STORE_SETTING_CHANGED', 'MENU_PRICE_CHANGED', 'MENU_ITEM_86D', 'PAYMENT_REFUNDED', 'ORDER_VOIDED', 'USER_ROLE_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'TIER_UPGRADED', 'TIER_DOWNGRADED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountAppliedAt" TIMESTAMP(3),
ADD COLUMN     "discountAppliedBy" TEXT,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "guestNumber" INTEGER,
ADD COLUMN     "splitMetadata" JSONB,
ADD COLUMN     "splitType" TEXT;

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "acceptOrdersWhenClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyPointExpiryDays" INTEGER DEFAULT 365,
ADD COLUMN     "loyaltyPointRate" DECIMAL(10,4),
ADD COLUMN     "loyaltyRedemptionRate" DECIMAL(10,4),
ADD COLUMN     "specialHours" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "StoreTier" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'FREE',
    "subscriptionId" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitationToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreTier_storeId_key" ON "StoreTier"("storeId");

-- CreateIndex
CREATE INDEX "StoreTier_storeId_idx" ON "StoreTier"("storeId");

-- CreateIndex
CREATE INDEX "StoreTier_tier_idx" ON "StoreTier"("tier");

-- CreateIndex
CREATE INDEX "StoreTier_subscriptionStatus_idx" ON "StoreTier"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "AuditLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_action_idx" ON "AuditLog"("storeId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_userId_idx" ON "AuditLog"("storeId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_invitationToken_key" ON "StaffInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "StaffInvitation_storeId_idx" ON "StaffInvitation"("storeId");

-- CreateIndex
CREATE INDEX "StaffInvitation_invitationToken_idx" ON "StaffInvitation"("invitationToken");

-- CreateIndex
CREATE INDEX "StaffInvitation_expiresAt_idx" ON "StaffInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_storeId_email_key" ON "StaffInvitation"("storeId", "email");

-- CreateIndex
CREATE INDEX "Order_storeId_discountType_idx" ON "Order"("storeId", "discountType");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_menuItemId_idx" ON "OrderItem"("orderId", "menuItemId");

-- CreateIndex
CREATE INDEX "Payment_orderId_paymentMethod_idx" ON "Payment"("orderId", "paymentMethod");

-- CreateIndex
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_guestNumber_idx" ON "Payment"("orderId", "guestNumber");

-- AddForeignKey
ALTER TABLE "StoreTier" ADD CONSTRAINT "StoreTier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
