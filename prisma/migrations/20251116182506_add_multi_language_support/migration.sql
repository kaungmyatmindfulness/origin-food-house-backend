-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "enabledLocales" TEXT[] DEFAULT ARRAY['en']::TEXT[],
ADD COLUMN     "multiLanguageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "multiLanguageMigratedAt" TIMESTAMP(3),
ADD COLUMN     "primaryLocale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemTranslation" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationGroupTranslation" (
    "id" TEXT NOT NULL,
    "customizationGroupId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationGroupTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationOptionTranslation" (
    "id" TEXT NOT NULL,
    "customizationOptionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomizationOptionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryTranslation_categoryId_idx" ON "CategoryTranslation"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryTranslation_locale_idx" ON "CategoryTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "MenuItemTranslation_menuItemId_idx" ON "MenuItemTranslation"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemTranslation_locale_idx" ON "MenuItemTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemTranslation_menuItemId_locale_key" ON "MenuItemTranslation"("menuItemId", "locale");

-- CreateIndex
CREATE INDEX "CustomizationGroupTranslation_customizationGroupId_idx" ON "CustomizationGroupTranslation"("customizationGroupId");

-- CreateIndex
CREATE INDEX "CustomizationGroupTranslation_locale_idx" ON "CustomizationGroupTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CustomizationGroupTranslation_customizationGroupId_locale_key" ON "CustomizationGroupTranslation"("customizationGroupId", "locale");

-- CreateIndex
CREATE INDEX "CustomizationOptionTranslation_customizationOptionId_idx" ON "CustomizationOptionTranslation"("customizationOptionId");

-- CreateIndex
CREATE INDEX "CustomizationOptionTranslation_locale_idx" ON "CustomizationOptionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CustomizationOptionTranslation_customizationOptionId_locale_key" ON "CustomizationOptionTranslation"("customizationOptionId", "locale");

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemTranslation" ADD CONSTRAINT "MenuItemTranslation_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationGroupTranslation" ADD CONSTRAINT "CustomizationGroupTranslation_customizationGroupId_fkey" FOREIGN KEY ("customizationGroupId") REFERENCES "CustomizationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationOptionTranslation" ADD CONSTRAINT "CustomizationOptionTranslation_customizationOptionId_fkey" FOREIGN KEY ("customizationOptionId") REFERENCES "CustomizationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
