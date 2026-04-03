-- AlterTable
ALTER TABLE "Onboarding" ADD COLUMN "useCaseOther" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CancelFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "prevTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CancelFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CancelFeedback" ("comment", "createdAt", "id", "prevTier", "reason", "userId") SELECT "comment", "createdAt", "id", "prevTier", "reason", "userId" FROM "CancelFeedback";
DROP TABLE "CancelFeedback";
ALTER TABLE "new_CancelFeedback" RENAME TO "CancelFeedback";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
