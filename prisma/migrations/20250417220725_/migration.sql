/*
  Warnings:

  - You are about to drop the column `sessionUuid` on the `ActiveTableSession` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ActiveTableSession_sessionUuid_key";

-- AlterTable
ALTER TABLE "ActiveTableSession" DROP COLUMN "sessionUuid";
