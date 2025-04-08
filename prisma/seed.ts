import {
  PrismaClient,
  Role,
  Currency,
  ChunkStatus,
  OrderStatus,
  TableSessionStatus,
} from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  // Clean existing data
  await prisma.$transaction([
    prisma.orderChunkItemCustomization.deleteMany(),
    prisma.orderChunkItem.deleteMany(),
    prisma.orderChunk.deleteMany(),
    prisma.order.deleteMany(),
    prisma.tableSession.deleteMany(),
    prisma.restaurantTable.deleteMany(),
    prisma.customizationOption.deleteMany(),
    prisma.customizationGroup.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.category.deleteMany(),
    prisma.storeSetting.deleteMany(),
    prisma.store.deleteMany(),
    prisma.userStore.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Create Users
  const users = await Promise.all(
    Array.from({ length: 5 }).map(async () => {
      const hashedPassword = await bcrypt.hash('test1234', SALT_ROUNDS);
      return prisma.user.create({
        data: {
          email: faker.internet.email(),
          password: hashedPassword,
          name: faker.person.fullName(),
          verified: true,
        },
      });
    }),
  );

  // Create Stores
  const stores = await Promise.all(
    Array.from({ length: 3 }).map(() =>
      prisma.store.create({
        data: {
          name: faker.company.name(),
          address: faker.location.streetAddress(),
          phone: faker.phone.number(),
          email: faker.internet.email(),
        },
      }),
    ),
  );

  // Create User-Store relationships
  await Promise.all(
    stores.flatMap((store) =>
      users.map((user) =>
        prisma.userStore.create({
          data: {
            userId: user.id,
            storeId: store.id,
            role: faker.helpers.arrayElement(Object.values(Role)),
          },
        }),
      ),
    ),
  );

  // Create Store Settings
  await Promise.all(
    stores.map((store) =>
      prisma.storeSetting.create({
        data: {
          storeId: store.id,
          currency: faker.helpers.arrayElement(Object.values(Currency)),
          vatRate: faker.number.float({ min: 0, max: 0.2, fractionDigits: 2 }),
          serviceChargeRate: faker.number.float({
            min: 0,
            max: 0.1,
            fractionDigits: 2,
          }),
        },
      }),
    ),
  );

  // Create Categories
  const categories = await Promise.all(
    stores.flatMap((store) =>
      Array.from({ length: 5 }).map((_, i) =>
        prisma.category.create({
          data: {
            name: faker.commerce.department(),
            storeId: store.id,
            sortOrder: i + 1,
          },
        }),
      ),
    ),
  );

  // Create Menu Items with Customizations
  const menuItems = await Promise.all(
    categories.flatMap((category) =>
      Array.from({ length: 10 }).map(() =>
        prisma.menuItem.create({
          data: {
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
            basePrice: faker.commerce.price({ min: 5, max: 50, dec: 2 }),
            imageUrl: `https://picsum.photos/seed/${faker.string.uuid()}/600/450`,
            categoryId: category.id,
            storeId: category.storeId,
            sortOrder: faker.number.int({ min: 1, max: 100 }),
            customizationGroups: {
              create: Array.from({
                length: faker.number.int({ min: 0, max: 3 }),
              }).map(() => ({
                name: faker.commerce.productAdjective(),
                required: faker.datatype.boolean(),
                minSelectable: faker.number.int({ min: 0, max: 2 }),
                maxSelectable: faker.number.int({ min: 1, max: 5 }),
                customizationOptions: {
                  create: Array.from({
                    length: faker.number.int({ min: 2, max: 5 }),
                  }).map(() => ({
                    name: faker.commerce.productMaterial(),
                    additionalPrice: faker.datatype.boolean()
                      ? faker.commerce.price({ min: 0, max: 5, dec: 2 })
                      : null,
                  })),
                },
              })),
            },
          },
        }),
      ),
    ),
  );

  // Create Restaurant Tables
  const tables = await Promise.all(
    stores.flatMap((store) =>
      Array.from({ length: 10 }).map((_, i) =>
        prisma.restaurantTable.create({
          data: {
            number: `T-${i + 1}`,
            storeId: store.id,
          },
        }),
      ),
    ),
  );

  // Create Table Sessions
  const tableSessions = await Promise.all(
    tables.map((table) =>
      prisma.tableSession.create({
        data: {
          sessionUuid: faker.string.uuid(),
          storeId: table.storeId,
          tableId: table.id,
          status: faker.helpers.arrayElement(Object.values(TableSessionStatus)),
        },
      }),
    ),
  );

  // Create Orders with Chunks
  await Promise.all(
    tableSessions.map(async (session) => {
      const order = await prisma.order.create({
        data: {
          tableSessionId: session.id,
          status: faker.helpers.arrayElement(Object.values(OrderStatus)),
        },
      });

      // Create Order Chunks
      const chunks = await Promise.all(
        Array.from({ length: faker.number.int({ min: 1, max: 3 }) }).map(() =>
          prisma.orderChunk.create({
            data: {
              orderId: order.id,
              status: faker.helpers.arrayElement(Object.values(ChunkStatus)),
            },
          }),
        ),
      );

      // Create Order Chunk Items
      await Promise.all(
        chunks.flatMap((chunk) =>
          Array.from({ length: faker.number.int({ min: 1, max: 5 }) }).map(
            async () => {
              const menuItem = faker.helpers.arrayElement(menuItems);
              const customizationGroups =
                await prisma.customizationGroup.findMany({
                  where: { menuItemId: menuItem.id },
                  include: { customizationOptions: true },
                });

              return prisma.orderChunkItem.create({
                data: {
                  orderChunkId: chunk.id,
                  menuItemId: menuItem.id,
                  price: menuItem.basePrice || 0,
                  quantity: faker.number.int({ min: 1, max: 5 }),
                  customizations: {
                    create: customizationGroups.flatMap((group) =>
                      faker.helpers
                        .arrayElements(group.customizationOptions, {
                          min: 1,
                          max: 2,
                        })
                        .map((option) => ({
                          customizationOptionId: option.id,
                          quantity: 1,
                          finalPrice: option.additionalPrice,
                        })),
                    ),
                  },
                },
              });
            },
          ),
        ),
      );
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(async () => {
    await prisma.$disconnect();
  });
