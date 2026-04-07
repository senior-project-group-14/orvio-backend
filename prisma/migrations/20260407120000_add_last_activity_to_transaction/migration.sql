-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Transaction_last_activity_idx" ON "Transaction"("last_activity");
