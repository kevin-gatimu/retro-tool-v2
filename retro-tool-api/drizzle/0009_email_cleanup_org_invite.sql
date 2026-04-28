-- Drop retro_reminder and weekly_digest tables
DROP TABLE IF EXISTS "retro_reminder";--> statement-breakpoint
DROP TABLE IF EXISTS "weekly_digest";--> statement-breakpoint

-- Drop removed columns from user_notification_preference
ALTER TABLE "user_notification_preference" DROP COLUMN IF EXISTS "retrospective_reminders_enabled";--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP COLUMN IF EXISTS "retrospective_reminder_hours";--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP COLUMN IF EXISTS "weekly_digest_enabled";--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP COLUMN IF EXISTS "weekly_digest_day";--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP COLUMN IF EXISTS "team_activity_emails_enabled";--> statement-breakpoint

-- Drop retro_reminder_type enum (no longer used)
DROP TYPE IF EXISTS "public"."retro_reminder_type";--> statement-breakpoint

-- Add org_invite_external value to email_log_type enum
ALTER TYPE "public"."email_log_type" ADD VALUE IF NOT EXISTS 'org_invite_external';--> statement-breakpoint

-- Add org_invitation table
CREATE TABLE "org_invitation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "org_invitation_token_unique" UNIQUE("token")
);--> statement-breakpoint
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitation" ADD CONSTRAINT "org_invitation_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
