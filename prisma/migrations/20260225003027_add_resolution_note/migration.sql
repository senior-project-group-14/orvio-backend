-- Migration: add_resolution_note
-- Idempotent: Safe to run on databases where columns may already exist

-- Add resolution_note column to Alert table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Alert' AND column_name = 'resolution_note'
    ) THEN
        ALTER TABLE "Alert" ADD COLUMN "resolution_note" TEXT;
    END IF;
END $$;

-- Set default for timestamp column on Alert table
ALTER TABLE "Alert" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;
