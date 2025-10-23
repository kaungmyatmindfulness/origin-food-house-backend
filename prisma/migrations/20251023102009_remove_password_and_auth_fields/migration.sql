-- AlterTable
-- Remove password and authentication-related fields since Auth0 handles all authentication
ALTER TABLE "User" DROP COLUMN "password",
DROP COLUMN "verificationToken",
DROP COLUMN "verificationExpiry",
DROP COLUMN "resetToken",
DROP COLUMN "resetTokenExpiry";
