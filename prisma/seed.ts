import { PrismaClient, Role } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create Users
  const users = [];
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        password: faker.helpers.slugify(
          faker.internet.password({
            length: 8,
          }),
        ), // In real seeding, hash the password
        name: faker.person.fullName(),
        verified: true,
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users`);

  // 2. Create Stores (3 stores)
  const stores = [];
  for (let i = 0; i < 3; i++) {
    const store = await prisma.store.create({
      data: {
        name: faker.company.name(),
        address: faker.address.streetAddress(),
        phone: faker.phone.number(),
      },
    });
    stores.push(store);
  }
  console.log(`Created ${stores.length} stores`);

  // 3. Assign some users to each store with role OWNER or ADMIN
  for (const store of stores) {
    // Pick a random user to be OWNER
    const owner = users[Math.floor(Math.random() * users.length)];
    await prisma.userStore.create({
      data: {
        userId: owner.id,
        storeId: store.id,
        role: Role.OWNER,
      },
    });
    // Assign 2 more random users as ADMIN
    for (let i = 0; i < 2; i++) {
      const admin = users[Math.floor(Math.random() * users.length)];
      await prisma.userStore.create({
        data: {
          userId: admin.id,
          storeId: store.id,
          role: Role.ADMIN,
        },
      });
    }
  }
  console.log('Assigned users to stores');

  // 4. Create Categories for each store (3 categories per store)
  const categories = [];
  for (const store of stores) {
    for (let i = 0; i < 3; i++) {
      const category = await prisma.category.create({
        data: {
          name: faker.food.adjective(), // e.g., "Spicy Dishes"
          storeId: store.id,
        },
      });
      categories.push(category);
    }
  }
  console.log(`Created ${categories.length} categories`);

  // 5. Create Menu Items for each store (10 menu items per store)
  const menuItems = [];
  for (const store of stores) {
    for (let i = 0; i < 10; i++) {
      // randomly pick a category from those belonging to this store
      const storeCategories = categories.filter((c) => c.storeId === store.id);
      const category =
        storeCategories[Math.floor(Math.random() * storeCategories.length)];

      const menuItem = await prisma.menuItem.create({
        data: {
          name: faker.food.dish(), // e.g., "Kung Pao Chicken"
          description: faker.food.description(),
          basePrice: parseFloat(
            faker.commerce.price({
              min: 5,
              max: 20,
              dec: 2,
            }),
          ),
          imageKey: `uploads/${faker.string.uuid()}-original`,
          categoryId: category ? category.id : null,
          storeId: store.id,
        },
      });
      menuItems.push(menuItem);

      // Create 2 Variations for each MenuItem
      for (let j = 0; j < 2; j++) {
        await prisma.variation.create({
          data: {
            name: faker.commerce.productAdjective(), // e.g., "Extra Spicy"
            extraPrice: parseFloat(
              faker.commerce.price({
                min: 0.5,
                max: 3,
                dec: 2,
              }),
            ),
            menuItemId: menuItem.id,
          },
        });
      }

      // Create 2 Sizes for each MenuItem
      for (let j = 0; j < 2; j++) {
        await prisma.size.create({
          data: {
            name: faker.commerce.productMaterial(), // e.g., "Family Size"
            extraPrice: parseFloat(
              faker.commerce.price({
                min: 0.5,
                max: 3,
                dec: 2,
              }),
            ),
            menuItemId: menuItem.id,
          },
        });
      }

      // Create 2 AddOns for each MenuItem
      for (let j = 0; j < 2; j++) {
        await prisma.addOn.create({
          data: {
            name: faker.commerce.productAdjective(), // e.g., "Extra Cheese"
            extraPrice: parseFloat(
              faker.commerce.price({
                min: 0.2,
                max: 2,
                dec: 2,
              }),
            ),
            menuItemId: menuItem.id,
          },
        });
      }
    }
  }
  console.log(`Created ${menuItems.length} menu items`);

  // 6. Create Restaurant Tables for each store (5 per store)
  const tables = [];
  for (const store of stores) {
    for (let i = 0; i < 5; i++) {
      const table = await prisma.restaurantTable.create({
        data: {
          storeId: store.id,
          number: `Table-${i + 1}`,
        },
      });
      tables.push(table);
    }
  }
  console.log(`Created ${tables.length} restaurant tables`);

  // 7. Create Table Sessions for some tables (simulate active and closed)
  const sessions = [];
  for (const table of tables) {
    // Create one active session for each table
    const session = await prisma.tableSession.create({
      data: {
        storeId: table.storeId,
        tableId: table.id,
        sessionUuid: faker.string.uuid(),
        status: 'ACTIVE',
      },
    });
    sessions.push(session);

    // Optionally, create a closed session for half the tables
    if (Math.random() > 0.5) {
      await prisma.tableSession.create({
        data: {
          storeId: table.storeId,
          tableId: table.id,
          sessionUuid: faker.string.uuid(),
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });
    }
  }
  console.log(`Created ${sessions.length} active table sessions`);

  // 8. Create Orders for each active TableSession and add some OrderChunks
  for (const session of sessions) {
    if (session.status !== 'ACTIVE') continue; // only active sessions

    // Create order for session if not exists
    const order = await prisma.order.create({
      data: {
        tableSessionId: session.id,
        status: 'OPEN',
      },
    });

    // Create 2 order chunks for each order
    for (let i = 0; i < 2; i++) {
      const chunk = await prisma.orderChunk.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
        },
      });

      // For each chunk, add 3 order chunk items using random menu items from the same store
      const storeMenuItems = menuItems.filter(
        (mi) => mi.storeId === session.storeId,
      );
      for (let j = 0; j < 3; j++) {
        const menuItem =
          storeMenuItems[Math.floor(Math.random() * storeMenuItems.length)];
        await prisma.orderChunkItem.create({
          data: {
            orderChunkId: chunk.id,
            menuItemId: menuItem.id,
            price: menuItem.basePrice,
            quantity: faker.number.int({ min: 1, max: 5 }),
            finalPrice: menuItem.basePrice, // For simplicity, not calculating extras here
            // Optionally assign chosenVariationId, chosenSizeId, chosenAddOns, notes:
            notes: faker.lorem.words(3),
          },
        });
      }
    }
  }
  console.log('Seeding completed.');
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
