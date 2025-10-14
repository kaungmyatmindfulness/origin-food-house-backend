/**
 * Helper to create a properly typed Prisma mock for testing
 * This avoids TypeScript errors with jest.fn() on Prisma methods
 */
export const createPrismaMock = () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  store: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  userStore: {
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  category: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    aggregate: jest.fn(),
  },
  menuItem: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    aggregate: jest.fn(),
  },
  table: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
  },
  customizationGroup: {
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  customizationOption: {
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  storeInformation: {
    update: jest.fn(),
  },
  storeSetting: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

export type PrismaMock = ReturnType<typeof createPrismaMock>;
