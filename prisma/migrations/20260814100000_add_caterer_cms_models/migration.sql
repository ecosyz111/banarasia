-- CreateTable
CREATE TABLE "caterer_package" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceUnitEn" TEXT NOT NULL DEFAULT '/ Plate',
    "priceUnitHi" TEXT NOT NULL DEFAULT '/ प्लेट',
    "badgeEn" TEXT,
    "badgeHi" TEXT,
    "featuresEn" JSONB NOT NULL DEFAULT '[]',
    "featuresHi" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caterer_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caterer_gallery_item" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "captionEn" TEXT NOT NULL,
    "captionHi" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caterer_gallery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caterer_about" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'default',
    "storyTitleEn" TEXT NOT NULL DEFAULT 'Our Story',
    "storyTitleHi" TEXT NOT NULL DEFAULT 'हमारी कहानी',
    "titleEn" TEXT NOT NULL DEFAULT 'Crafting Memorable Celebrations',
    "titleHi" TEXT NOT NULL DEFAULT 'स्मरणोत्सवों को खास बनाना',
    "descriptionEn" TEXT NOT NULL,
    "descriptionHi" TEXT NOT NULL,
    "mottoEn" TEXT NOT NULL DEFAULT '"Swad Adab Se Chakhayenge"',
    "mottoHi" TEXT NOT NULL DEFAULT '"स्वाद अदब से चखायेंगे"',
    "subMottoEn" TEXT DEFAULT 'That''s why we proudly say',
    "subMottoHi" TEXT DEFAULT 'इसलिए हम गर्व से कहते हैं',
    "establishedYear" INTEGER NOT NULL DEFAULT 2015,
    "stats" JSONB NOT NULL DEFAULT '[]',
    "expertise" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caterer_about_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caterer_package_isActive_idx" ON "caterer_package"("isActive");

-- CreateIndex
CREATE INDEX "caterer_package_sortOrder_idx" ON "caterer_package"("sortOrder");

-- CreateIndex
CREATE INDEX "caterer_gallery_item_isActive_idx" ON "caterer_gallery_item"("isActive");

-- CreateIndex
CREATE INDEX "caterer_gallery_item_sortOrder_idx" ON "caterer_gallery_item"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "caterer_about_slug_key" ON "caterer_about"("slug");
