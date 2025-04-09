-- DropIndex
DROP INDEX "Category_storeId_name_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "deletedAt" TIMESTAMP(3);
