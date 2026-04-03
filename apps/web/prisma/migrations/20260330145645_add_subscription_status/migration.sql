-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "themeColors" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "tier" TEXT NOT NULL DEFAULT 'FREE',
    "tierExpiresAt" DATETIME,
    "paidSince" DATETIME,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "creemCustomerId" TEXT,
    "creemSubscriptionId" TEXT,
    "storageUsed" INTEGER NOT NULL DEFAULT 0,
    "onboardedAt" DATETIME
);
INSERT INTO "new_User" ("bio", "createdAt", "creemCustomerId", "creemSubscriptionId", "displayName", "email", "emailVerified", "handle", "id", "image", "isAdmin", "name", "onboardedAt", "paidSince", "storageUsed", "themeColors", "tier", "tierExpiresAt", "updatedAt") SELECT "bio", "createdAt", "creemCustomerId", "creemSubscriptionId", "displayName", "email", "emailVerified", "handle", "id", "image", "isAdmin", "name", "onboardedAt", "paidSince", "storageUsed", "themeColors", "tier", "tierExpiresAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
