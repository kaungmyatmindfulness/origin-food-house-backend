/*
  Warnings:

  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `OrderChunk` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `TableSession` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PAID');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "OrderChunk" DROP COLUMN "status",
ADD COLUMN     "status" "ChunkStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TableSession" DROP COLUMN "status",
ADD COLUMN     "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "AddOn_menuItemId_idx" ON "AddOn"("menuItemId");

-- CreateIndex
CREATE INDEX "Category_shopId_idx" ON "Category"("shopId");

-- CreateIndex
CREATE INDEX "MenuItem_shopId_idx" ON "MenuItem"("shopId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "Order_tableSessionId_status_idx" ON "Order"("tableSessionId", "status");

-- CreateIndex
CREATE INDEX "OrderChunk_orderId_status_idx" ON "OrderChunk"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderChunkItem_orderChunkId_idx" ON "OrderChunkItem"("orderChunkId");

-- CreateIndex
CREATE INDEX "OrderChunkItem_menuItemId_idx" ON "OrderChunkItem"("menuItemId");

-- CreateIndex
CREATE INDEX "RestaurantTable_shopId_idx" ON "RestaurantTable"("shopId");

-- CreateIndex
CREATE INDEX "Size_menuItemId_idx" ON "Size"("menuItemId");

-- CreateIndex
CREATE INDEX "TableSession_shopId_status_idx" ON "TableSession"("shopId", "status");

-- CreateIndex
CREATE INDEX "Variation_menuItemId_idx" ON "Variation"("menuItemId");
