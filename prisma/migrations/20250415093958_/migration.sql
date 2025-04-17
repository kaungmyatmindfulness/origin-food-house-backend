/*
  Warnings:

  - The values [GBP,AUD,CAD,NZD,INR,IDR,PHP,MYR,VND,PKR,BDT,AED,SAR] on the enum `Currency` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `status` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `tableSessionId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `number` on the `Table` table. All the data in the column will be lost.
  - You are about to drop the `OrderChunk` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderChunkItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderChunkItemCustomization` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TableSession` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[storeId,name,deletedAt]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storeId,name]` on the table `Table` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[verificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storeId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tableName` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Table` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Currency_new" AS ENUM ('THB', 'MMK', 'USD', 'EUR', 'JPY', 'CNY', 'SGD', 'HKD');
ALTER TABLE "StoreSetting" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "StoreSetting" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TYPE "Currency" RENAME TO "Currency_old";
ALTER TYPE "Currency_new" RENAME TO "Currency";
DROP TYPE "Currency_old";
ALTER TABLE "StoreSetting" ALTER COLUMN "currency" SET DEFAULT 'USD';
COMMIT;

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_storeId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationGroup" DROP CONSTRAINT "CustomizationGroup_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "CustomizationOption" DROP CONSTRAINT "CustomizationOption_customizationGroupId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tableSessionId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunk" DROP CONSTRAINT "OrderChunk_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItem" DROP CONSTRAINT "OrderChunkItem_orderChunkId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItemCustomization" DROP CONSTRAINT "OrderChunkItemCustomization_customizationGroupId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItemCustomization" DROP CONSTRAINT "OrderChunkItemCustomization_customizationOptionId_fkey";

-- DropForeignKey
ALTER TABLE "OrderChunkItemCustomization" DROP CONSTRAINT "OrderChunkItemCustomization_orderChunkItemId_fkey";

-- DropForeignKey
ALTER TABLE "StoreInformation" DROP CONSTRAINT "StoreInformation_storeId_fkey";

-- DropForeignKey
ALTER TABLE "StoreSetting" DROP CONSTRAINT "StoreSetting_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Table" DROP CONSTRAINT "Table_storeId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_storeId_fkey";

-- DropForeignKey
ALTER TABLE "TableSession" DROP CONSTRAINT "TableSession_tableId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_storeId_fkey";

-- DropForeignKey
ALTER TABLE "UserStore" DROP CONSTRAINT "UserStore_userId_fkey";

-- DropIndex
DROP INDEX "Category_storeId_name_key";

-- DropIndex
DROP INDEX "MenuItem_storeId_sortOrder_idx";

-- DropIndex
DROP INDEX "Order_tableSessionId_status_idx";

-- DropIndex
DROP INDEX "Table_storeId_number_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status",
DROP COLUMN "tableSessionId",
ADD COLUMN     "storeId" TEXT NOT NULL,
ADD COLUMN     "tableName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Table" DROP COLUMN "number",
ADD COLUMN     "name" TEXT NOT NULL;

-- DropTable
DROP TABLE "OrderChunk";

-- DropTable
DROP TABLE "OrderChunkItem";

-- DropTable
DROP TABLE "OrderChunkItemCustomization";

-- DropTable
DROP TABLE "TableSession";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "TableSessionStatus";

-- CreateTable
CREATE TABLE "ActiveOrder" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "subTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatRateSnapshot" DECIMAL(4,3),
    "serviceChargeRateSnapshot" DECIMAL(4,3),
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "serviceChargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveOrderChunk" (
    "id" TEXT NOT NULL,
    "activeOrderId" TEXT NOT NULL,
    "status" "ChunkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveOrderChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveOrderChunkItem" (
    "id" TEXT NOT NULL,
    "activeOrderChunkId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveOrderChunkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveOrderChunkItemCustomization" (
    "id" TEXT NOT NULL,
    "activeOrderChunkItemId" TEXT NOT NULL,
    "customizationOptionId" TEXT NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveOrderChunkItemCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemCustomization" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customizationOptionId" TEXT NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveOrder_tableId_key" ON "ActiveOrder"("tableId");

-- CreateIndex
CREATE INDEX "ActiveOrderChunk_activeOrderId_status_idx" ON "ActiveOrderChunk"("activeOrderId", "status");

-- CreateIndex
CREATE INDEX "ActiveOrderChunkItem_activeOrderChunkId_idx" ON "ActiveOrderChunkItem"("activeOrderChunkId");

-- CreateIndex
CREATE INDEX "ActiveOrderChunkItem_menuItemId_idx" ON "ActiveOrderChunkItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveOrderChunkItemCustomization_activeOrderChunkItemId_cu_key" ON "ActiveOrderChunkItemCustomization"("activeOrderChunkItemId", "customizationOptionId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemCustomization_orderItemId_customizationOptionId_key" ON "OrderItemCustomization"("orderItemId", "customizationOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_name_deletedAt_key" ON "Category"("storeId", "name", "deletedAt");

-- CreateIndex
CREATE INDEX "MenuItem_storeId_categoryId_sortOrder_idx" ON "MenuItem"("storeId", "categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_isHidden_idx" ON "MenuItem"("isHidden");

-- CreateIndex
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Table_storeId_name_idx" ON "Table"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Table_storeId_name_key" ON "Table"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreInformation" ADD CONSTRAINT "StoreInformation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationGroup" ADD CONSTRAINT "CustomizationGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationOption" ADD CONSTRAINT "CustomizationOption_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrder" ADD CONSTRAINT "ActiveOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrderChunk" ADD CONSTRAINT "ActiveOrderChunk_activeOrderId_fkey" FOREIGN KEY ("activeOrderId") REFERENCES "ActiveOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrderChunkItem" ADD CONSTRAINT "ActiveOrderChunkItem_activeOrderChunkId_fkey" FOREIGN KEY ("activeOrderChunkId") REFERENCES "ActiveOrderChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrderChunkItem" ADD CONSTRAINT "ActiveOrderChunkItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrderChunkItemCustomization" ADD CONSTRAINT "ActiveOrderChunkItemCustomization_activeOrderChunkItemId_fkey" FOREIGN KEY ("activeOrderChunkItemId") REFERENCES "ActiveOrderChunkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrderChunkItemCustomization" ADD CONSTRAINT "ActiveOrderChunkItemCustomization_customizationOptionId_fkey" FOREIGN KEY ("customizationOptionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCustomization" ADD CONSTRAINT "OrderItemCustomization_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCustomization" ADD CONSTRAINT "OrderItemCustomization_customizationOptionId_fkey" FOREIGN KEY ("customizationOptionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
