ALTER TABLE "icebreaker_session" ADD COLUMN "standup_id" varchar(255);--> statement-breakpoint
ALTER TABLE "icebreaker_session" ADD COLUMN "entry_date" date;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ADD CONSTRAINT "icebreaker_session_standup_id_standup_id_fk" FOREIGN KEY ("standup_id") REFERENCES "public"."standup"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "icebreaker_session_standup_date_idx" ON "icebreaker_session" USING btree ("standup_id","entry_date");