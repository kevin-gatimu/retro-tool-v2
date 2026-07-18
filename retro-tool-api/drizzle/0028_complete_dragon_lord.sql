DROP INDEX "projection_outbox_status_created_idx";--> statement-breakpoint
-- Backfill existing rows with now() so the NOT NULL add is safe on a populated
-- table; drop the DEFAULT afterward since the app supplies next_attempt_at on
-- every insert (schema $defaultFn) and controls backoff explicitly.
ALTER TABLE "projection_outbox" ADD COLUMN "next_attempt_at" timestamp NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "projection_outbox" ALTER COLUMN "next_attempt_at" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "projection_outbox_status_next_attempt_idx" ON "projection_outbox" USING btree ("status","next_attempt_at");