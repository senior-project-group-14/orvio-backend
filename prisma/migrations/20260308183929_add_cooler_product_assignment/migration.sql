-- CreateTable
CREATE TABLE "CoolerProduct" (
    "device_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "max_capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CoolerProduct_pkey" PRIMARY KEY ("device_id","product_id")
);

-- CreateIndex
CREATE INDEX "CoolerProduct_product_id_idx" ON "CoolerProduct"("product_id");

-- AddForeignKey
ALTER TABLE "CoolerProduct" ADD CONSTRAINT "CoolerProduct_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Cooler"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolerProduct" ADD CONSTRAINT "CoolerProduct_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
