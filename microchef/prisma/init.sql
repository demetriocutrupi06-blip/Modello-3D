-- CreateTable
CREATE TABLE "Oven" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ManualDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ovenId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualDocument_ovenId_fkey" FOREIGN KEY ("ovenId") REFERENCES "Oven" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "manualId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pageFrom" INTEGER NOT NULL,
    "pageTo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "ManualSection_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "ManualDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawText" TEXT NOT NULL,
    "servings" INTEGER,
    "dishCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdaptedRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "ovenId" TEXT NOT NULL,
    "feasibility" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdaptedRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdaptedRecipe_ovenId_fkey" FOREIGN KEY ("ovenId") REFERENCES "Oven" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ovenId" TEXT NOT NULL,
    "adaptedId" TEXT,
    "dishCategory" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "appliedFactor" REAL NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_ovenId_fkey" FOREIGN KEY ("ovenId") REFERENCES "Oven" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalEntry_adaptedId_fkey" FOREIGN KEY ("adaptedId") REFERENCES "AdaptedRecipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ovenId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "people" INTEGER NOT NULL,
    CONSTRAINT "MealPlan_ovenId_fkey" FOREIGN KEY ("ovenId") REFERENCES "Oven" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "meal" TEXT NOT NULL,
    "adaptedId" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    CONSTRAINT "MealPlanEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealPlanEntry_adaptedId_fkey" FOREIGN KEY ("adaptedId") REFERENCES "AdaptedRecipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    CONSTRAINT "ShoppingList_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL,
    "unit" TEXT,
    "aisle" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ShoppingItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tariffEurKwh" REAL NOT NULL DEFAULT 0.30,
    "activeOvenId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualDocument_ovenId_key" ON "ManualDocument"("ovenId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualSection_manualId_slug_key" ON "ManualSection"("manualId", "slug");

-- CreateIndex
CREATE INDEX "JournalEntry_ovenId_dishCategory_idx" ON "JournalEntry"("ovenId", "dishCategory");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingList_planId_key" ON "ShoppingList"("planId");

