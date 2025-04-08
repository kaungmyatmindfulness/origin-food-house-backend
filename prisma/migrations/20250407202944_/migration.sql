/*
  Warnings:

  - Made the column `basePrice` on table `MenuItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MenuItem" ALTER COLUMN "basePrice" SET NOT NULL;
