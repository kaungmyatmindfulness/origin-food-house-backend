/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `MenuItem` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MenuItem` table. All the data in the column will be lost.
  - Added the required column `basePrice` to the `MenuItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "imageUrl",
DROP COLUMN "price",
ADD COLUMN     "addOnOptions" JSONB,
ADD COLUMN     "basePrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "sizes" JSONB,
ADD COLUMN     "variations" JSONB;
