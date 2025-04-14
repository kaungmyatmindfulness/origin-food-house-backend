-- AlterTable
ALTER TABLE "StoreInformation" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "StoreSetting" ALTER COLUMN "vatRate" SET DEFAULT 0.07,
ALTER COLUMN "serviceChargeRate" SET DEFAULT 0.0;
