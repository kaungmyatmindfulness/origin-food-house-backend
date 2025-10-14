/* eslint-disable no-console */
import { faker } from '@faker-js/faker';
import { PrismaClient, Role, Currency, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

function selectCustomizations(
  availableGroups: ({
    customizationOptions: {
      id: string;
      additionalPrice: Prisma.Decimal | null;
    }[];
  } & {
    minSelectable: number;
    maxSelectable: number;
    name: string;
  })[],
): { id: string; additionalPrice: Prisma.Decimal | null }[] {
  return availableGroups.flatMap((group) => {
    if (!group.customizationOptions || group.customizationOptions.length === 0)
      return [];

    const minRequired = group.minSelectable;
    const maxAllowed = Math.min(
      group.maxSelectable,
      group.customizationOptions.length,
    );

    if (
      minRequired > group.customizationOptions.length ||
      minRequired > maxAllowed
    ) {
      return [];
    }

    const numToSelect = faker.number.int({ min: minRequired, max: maxAllowed });
    if (numToSelect === 0) return [];

    return faker.helpers
      .arrayElements(group.customizationOptions, numToSelect)
      .map((option) => ({
        id: option.id,
        additionalPrice: option.additionalPrice,
      }));
  });
}

async function main() {
  console.log(`🌱 Starting database seeding at ${new Date().toISOString()}...`);
  console.log('--------------------------------------------------');

  console.log('🧹 Step 1: Cleaning existing data (in dependency order)...');

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
  console.log('   Existing data cleaned.');
  console.log('--------------------------------------------------');

  console.log('👤 Step 2: Creating Users...');
  const users = await Promise.all(
    Array.from({ length: 5 }).map(async (_, i) => {
      const userEmail =
        i === 0 ? 'owner@test.com' : faker.internet.email().toLowerCase();
      const hashedPassword = await bcrypt.hash('test1234', SALT_ROUNDS);
      return await prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
          name: faker.person.fullName(),
          verified: true,
        },
      });
    }),
  );
  console.log(`   Created ${users.length} users.`);
  console.log('--------------------------------------------------');

  console.log('🏪 Step 3: Creating Stores...');
  const stores = await Promise.all(
    Array.from({ length: 2 }).map((_, i) =>
      prisma.store.create({
        data: {
          slug:
            i === 0
              ? 'demo-cafe'
              : `${faker.lorem.slug(2).toLowerCase()}-diner`,
          information: {
            create: {
              name: i === 0 ? 'The Demo Cafe' : `${faker.company.name()} Diner`,
              address: faker.location.streetAddress(),
              phone: faker.phone.number(),
              email: faker.internet.email().toLowerCase(),
              website:
                i === 0 ? 'https://demo.example.com' : faker.internet.url(),
              logoUrl: faker.image.urlLoremFlickr({
                category: 'food',
                width: 200,
                height: 200,
              }),
            },
          },
          setting: {
            create: {
              currency: faker.helpers.arrayElement([
                Currency.USD,
                Currency.THB,
                Currency.EUR,
              ]),
              vatRate:
                i === 0
                  ? 0.07
                  : faker.number.float({
                      min: 0,
                      max: 0.15,
                      multipleOf: 0.001,
                    }),
              serviceChargeRate:
                i === 0
                  ? 0.05
                  : faker.number.float({ min: 0, max: 0.1, multipleOf: 0.001 }),
            },
          },
        },
        include: { setting: true, information: true },
      }),
    ),
  );
  console.log(
    `   Created ${stores.length} stores: [${stores.map((s) => s.information?.name).join(', ')}]`,
  );
  const storeSettingsMap = new Map(stores.map((s) => [s.id, s.setting]));
  console.log('--------------------------------------------------');

  console.log('👥 Step 4: Creating User-Store relationships...');
  await Promise.all(
    stores.flatMap((store, storeIndex) =>
      users.map((user, userIndex) => {
        let role = faker.helpers.arrayElement([
          Role.SERVER,
          Role.CASHIER,
          Role.CHEF,
        ] as Role[]);
        if (userIndex === 0 && storeIndex === 0) role = Role.OWNER;
        else if (userIndex === 1 && storeIndex === 0) role = Role.ADMIN;
        else if (userIndex === 0 && storeIndex > 0) role = Role.OWNER;

        return prisma.userStore.create({
          data: { userId: user.id, storeId: store.id, role },
        });
      }),
    ),
  );
  console.log('   Created user-store relationships.');
  console.log('--------------------------------------------------');

  console.log('📚 Step 5: Creating Categories...');
  const categories = await Promise.all(
    stores.flatMap((store) =>
      ['Appetizers', 'Main Courses', 'Desserts', 'Drinks', 'Specials'].map(
        (name, i) =>
          prisma.category.create({
            data: { name, storeId: store.id, sortOrder: i },
          }),
      ),
    ),
  );
  console.log(`   Created ${categories.length} categories.`);
  console.log('--------------------------------------------------');

  console.log('🍔 Step 6: Creating Menu Items with Customizations...');
  const menuItems = await Promise.all(
    categories.flatMap((category) =>
      Array.from({ length: faker.number.int({ min: 4, max: 12 }) }).map(
        (_, i) =>
          prisma.menuItem.create({
            data: {
              name: faker.commerce.productName(),
              description: faker.commerce.productDescription(),
              basePrice: faker.commerce.price({ min: 3, max: 40, dec: 2 }),
              imageUrl: faker.datatype.boolean(0.8)
                ? faker.image.urlLoremFlickr({
                    category: 'food',
                    width: 600,
                    height: 400,
                  })
                : null,
              isHidden: faker.datatype.boolean(0.05),
              categoryId: category.id,
              storeId: category.storeId,
              sortOrder: i,
              customizationGroups: {
                create: Array.from({
                  length: faker.number.int({ min: 0, max: 2 }),
                }).map(() => {
                  const minSel = faker.helpers.arrayElement([0, 1]);
                  const maxSel = faker.number.int({ min: minSel, max: 4 });
                  return {
                    name: faker.helpers.arrayElement([
                      'Size',
                      'Spice Level',
                      'Add Ons',
                      'Options',
                      'Temp',
                    ]),
                    minSelectable: minSel,
                    maxSelectable: maxSel === 0 ? 1 : maxSel,
                    customizationOptions: {
                      create: Array.from({
                        length: faker.number.int({ min: 2, max: 5 }),
                      }).map(() => ({
                        name: faker.commerce.productMaterial(),
                        additionalPrice: faker.datatype.boolean(0.7)
                          ? faker.commerce.price({ min: 0.5, max: 4, dec: 2 })
                          : null,
                      })),
                    },
                  };
                }),
              },
            },
            include: {
              customizationGroups: { include: { customizationOptions: true } },
            },
          }),
      ),
    ),
  );
  console.log(`   Created ${menuItems.length} menu items.`);
  console.log('--------------------------------------------------');

  console.log('🪑 Step 7: Creating Tables...');
  const tables = await Promise.all(
    stores.flatMap((store) =>
      Array.from({ length: faker.number.int({ min: 8, max: 20 }) }).map(
        (_, i) =>
          prisma.table.create({
            data: { name: `T-${i + 1}`, storeId: store.id },
          }),
      ),
    ),
  );
  console.log(`   Created ${tables.length} tables.`);
  console.log('--------------------------------------------------');

  console.log('🧾 Step 8: Creating Historical Orders...');
  const historicalOrderPromises: Promise<any>[] = [];
  const tablesForHistoricalOrders = faker.helpers.arrayElements(
    tables,
    Math.ceil(tables.length * 0.5),
  );

  for (const table of tablesForHistoricalOrders) {
    for (let h = 0; h < faker.number.int({ min: 1, max: 3 }); h++) {
      const storeSetting = storeSettingsMap.get(table.storeId);
      const vatRate = storeSetting?.vatRate
        ? new Prisma.Decimal(storeSetting.vatRate.toString())
        : new Prisma.Decimal(0);
      const serviceRate = storeSetting?.serviceChargeRate
        ? new Prisma.Decimal(storeSetting.serviceChargeRate.toString())
        : new Prisma.Decimal(0);
      let historicalSubTotal = new Prisma.Decimal(0);
      const historicalItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];
      const numberOfItems = faker.number.int({ min: 1, max: 7 });

      for (let i = 0; i < numberOfItems; i++) {
        const storeMenuItems = menuItems.filter(
          (mi) => mi.storeId === table.storeId,
        );
        if (storeMenuItems.length === 0) continue;
        const menuItem = faker.helpers.arrayElement(storeMenuItems);
        const availableGroups = menuItem.customizationGroups;
        const chosenOptions = selectCustomizations(availableGroups);

        const chosenHistoricalCustomizations = chosenOptions.map((opt) => ({
          customizationOptionId: opt.id,
          finalPrice: opt.additionalPrice,
        }));

        let customizationTotal = new Prisma.Decimal(0);
        chosenOptions.forEach(
          (opt) =>
            (customizationTotal = customizationTotal.plus(
              opt.additionalPrice ?? 0,
            )),
        );
        const quantity = faker.number.int({ min: 1, max: 2 });
        const itemBasePrice = new Prisma.Decimal(menuItem.basePrice.toString());
        const finalPrice = itemBasePrice
          .plus(customizationTotal)
          .times(quantity)
          .toDecimalPlaces(2);

        historicalSubTotal = historicalSubTotal.plus(finalPrice);

        historicalItemsData.push({
          menuItem: {
            connect: { id: menuItem.id },
          },
          price: menuItem.basePrice,
          quantity,
          finalPrice,
          notes: faker.datatype.boolean(0.1) ? faker.lorem.sentence() : null,
          customizations: {
            create: chosenHistoricalCustomizations,
          },
        });
      }

      if (historicalItemsData.length > 0) {
        const vatAmount = historicalSubTotal.times(vatRate).toDecimalPlaces(2);
        const serviceChargeAmount = historicalSubTotal
          .times(serviceRate)
          .toDecimalPlaces(2);
        const grandTotal = historicalSubTotal
          .plus(vatAmount)
          .plus(serviceChargeAmount);

        historicalOrderPromises.push(
          prisma.order.create({
            data: {
              storeId: table.storeId,
              tableName: table.name,
              paidAt: faker.date.recent({ days: 180 }),

              subTotal: historicalSubTotal,
              vatRateSnapshot: storeSetting?.vatRate ?? null,
              serviceChargeRateSnapshot:
                storeSetting?.serviceChargeRate ?? null,
              vatAmount,
              serviceChargeAmount,
              grandTotal,
              orderItems: { create: historicalItemsData },
            },
          }),
        );
      }
    }
  }

  await Promise.all(historicalOrderPromises);
  console.log(
    `   Created ${historicalOrderPromises.length} Historical Orders.`,
  );
  console.log('--------------------------------------------------');

  console.log('🌱 Seeding finished.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:');
    console.error(e);
    process.exit(1);
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    console.log('🔌 Disconnecting Prisma Client...');
    await prisma.$disconnect();
  });
