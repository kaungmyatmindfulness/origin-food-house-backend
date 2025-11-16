/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `MenuItem` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProofUrl` on the `PaymentRequest` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProofUrl` on the `PaymentTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `refundProofUrl` on the `RefundRequest` table. All the data in the column will be lost.
  - You are about to drop the column `coverPhotoUrl` on the `StoreInformation` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `StoreInformation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "imageUrl",
ADD COLUMN     "imagePath" TEXT;

-- AlterTable
ALTER TABLE "PaymentRequest" DROP COLUMN "paymentProofUrl",
ADD COLUMN     "paymentProofPath" TEXT;

-- AlterTable
ALTER TABLE "PaymentTransaction" DROP COLUMN "paymentProofUrl",
ADD COLUMN     "paymentProofPath" TEXT;

-- AlterTable
ALTER TABLE "RefundRequest" DROP COLUMN "refundProofUrl",
ADD COLUMN     "refundProofPath" TEXT;

-- AlterTable
ALTER TABLE "StoreInformation" DROP COLUMN "coverPhotoUrl",
DROP COLUMN "logoUrl",
ADD COLUMN     "coverPhotoPath" TEXT,
ADD COLUMN     "logoPath" TEXT;
