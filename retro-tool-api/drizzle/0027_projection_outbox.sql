CREATE TABLE "projection_outbox" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"projection" varchar(64) NOT NULL,
	"operation" varchar(16) NOT NULL,
	"entity_key" varchar(512) NOT NULL,
	"payload" jsonb,
	"dedupe_key" varchar(512) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp NOT NULL,
	"dispatched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "projection_outbox_control" (
	"id" varchar(36) PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp NOT NULL,
	"updated_by_user_id" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "projection_outbox_control" ADD CONSTRAINT "projection_outbox_control_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projection_outbox_status_created_idx" ON "projection_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "projection_outbox_dedupe_idx" ON "projection_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "projection_outbox_projection_idx" ON "projection_outbox" USING btree ("projection");