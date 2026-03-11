/*
  Warnings:

  - A unique constraint covering the columns `[ai_label]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ai_label" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "Product_ai_label_key" ON "Product"("ai_label");
