-- AlterTable
ALTER TABLE "User" ADD COLUMN "auth0Id" TEXT;
ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_auth0Id_key" ON "User"("auth0Id");