/* eslint-disable no-console */
/**
 * Backfill Script: Store Tiers for Slice B
 *
 * Purpose: Assign FREE tier to all existing stores with 90-day grace period
 * Usage: npx ts-node prisma/scripts/backfill-store-tiers.ts
 *
 * This script should be run ONCE after the Slice B migration.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function backfillStoreTiers() {
  console.log("[Backfill] Starting store tier backfill...\n");

  try {
    // Find all stores without a tier
    const storesWithoutTiers = await prisma.store.findMany({
      where: {
        tier: null,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    if (storesWithoutTiers.length === 0) {
      console.log(
        "[Backfill] No stores need backfilling. All stores have tiers assigned.",
      );
      return;
    }

    console.log(
      `[Backfill] Found ${storesWithoutTiers.length} stores without tiers\n`,
    );

    // Calculate trial end date (90 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 90);

    let successCount = 0;
    let errorCount = 0;

    // Create tier for each store
    for (const store of storesWithoutTiers) {
      try {
        await prisma.storeTier.create({
          data: {
            storeId: store.id,
            tier: "FREE",
            subscriptionStatus: "ACTIVE",
            billingCycle: "MONTHLY",
            trialEndsAt,
            // No subscriptionId for free tier
            // No currentPeriodStart/End for free tier
          },
        });

        successCount++;
        console.log(
          `[Backfill] ✅ Created tier for store: ${store.slug} (FREE tier, trial ends: ${trialEndsAt.toISOString().split("T")[0]})`,
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[Backfill] ❌ Failed to create tier for store: ${store.slug}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    console.log(`\n[Backfill] ========================================`);
    console.log(`[Backfill] Backfill complete!`);
    console.log(
      `[Backfill] Success: ${successCount}/${storesWithoutTiers.length} stores`,
    );
    if (errorCount > 0) {
      console.log(`[Backfill] Errors: ${errorCount} (check logs above)`);
    }
    console.log(`[Backfill] ========================================\n`);
  } catch (error) {
    console.error("[Backfill] Fatal error during backfill:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillStoreTiers()
  .then(() => {
    console.log("[Backfill] Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Backfill] Script failed:", error);
    process.exit(1);
  });
