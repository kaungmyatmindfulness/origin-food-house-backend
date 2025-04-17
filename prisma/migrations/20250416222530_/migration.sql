/*
  Warnings:

  - You are about to drop the column `grandTotal` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `serviceChargeAmount` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `serviceChargeRateSnapshot` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `subTotal` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `tableId` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `vatAmount` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `vatRateSnapshot` on the `ActiveOrder` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ActiveOrderChunk` table. All the data in the column will be lost.
  - You are about to drop the column `finalPrice` on the `ActiveOrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `ActiveOrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `OrderItemCustomization` table. All the data in the column will be lost.
  - You are about to drop the `ActiveOrderChunkItemCustomization` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[activeTableSessionId]` on the table `ActiveOrder` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `activeTableSessionId` to the `ActiveOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PreparationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CustomerRequestType" AS ENUM ('CALL_STAFF', 'REQUEST_BILL');

-- CreateEnum
CREATE TYPE "CustomerRequestStatus" AS ENUM ('PENDING', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "ActiveOrder" DROP CONSTRAINT "ActiveOrder_tableId_fkey";

-- DropForeignKey
ALTER TABLE "ActiveOrderChunkItemCustomization" DROP CONSTRAINT "ActiveOrderChunkItemCustomization_activeOrderChunkItemId_fkey";

-- DropForeignKey
ALTER TABLE "ActiveOrderChunkItemCustomization" DROP CONSTRAINT "ActiveOrderChunkItemCustomization_customizationOptionId_fkey";

-- DropIndex
DROP INDEX "ActiveOrder_tableId_key";

-- DropIndex
DROP INDEX "ActiveOrderChunk_activeOrderId_status_idx";

-- AlterTable
ALTER TABLE "ActiveOrder" DROP COLUMN "grandTotal",
DROP COLUMN "serviceChargeAmount",
DROP COLUMN "serviceChargeRateSnapshot",
DROP COLUMN "subTotal",
DROP COLUMN "tableId",
DROP COLUMN "vatAmount",
DROP COLUMN "vatRateSnapshot",
ADD COLUMN     "activeTableSessionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ActiveOrderChunk" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "ActiveOrderChunkItem" DROP COLUMN "finalPrice",
DROP COLUMN "price",
ADD COLUMN     "status" "PreparationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItemCustomization" DROP COLUMN "quantity";

-- DropTable
DROP TABLE "ActiveOrderChunkItemCustomization";

-- DropEnum
DROP TYPE "ChunkStatus";

-- CreateTable
CREATE TABLE "ActiveTableSession" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionUuid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveTableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "activeTableSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRequest" (
    "id" TEXT NOT NULL,
    "activeTableSessionId" TEXT NOT NULL,
    "requestType" "CustomerRequestType" NOT NULL,
    "status" "CustomerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CartItemToCustomizationOption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CartItemToCustomizationOption_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ActiveOrderChunkItemToCustomizationOption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ActiveOrderChunkItemToCustomizationOption_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTableSession_tableId_key" ON "ActiveTableSession"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTableSession_sessionUuid_key" ON "ActiveTableSession"("sessionUuid");

-- CreateIndex
CREATE INDEX "ActiveTableSession_storeId_createdAt_idx" ON "ActiveTableSession"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "ActiveTableSession_tableId_idx" ON "ActiveTableSession"("tableId");

-- CreateIndex
CREATE INDEX "ActiveTableSession_createdAt_idx" ON "ActiveTableSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_activeTableSessionId_key" ON "Cart"("activeTableSessionId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE INDEX "CartItem_menuItemId_idx" ON "CartItem"("menuItemId");

-- CreateIndex
CREATE INDEX "CustomerRequest_activeTableSessionId_status_idx" ON "CustomerRequest"("activeTableSessionId", "status");

-- CreateIndex
CREATE INDEX "_CartItemToCustomizationOption_B_index" ON "_CartItemToCustomizationOption"("B");

-- CreateIndex
CREATE INDEX "_ActiveOrderChunkItemToCustomizationOption_B_index" ON "_ActiveOrderChunkItemToCustomizationOption"("B");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveOrder_activeTableSessionId_key" ON "ActiveOrder"("activeTableSessionId");

-- CreateIndex
CREATE INDEX "ActiveOrderChunk_activeOrderId_idx" ON "ActiveOrderChunk"("activeOrderId");

-- CreateIndex
CREATE INDEX "ActiveOrderChunkItem_activeOrderChunkId_status_idx" ON "ActiveOrderChunkItem"("activeOrderChunkId", "status");

-- CreateIndex
CREATE INDEX "Order_storeId_paidAt_idx" ON "Order"("storeId", "paidAt");

-- AddForeignKey
ALTER TABLE "ActiveTableSession" ADD CONSTRAINT "ActiveTableSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTableSession" ADD CONSTRAINT "ActiveTableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_activeTableSessionId_fkey" FOREIGN KEY ("activeTableSessionId") REFERENCES "ActiveTableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRequest" ADD CONSTRAINT "CustomerRequest_activeTableSessionId_fkey" FOREIGN KEY ("activeTableSessionId") REFERENCES "ActiveTableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveOrder" ADD CONSTRAINT "ActiveOrder_activeTableSessionId_fkey" FOREIGN KEY ("activeTableSessionId") REFERENCES "ActiveTableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartItemToCustomizationOption" ADD CONSTRAINT "_CartItemToCustomizationOption_A_fkey" FOREIGN KEY ("A") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartItemToCustomizationOption" ADD CONSTRAINT "_CartItemToCustomizationOption_B_fkey" FOREIGN KEY ("B") REFERENCES "CustomizationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActiveOrderChunkItemToCustomizationOption" ADD CONSTRAINT "_ActiveOrderChunkItemToCustomizationOption_A_fkey" FOREIGN KEY ("A") REFERENCES "ActiveOrderChunkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActiveOrderChunkItemToCustomizationOption" ADD CONSTRAINT "_ActiveOrderChunkItemToCustomizationOption_B_fkey" FOREIGN KEY ("B") REFERENCES "CustomizationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
