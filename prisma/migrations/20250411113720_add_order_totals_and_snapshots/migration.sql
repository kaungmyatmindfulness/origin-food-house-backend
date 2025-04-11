-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tableSessionId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "grandTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceChargeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceChargeRateSnapshot" DECIMAL(4,3),
ADD COLUMN     "subTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
