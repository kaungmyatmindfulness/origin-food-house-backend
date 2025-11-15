-- AlterTable
ALTER TABLE "CustomizationOption" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "CustomizationOption_customizationGroupId_sortOrder_idx" ON "CustomizationOption"("customizationGroupId", "sortOrder");
