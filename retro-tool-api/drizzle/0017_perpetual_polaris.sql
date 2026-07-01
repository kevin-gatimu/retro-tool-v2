DROP TABLE "icebreaker_response" CASCADE;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ALTER COLUMN "status" SET DEFAULT 'waiting'::text;--> statement-breakpoint
DROP TYPE "public"."icebreaker_session_status";--> statement-breakpoint
CREATE TYPE "public"."icebreaker_session_status" AS ENUM('waiting', 'curating', 'presenting', 'completed');--> statement-breakpoint
ALTER TABLE "icebreaker_session" ALTER COLUMN "status" SET DEFAULT 'waiting'::"public"."icebreaker_session_status";--> statement-breakpoint
UPDATE "icebreaker_session" SET "status" = 'presenting' WHERE "status" IN ('responding', 'revealed');--> statement-breakpoint
ALTER TABLE "icebreaker_session" ALTER COLUMN "status" SET DATA TYPE "public"."icebreaker_session_status" USING "status"::"public"."icebreaker_session_status";--> statement-breakpoint
ALTER TABLE "icebreaker_session_prompt" DROP COLUMN "revealed_at";