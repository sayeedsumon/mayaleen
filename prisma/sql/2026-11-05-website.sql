-- Phase 3 (public website) + Phase 4 (notifications outbox). Idempotent.
DO $$ BEGIN CREATE TYPE "Channel" AS ENUM ('SMS', 'EMAIL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'LOGGED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelRequestReason" TEXT, ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "ProofFile" ("id" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL, "data" BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ProofFile_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "SiteContent" ("key" TEXT NOT NULL, "en" TEXT NOT NULL DEFAULT '', "bn" TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key"));
CREATE TABLE IF NOT EXISTS "Message" ("id" TEXT NOT NULL, "bookingId" TEXT, "event" TEXT NOT NULL, "channel" "Channel" NOT NULL, "to" TEXT NOT NULL, "subject" TEXT, "body" TEXT NOT NULL, "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED', "error" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), CONSTRAINT "Message_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "ProofFile_paymentId_key" ON "ProofFile"("paymentId");
CREATE INDEX IF NOT EXISTS "Message_bookingId_idx" ON "Message"("bookingId");
CREATE INDEX IF NOT EXISTS "Message_status_createdAt_idx" ON "Message"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Message_bookingId_event_channel_to_key" ON "Message"("bookingId", "event", "channel", "to");
