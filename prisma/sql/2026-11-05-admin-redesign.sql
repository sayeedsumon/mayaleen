-- Applied to Neon on 2026-11-05 for the admin redesign (additive; no data removed).
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "checkoutNotes" TEXT;
ALTER TABLE "BookingGuest" ADD COLUMN IF NOT EXISTS "cabinName" TEXT;
CREATE TABLE IF NOT EXISTS "LoginAttempt" ("key" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "until" TIMESTAMP(3) NOT NULL, CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key"));
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_number_revision_key" ON "Invoice"("number", "revision");
DROP INDEX IF EXISTS "Invoice_number_key";
