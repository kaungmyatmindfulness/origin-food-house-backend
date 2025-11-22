/* eslint-disable no-console */
import "dotenv/config";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`🌱 Starting database seeding at ${new Date().toISOString()}...`);
  console.log("--------------------------------------------------");

  console.log("🧹 Step 1: Cleaning existing data (in dependency order)...");

  await prisma.$transaction([
    prisma.orderItemCustomization.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.table.deleteMany(),
    prisma.customizationOption.deleteMany(),
    prisma.customizationGroup.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.category.deleteMany(),
    prisma.storeSetting.deleteMany(),
    prisma.storeInformation.deleteMany(),
    prisma.userStore.deleteMany(),
    prisma.store.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log("   Existing data cleaned.");
  console.log("--------------------------------------------------");

  console.log("👤 Step 2: Creating Users...");
  const users = await Promise.all(
    Array.from({ length: 5 }).map(async (_, i) => {
      const userEmail =
        i === 0
          ? "kraft@originfoodhouse.com"
          : faker.internet.email().toLowerCase();
      return await prisma.user.create({
        data: {
          email: userEmail,
          name: faker.person.fullName(),
          verified: true,
        },
      });
    }),
  );
  console.log(`   Created ${users.length} users.`);
  console.log("--------------------------------------------------");

  console.log("🌱 Seeding finished.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    process.exit(1);
  })

  .finally(async () => {
    console.log("🔌 Disconnecting Prisma Client...");
    await prisma.$disconnect();
  });
