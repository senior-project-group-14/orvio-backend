-- Create table for per-admin alert read tracking.
CREATE TABLE "AdminAlertRead" (
    "admin_user_id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAlertRead_pkey" PRIMARY KEY ("admin_user_id","alert_id")
);

-- Add foreign keys.
ALTER TABLE "AdminAlertRead"
ADD CONSTRAINT "AdminAlertRead_admin_user_id_fkey"
FOREIGN KEY ("admin_user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminAlertRead"
ADD CONSTRAINT "AdminAlertRead_alert_id_fkey"
FOREIGN KEY ("alert_id") REFERENCES "Alert"("alert_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes.
CREATE INDEX "AdminAlertRead_admin_user_id_read_at_idx" ON "AdminAlertRead"("admin_user_id", "read_at");
CREATE INDEX "AdminAlertRead_alert_id_idx" ON "AdminAlertRead"("alert_id");
