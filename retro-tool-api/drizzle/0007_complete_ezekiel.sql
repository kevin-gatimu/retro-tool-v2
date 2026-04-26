CREATE TABLE "convex_cron_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"schedule" varchar(100) DEFAULT '0 0 * * 0' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"tables_to_clear" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp NOT NULL,
	"updated_by_user_id" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "convex_cron_config" ADD CONSTRAINT "convex_cron_config_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;