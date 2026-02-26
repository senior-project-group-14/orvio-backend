/*
  Warnings:
 
  - You are about to drop the column `status` on the `Alert` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Cooler` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `action_type` on the `TransactionItem` table. All the data in the column will be lost.
  - The `role_id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `status_id` to the `Alert` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_id` to the `Cooler` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_id` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `action_type_id` to the `TransactionItem` table without a default value. This is not possible if the table is not empty.
 
*/
-- DropIndex
DROP INDEX "Alert_status_idx";
 
-- AlterTable
ALTER TABLE "Alert" DROP COLUMN "status",
ADD COLUMN     "status_id" INTEGER NOT NULL;
 
-- AlterTable
ALTER TABLE "Cooler" DROP COLUMN "status",
ADD COLUMN     "status_id" INTEGER NOT NULL;
 
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "status",
ADD COLUMN     "status_id" INTEGER NOT NULL;
 
-- AlterTable
ALTER TABLE "TransactionItem" DROP COLUMN "action_type",
ADD COLUMN     "action_type_id" INTEGER NOT NULL;
 
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role_id",
ADD COLUMN     "role_id" INTEGER NOT NULL DEFAULT 0;
 
-- DropEnum
DROP TYPE "UserRole";
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessReasonLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "AccessReasonLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionTypeLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "ActionTypeLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "AlertStatusLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "AlertStatusLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "DeviceStatusLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "DeviceStatusLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "DisputeReasonLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "DisputeReasonLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "TransactionStatusLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "TransactionStatusLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateTable
CREATE TABLE IF NOT EXISTS "UserRoleLookup" (
    "id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
 
    CONSTRAINT "UserRoleLookup_pkey" PRIMARY KEY ("id")
);
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccessReasonLookup_name_key" ON "AccessReasonLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActionTypeLookup_name_key" ON "ActionTypeLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AlertStatusLookup_name_key" ON "AlertStatusLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceStatusLookup_name_key" ON "DeviceStatusLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DisputeReasonLookup_name_key" ON "DisputeReasonLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionStatusLookup_name_key" ON "TransactionStatusLookup"("name");
 
-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleLookup_name_key" ON "UserRoleLookup"("name");
 
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Alert_status_id_idx" ON "Alert"("status_id");
 
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cooler_status_id_idx" ON "Cooler"("status_id");
 
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_status_id_idx" ON "Transaction"("status_id");
 
-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransactionItem_action_type_id_idx" ON "TransactionItem"("action_type_id");
 
-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_id_idx" ON "User"("role_id");
 
-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "AlertStatusLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "Cooler" ADD CONSTRAINT "Cooler_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "DeviceStatusLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "TransactionStatusLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_action_type_id_fkey" FOREIGN KEY ("action_type_id") REFERENCES "ActionTypeLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 
-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "UserRoleLookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
 