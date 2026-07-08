ALTER TYPE "public"."standup_cadence" ADD VALUE 'once';--> statement-breakpoint
CREATE TABLE "standup_skipped_day" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"standup_id" varchar(255) NOT NULL,
	"skip_date" date NOT NULL,
	"created_by_id" varchar(255),
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "standup_skipped_day" ADD CONSTRAINT "standup_skipped_day_standup_id_standup_id_fk" FOREIGN KEY ("standup_id") REFERENCES "public"."standup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_skipped_day" ADD CONSTRAINT "standup_skipped_day_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standup_skipped_day_standup_id_idx" ON "standup_skipped_day" USING btree ("standup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_skipped_day_standup_date_unique" ON "standup_skipped_day" USING btree ("standup_id","skip_date");