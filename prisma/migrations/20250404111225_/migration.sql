/*
  Warnings:

  - The values [DONE] on the enum `ChunkStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SALE] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `basePrice` on the `MenuItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `addOnIds` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `addOnsCopy` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `sizeCopy` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `sizeId` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `variationCopy` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `variationId` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `OrderChunkItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `finalPrice` on the `OrderChunkItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the `AddOn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Size` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Variation` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `categoryId` on table `MenuItem` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('THB', 'MMK', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'INR', 'IDR', 'PHP', 'MYR', 'VND', 'PKR', 'BDT', 'AED', 'SAR');

-- AlterEnum
BEGIN;
CREATE TYPE "ChunkStatus_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
ALTER TABLE "OrderChunk" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "OrderChunk" ALTER COLUMN "status" TYPE "ChunkStatus_new" USING ("status"::text::"ChunkStatus_new");
ALTER TYPE "ChunkStatus" RENAME TO "ChunkStatus_old";
ALTER TYPE "ChunkStatus_new" RENAME TO "ChunkStatus";
DROP TYPE "ChunkStatus_old";
ALTER TABLE "OrderChunk" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CHEF');
ALTER TABLE "UserStore" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AddOn" DROP CONSTRAINT "AddOn_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_storeId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunk" DROP CONSTRAINT "OrderChunk_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_addOnIds_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_orderChunkId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_sizeId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_variationId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantTable" DROP CONSTRAINT "RestaurantTable_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Size" DROP CONSTRAINT "Size_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_storeId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_tableId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_storeId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_userId_fkey";

-- DropForeignKey
ALTER TABLE "Variation" DROP CONSTRAINT "Variation_menuItemId_fkey";

-- DropIndex
DROP INDEX "Category_storeId_idx";

-- DropIndex
DROP INDEX "MenuItem_categoryId_idx";

-- DropIndex
DROP INDEX "MenuItem_storeId_idx";

-- DropIndex
DROP INDEX "Order_tableSessionId_key";

-- DropIndex
DROP INDEX "OrderChunkItem_menuItemId_idx";

-- DropIndex
DROP INDEX "TableSession_tableId_idx";

-- AlterTable
ALTER TABLE "MenuItem" ALTER COLUMN "categoryId" SET NOT NULL,
ALTER COLUMN "basePrice" DROP NOT NULL,
ALTER COLUMN "basePrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "OrderChunkItem" DROP COLUMN "addOnIds",
DROP COLUMN "addOnsCopy",
DROP COLUMN "sizeCopy",
DROP COLUMN "sizeId",
DROP COLUMN "variationCopy",
DROP COLUMN "variationId",
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "finalPrice" SET DATA TYPE DECIMAL(10,2);

-- DropTable
DROP TABLE "AddOn";

-- DropTable
DROP TABLE "Size";

-- DropTable
DROP TABLE "Variation";

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "vatRate" DECIMAL(4,3),
    "serviceChargeRate" DECIMAL(4,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelectable" INTEGER NOT NULL DEFAULT 0,
    "maxSelectable" INTEGER NOT NULL DEFAULT 1,
    "menuItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationOption" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "additionalPrice" DECIMAL(10,2),
    "customizationGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChunkItemCustomization" (
    "id" SERIAL NOT NULL,
    "orderChunkItemId" INTEGER NOT NULL,
    "customizationOptionId" INTEGER NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customizationGroupId" INTEGER,

    CONSTRAINT "OrderChunkItemCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_storeId_key" ON "StoreSetting"("storeId");

-- CreateIndex
CREATE INDEX "CustomizationGroup_menuItemId_idx" ON "CustomizationGroup"("menuItemId");

-- CreateIndex
CREATE INDEX "CustomizationOption_customizationGroupId_idx" ON "CustomizationOption"("customizationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderChunkItemCustomization_orderChunkItemId_customizationO_key" ON "OrderChunkItemCustomization"("orderChunkItemId", "customizationOptionId");

-- CreateIndex
CREATE INDEX "Store_name_idx" ON "Store"("name");

-- CreateIndex
CREATE INDEX "TableSession_createdAt_idx" ON "TableSession"("createdAt");

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationGroup" ADD CONSTRAINT "CustomizationGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationOption" ADD CONSTRAINT "CustomizationOption_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunk" ADD CONSTRAINT "OrderChunk_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_orderChunkId_fkey" FOREIGN KEY ("orderChunkId") REFERENCES "OrderChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_orderChunkItemId_fkey" FOREIGN KEY ("orderChunkItemId") REFERENCES "OrderChunkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_customizationOptionId_fkey" FOREIGN KEY ("customizationOptionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
