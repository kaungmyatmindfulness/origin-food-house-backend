import { Prisma, Role, User, UserStore } from '@prisma/client';

// Define a type for the user profile response structure
// Omit sensitive fields from base User, add specific relations/properties
export type UserProfileResponse = Omit<
  User,
  | 'password'
  | 'verificationToken'
  | 'verificationExpiry'
  | 'resetToken'
  | 'resetTokenExpiry'
  | 'userStores' // Omit base userStores if redefining below
> & {
  userStores: Array<UserStore & { store: Prisma.StoreGetPayload<true> }>; // Ensure store is included
  currentStore: Prisma.StoreGetPayload<true> | null;
  currentRole: Role | null;
};
