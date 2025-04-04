/*
  Warnings:

  - You are about to drop the column `chosenAddOns` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `chosenSizeId` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `chosenVariationId` on the `OrderChunkItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "RestaurantTable_storeId_idx";

-- AlterTable
ALTER TABLE "MenuItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "OrderChunkItem" DROP COLUMN "chosenAddOns",
DROP COLUMN "chosenSizeId",
DROP COLUMN "chosenVariationId",
ADD COLUMN     "addOnIds" INTEGER,
ADD COLUMN     "addOnsCopy" JSONB,
ADD COLUMN     "sizeCopy" JSONB,
ADD COLUMN     "sizeId" INTEGER,
ADD COLUMN     "variationCopy" JSONB,
ADD COLUMN     "variationId" INTEGER;

-- CreateIndex
CREATE INDEX "Category_storeId_sortOrder_idx" ON "Category"("storeId", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_storeId_sortOrder_idx" ON "MenuItem"("storeId", "sortOrder");

-- CreateIndex
CREATE INDEX "RestaurantTable_storeId_number_idx" ON "RestaurantTable"("storeId", "number");

-- CreateIndex
CREATE INDEX "TableSession_tableId_idx" ON "TableSession"("tableId");

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_addOnIds_fkey" FOREIGN KEY ("addOnIds") REFERENCES "AddOn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
