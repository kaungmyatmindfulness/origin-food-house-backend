import { Prisma } from '@prisma/client';

// Define a reusable select object to exclude password and sensitive tokens
export const userSelectPublic = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  name: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
  // Add other non-sensitive fields as needed
});

// Define the public payload type based on the select object
export type UserPublicPayload = Prisma.UserGetPayload<{
  select: typeof userSelectPublic;
}>;

// Define a reusable select object for user with stores (excluding password)
export const userSelectWithStores = Prisma.validator<Prisma.UserSelect>()({
  ...userSelectPublic,
  userStores: {
    include: {
      store: {
        include: {
          information: true,
        },
      },
    },
  },
});

// Define the public payload type for user with stores
export type UserWithStoresPublicPayload = Prisma.UserGetPayload<{
  select: typeof userSelectWithStores;
}>;

// Type for only the password field, used internally
export type UserPasswordPayload = Prisma.UserGetPayload<{
  select: { password: true };
}>;
