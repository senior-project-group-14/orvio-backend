-- Add human-readable transaction codes.
ALTER TABLE "Transaction"
ADD COLUMN "transaction_code" VARCHAR(32);

-- Backfill existing rows with daily sequential codes.
WITH ordered_transactions AS (
  SELECT
    "transaction_id",
    ROW_NUMBER() OVER (
      PARTITION BY DATE("start_time")
      ORDER BY "start_time" ASC, "transaction_id" ASC
    ) AS sequence_number,
    TO_CHAR(DATE("start_time"), 'DDMMYY') AS date_code
  FROM "Transaction"
)
UPDATE "Transaction" AS t
SET "transaction_code" = 'TR-' || ordered_transactions.date_code || '-' || LPAD(ordered_transactions.sequence_number::text, 3, '0')
FROM ordered_transactions
WHERE t."transaction_id" = ordered_transactions."transaction_id";

-- Enforce uniqueness for future inserts.
CREATE UNIQUE INDEX "Transaction_transaction_code_key"
ON "Transaction"("transaction_code");
