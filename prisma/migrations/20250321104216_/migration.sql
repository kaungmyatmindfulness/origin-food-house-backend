/*
  Warnings:

  - You are about to drop the column `addOnOptions` on the `MenuItem` table. All the data in the column will be lost.
  - You are about to drop the column `sizes` on the `MenuItem` table. All the data in the column will be lost.
  - You are about to drop the column `variations` on the `MenuItem` table. All the data in the column will be lost.
  - You are about to drop the column `addOns` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `OrderChunkItem` table. All the data in the column will be lost.
  - You are about to drop the column `variant` on the `OrderChunkItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MenuItem" DROP COLUMN "addOnOptions",
DROP COLUMN "sizes",
DROP COLUMN "variations";

-- AlterTable
ALTER TABLE "OrderChunkItem" DROP COLUMN "addOns",
DROP COLUMN "size",
DROP COLUMN "variant",
ADD COLUMN     "chosenAddOns" JSONB,
ADD COLUMN     "chosenSizeId" INTEGER,
ADD COLUMN     "chosenVariationId" INTEGER;

-- CreateTable
CREATE TABLE "Variation" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Size" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Size_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "extraPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Size" ADD CONSTRAINT "Size_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOn" ADD CONSTRAINT "AddOn_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
