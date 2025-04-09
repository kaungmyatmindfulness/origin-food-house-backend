-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'SALE', 'CHEF');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('THB', 'MMK', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'INR', 'IDR', 'PHP', 'MYR', 'VND', 'PKR', 'BDT', 'AED', 'SAR');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStore" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "vatRate" DECIMAL(4,3),
    "serviceChargeRate" DECIMAL(4,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "categoryId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelectable" INTEGER NOT NULL DEFAULT 0,
    "maxSelectable" INTEGER NOT NULL DEFAULT 1,
    "menuItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationOption" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "additionalPrice" DECIMAL(10,2),
    "customizationGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "number" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "sessionUuid" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "tableSessionId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChunk" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "ChunkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChunkItem" (
    "id" SERIAL NOT NULL,
    "orderChunkId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChunkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderChunkItemCustomization" (
    "id" SERIAL NOT NULL,
    "orderChunkItemId" INTEGER NOT NULL,
    "customizationOptionId" INTEGER NOT NULL,
    "quantity" INTEGER DEFAULT 1,
    "finalPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customizationGroupId" INTEGER,

    CONSTRAINT "OrderChunkItemCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Store_name_idx" ON "Store"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserStore_userId_storeId_key" ON "UserStore"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_storeId_key" ON "StoreSetting"("storeId");

-- CreateIndex
CREATE INDEX "Category_storeId_sortOrder_idx" ON "Category"("storeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_name_key" ON "Category"("storeId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_storeId_sortOrder_idx" ON "MenuItem"("storeId", "sortOrder");

-- CreateIndex
CREATE INDEX "CustomizationGroup_menuItemId_idx" ON "CustomizationGroup"("menuItemId");

-- CreateIndex
CREATE INDEX "CustomizationOption_customizationGroupId_idx" ON "CustomizationOption"("customizationGroupId");

-- CreateIndex
CREATE INDEX "RestaurantTable_storeId_number_idx" ON "RestaurantTable"("storeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TableSession_sessionUuid_key" ON "TableSession"("sessionUuid");

-- CreateIndex
CREATE INDEX "TableSession_storeId_status_idx" ON "TableSession"("storeId", "status");

-- CreateIndex
CREATE INDEX "TableSession_createdAt_idx" ON "TableSession"("createdAt");

-- CreateIndex
CREATE INDEX "Order_tableSessionId_status_idx" ON "Order"("tableSessionId", "status");

-- CreateIndex
CREATE INDEX "OrderChunk_orderId_status_idx" ON "OrderChunk"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderChunkItem_orderChunkId_idx" ON "OrderChunkItem"("orderChunkId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderChunkItemCustomization_orderChunkItemId_customizationO_key" ON "OrderChunkItemCustomization"("orderChunkItemId", "customizationOptionId");

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStore" ADD CONSTRAINT "UserStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationGroup" ADD CONSTRAINT "CustomizationGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationOption" ADD CONSTRAINT "CustomizationOption_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunk" ADD CONSTRAINT "OrderChunk_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_orderChunkId_fkey" FOREIGN KEY ("orderChunkId") REFERENCES "OrderChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItem" ADD CONSTRAINT "OrderChunkItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_orderChunkItemId_fkey" FOREIGN KEY ("orderChunkItemId") REFERENCES "OrderChunkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_customizationOptionId_fkey" FOREIGN KEY ("customizationOptionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChunkItemCustomization" ADD CONSTRAINT "OrderChunkItemCustomization_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
