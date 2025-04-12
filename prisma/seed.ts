import {
  PrismaClient,
  Role,
  Currency,
  ChunkStatus,
  OrderStatus,
  TableSessionStatus,
  Prisma, // Import Prisma namespace for Decimal type hint if needed
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10; // Keep consistent with your auth strategy

async function main() {
  console.log('Seeding database...');
  console.log('Step 1: Cleaning existing data...');
  // Clean existing data in reverse order of dependency
  // Note: Order matters due to foreign key constraints unless using raw truncate
  await prisma.orderChunkItemCustomization.deleteMany();
  await prisma.customizationOption.deleteMany(); // Must delete options before groups if referenced elsewhere (though OrderChunkItemCustomization cascades)
  await prisma.customizationGroup.deleteMany(); // Must delete groups before items if referenced elsewhere (though OrderChunkItemCustomization cascades)
  await prisma.orderChunkItem.deleteMany();
  await prisma.orderChunk.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.storeSetting.deleteMany();
  await prisma.storeInformation.deleteMany(); // Added StoreInformation cleanup
  await prisma.userStore.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
  console.log('Existing data cleaned.');

  console.log('Step 2: Creating Users...');
  const users = await Promise.all(
    Array.from({ length: 5 }).map(async (_, i) => {
      const userEmail = i === 0 ? 'owner@test.com' : faker.internet.email(); // Ensure at least one known user
      const hashedPassword = await bcrypt.hash('test1234', SALT_ROUNDS);
      return prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
          name: faker.person.fullName(),
          verified: true, // Assume verified for seeding
        },
      });
    }),
  );
  console.log(`Created ${users.length} users.`);

  console.log('Step 3: Creating Stores...');
  const stores = await Promise.all(
    Array.from({ length: 3 }).map((_, i) =>
      prisma.store.create({
        data: {
          // Use specific names for easier testing if needed
          slug: i === 0 ? 'demo-cafe' : faker.lorem.slug(3), // Add slug based on schema
          // Nested create for StoreInformation
          information: {
            create: {
              name:
                i === 0 ? 'Demo Cafe (Info)' : faker.company.name() + ' Info',
              address: faker.location.streetAddress(),
              phone: faker.phone.number(),
              email: faker.internet.email(),
              website: faker.internet.url(),
            },
          },
        },
      }),
    ),
  );
  console.log(`Created ${stores.length} stores.`);

  console.log('Step 4: Creating User-Store relationships...');
  await Promise.all(
    stores.flatMap((store, storeIndex) =>
      users.map((user, userIndex) => {
        // Assign first user as OWNER of first store for predictability
        let role = faker.helpers.arrayElement(Object.values(Role));
        if (userIndex === 0 && storeIndex === 0) {
          role = Role.OWNER;
        }
        return prisma.userStore.create({
          data: {
            userId: user.id, // user.id is now a String (UUID)
            storeId: store.id, // store.id is now a String (UUID)
            role: role,
          },
        });
      }),
    ),
  );
  console.log('Created user-store relationships.');

  console.log('Step 5: Creating Store Settings...');
  // --- Fetch settings AFTER creating them ---
  const storeSettingsData = stores.map((store) => ({
    storeId: store.id,
    currency: faker.helpers.arrayElement(Object.values(Currency)),
    vatRate: faker.number.float({ min: 0, max: 0.2, multipleOf: 0.001 }),
    serviceChargeRate: faker.number.float({
      min: 0,
      max: 0.1,
      multipleOf: 0.001,
    }),
  }));
  await prisma.storeSetting.createMany({ data: storeSettingsData });
  // Create a map for easy lookup later
  const storeSettingsMap = new Map(
    storeSettingsData.map((s) => [s.storeId, s]),
  );
  // -----------------------------------------
  console.log('Created store settings.');

  console.log('Step 6: Creating Categories...');
  const categories = await Promise.all(
    stores.flatMap((store) =>
      Array.from({ length: 5 }).map((_, i) =>
        prisma.category.create({
          data: {
            name: faker.company.name(),
            storeId: store.id, // store.id is now a String (UUID)
            sortOrder: i, // Use index for predictable sort order
          },
        }),
      ),
    ),
  );
  console.log(`Created ${categories.length} categories.`);

  console.log('Step 7: Creating Menu Items with Customizations...');
  const menuItems = await Promise.all(
    categories.flatMap((category) =>
      Array.from({ length: faker.number.int({ min: 5, max: 15 }) }).map(
        (
          _,
          i, // Create variable number of items
        ) =>
          prisma.menuItem.create({
            data: {
              name: faker.commerce.productName(),
              description: faker.commerce.productDescription(),
              // Prisma handles string -> Decimal conversion here
              basePrice: faker.commerce.price({ min: 5, max: 50, dec: 2 }),
              imageUrl: faker.datatype.boolean(0.8) // 80% chance of having an image
                ? `https://picsum.photos/seed/${faker.string.uuid()}/600/400` // Get random image from Picsum with fixed size
                : null,
              isHidden: faker.datatype.boolean(0.1), // 10% chance of being hidden
              categoryId: category.id, // category.id is now String (UUID)
              storeId: category.storeId, // category.storeId is now String (UUID)
              sortOrder: i, // Use index for predictable sort order within category
              // Nested creation of customization groups and options
              customizationGroups: {
                create: Array.from({
                  length: faker.number.int({ min: 0, max: 3 }),
                }).map(() => ({
                  name: faker.commerce.productAdjective(),
                  minSelectable: faker.number.int({ min: 0, max: 2 }),
                  // Ensure max >= min
                  maxSelectable: faker.number.int({ min: 1, max: 5 }),
                  customizationOptions: {
                    create: Array.from({
                      length: faker.number.int({ min: 2, max: 5 }),
                    }).map(() => ({
                      name: faker.commerce.productMaterial(),
                      // Prisma handles string|null -> Decimal? conversion
                      additionalPrice: faker.datatype.boolean()
                        ? faker.commerce.price({ min: 0.5, max: 5, dec: 2 }) // Ensure > 0 for actual price
                        : null,
                    })),
                  },
                })),
              },
            },
            // Include nested data to easily access options later if needed
            // (Though not strictly necessary for this seed script)
            include: {
              customizationGroups: {
                include: { customizationOptions: true },
              },
            },
          }),
      ),
    ),
  );
  console.log(`Created ${menuItems.length} menu items.`);

  console.log('Step 8: Creating Restaurant Tables...');
  const tables = await Promise.all(
    stores.flatMap((store) =>
      Array.from({ length: 10 }).map((_, i) =>
        prisma.restaurantTable.create({
          data: {
            number: `T${i + 1}`, // More realistic table numbers
            storeId: store.id, // store.id is now String (UUID)
          },
        }),
      ),
    ),
  );
  console.log(`Created ${tables.length} tables.`);

  console.log('Step 9: Creating Table Sessions...');
  const tableSessions = await Promise.all(
    // Create only a few active sessions for seeding
    faker.helpers.arrayElements(tables, { min: 5, max: 15 }).map((table) =>
      prisma.tableSession.create({
        data: {
          sessionUuid: faker.string.uuid(), // This is still String @unique
          storeId: table.storeId, // table.storeId is now String (UUID)
          tableId: table.id, // table.id is now String (UUID)
          status: TableSessionStatus.ACTIVE, // Seed active sessions
        },
      }),
    ),
  );
  console.log(`Created ${tableSessions.length} table sessions.`);

  console.log('Step 10: Creating Orders, Chunks, Items, Customizations...');
  await Promise.all(
    tableSessions.map(async (session) => {
      for (let o = 0; o < faker.number.int({ min: 1, max: 2 }); o++) {
        // --- Calculate approximate totals for the Order ---
        const storeSetting = storeSettingsMap.get(session.storeId);
        // Use Prisma.Decimal for calculations to maintain precision if needed
        const vatRate = storeSetting?.vatRate
          ? new Prisma.Decimal(storeSetting.vatRate)
          : new Prisma.Decimal(0);
        const serviceRate = storeSetting?.serviceChargeRate
          ? new Prisma.Decimal(storeSetting.serviceChargeRate)
          : new Prisma.Decimal(0);

        // Generate a plausible subTotal
        const subTotalDecimal = new Prisma.Decimal(
          faker.commerce.price({ min: 15, max: 200, dec: 2 }),
        );

        // Calculate amounts using Decimal methods
        const vatAmountDecimal = subTotalDecimal
          .times(vatRate)
          .toDecimalPlaces(2); // Ensure 2 decimal places
        const serviceChargeAmountDecimal = subTotalDecimal
          .times(serviceRate)
          .toDecimalPlaces(2); // Ensure 2 decimal places
        const grandTotalDecimal = subTotalDecimal
          .plus(vatAmountDecimal)
          .plus(serviceChargeAmountDecimal);
        // --- End Calculation ---

        const order = await prisma.order.create({
          data: {
            tableSessionId: session.id,
            status: faker.helpers.arrayElement([
              OrderStatus.OPEN,
              OrderStatus.PAID,
              OrderStatus.CANCELLED,
            ]), // Add some variety
            paidAt: faker.datatype.boolean(0.6)
              ? faker.date.recent({ days: 7 })
              : null, // 60% chance paid recently

            // --- Assign calculated values ---
            subTotal: subTotalDecimal,
            vatRateSnapshot: storeSetting?.vatRate ?? null, // Store the rate used
            serviceChargeRateSnapshot: storeSetting?.serviceChargeRate ?? null, // Store the rate used
            vatAmount: vatAmountDecimal,
            serviceChargeAmount: serviceChargeAmountDecimal,
            grandTotal: grandTotalDecimal,
            // ------------------------------
          },
        });

        // --- Create Chunks, Items, Customizations (as before) ---
        if (order.status !== OrderStatus.CANCELLED) {
          // Only add items if order not cancelled
          for (let c = 0; c < faker.number.int({ min: 1, max: 2 }); c++) {
            const chunk = await prisma.orderChunk.create({
              data: {
                orderId: order.id,
                status: faker.helpers.arrayElement(Object.values(ChunkStatus)),
              },
            });

            for (
              let itemIdx = 0;
              itemIdx < faker.number.int({ min: 1, max: 5 });
              itemIdx++
            ) {
              const storeMenuItems = menuItems.filter(
                (mi) => mi.storeId === session.storeId,
              );
              if (storeMenuItems.length === 0) continue;
              const menuItem = faker.helpers.arrayElement(storeMenuItems);
              const availableGroups = menuItem.customizationGroups;
              // Simulate choosing some customizations
              const chosenCustomizations = availableGroups.flatMap((group) => {
                if (group.customizationOptions.length === 0) return [];
                const numToSelect = faker.number.int({
                  min: 1,
                  max: 2,
                });
                if (numToSelect === 0) return []; // Can skip optional with min 0

                // Ensure required groups have at least minSelectable selected
                const minRequired = group.minSelectable;
                const finalNumToSelect = Math.max(numToSelect, minRequired);

                return faker.helpers
                  .arrayElements(group.customizationOptions, finalNumToSelect)
                  .map((option) => ({
                    customizationOptionId: option.id, // option.id is now String (UUID)
                    quantity: 1, // Keep quantity simple
                    // Use option's price, Prisma handles string|null -> Decimal?
                    finalPrice: option.additionalPrice,
                  }));
              });

              await prisma.orderChunkItem.create({
                data: {
                  orderChunkId: chunk.id,
                  menuItemId: menuItem.id,
                  price: menuItem.basePrice, // Store base price at time of order
                  quantity: faker.number.int({ min: 1, max: 3 }),
                  notes: faker.datatype.boolean(0.2)
                    ? faker.lorem.sentence()
                    : null,
                  // Calculate finalPrice for Item (base + customizations * quantity)
                  // This is complex for seed, maybe just estimate or store base * quantity
                  // finalPrice: calculatedItemFinalPrice; // Assign calculated value if needed
                  customizations: { create: chosenCustomizations },
                },
              });
            } // end item loop
          } // end chunk loop
        } // end check if not cancelled
      } // end order loop
    }),
  );

  console.log('Created orders, chunks, items, and customizations.');

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    console.log('Disconnecting Prisma Client...');
    await prisma.$disconnect();
  });
