/*
  Warnings:

  - You are about to drop the column `isHidden` on the `MenuItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "MenuItem_isHidden_idx";

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "isHidden",
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StoreInformation" ADD COLUMN     "coverPhotoUrl" TEXT;

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");
