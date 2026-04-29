-- Add new email log types
ALTER TYPE "public"."email_log_type" ADD VALUE IF NOT EXISTS 'team_invite';--> statement-breakpoint
ALTER TYPE "public"."email_log_type" ADD VALUE IF NOT EXISTS 'team_invite_external';--> statement-breakpoint

-- Create team_invitation table
CREATE TABLE "team_invitation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"tag" "team_member_tag" DEFAULT 'member' NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "team_invitation_token_unique" UNIQUE("token")
);--> statement-breakpoint
ALTER TABLE "team_invitation" ADD CONSTRAINT "team_invitation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitation" ADD CONSTRAINT "team_invitation_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
