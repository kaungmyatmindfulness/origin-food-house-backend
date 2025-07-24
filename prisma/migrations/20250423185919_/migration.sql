/*
  Warnings:

  - You are about to drop the column `isAvailable` on the `MenuItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "MenuItem_isAvailable_idx";

-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "isAvailable",
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOutOfStock" BOOLEAN NOT NULL DEFAULT false;
