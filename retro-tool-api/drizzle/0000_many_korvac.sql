CREATE TYPE "public"."user_role" AS ENUM('super-admin', 'system-admin', 'org-admin', 'team-lead', 'member');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."action_item_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."admin_action_log_action" AS ENUM('user_approved', 'user_rejected', 'user_suspended', 'user_reactivated', 'user_role_changed', 'user_deleted', 'password_reset_triggered');--> statement-breakpoint
CREATE TYPE "public"."email_log_status" AS ENUM('sent', 'bounced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."email_log_type" AS ENUM('verification', 'weekly_digest', 'retro_reminder', 'team_activity', 'account_approved', 'org_invite', 'retro_report');--> statement-breakpoint
CREATE TYPE "public"."estimate_session_status" AS ENUM('waiting', 'voting', 'revealed', 'completed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('user_signup', 'team_join_request', 'team_join_approved', 'team_join_rejected', 'org_invite', 'retro_created', 'retro_lobby_open', 'retro_started', 'retro_completed', 'action_item_assigned', 'action_item_due_soon', 'estimate_session_created');--> statement-breakpoint
CREATE TYPE "public"."org_member_role" AS ENUM('org-owner', 'org-admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."retro_reminder_type" AS ENUM('before_retro', 'after_retro', 'custom');--> statement-breakpoint
CREATE TYPE "public"."retro_status" AS ENUM('draft', 'waiting', 'active', 'grouping', 'voting', 'discussing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."retro_vote_type" AS ENUM('multi', 'single');--> statement-breakpoint
CREATE TYPE "public"."team_join_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('Dev', 'QA', 'QE', 'QA/QE', 'DevOps', 'BI-Dev', 'Oversight');--> statement-breakpoint
CREATE TYPE "public"."team_member_tag" AS ENUM('team-lead', 'member');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_action_log" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" "admin_action_log_action" NOT NULL,
	"details" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"bio" text,
	"last_active_at" timestamp,
	"approved_at" timestamp,
	"approved_by_id" text,
	"suspended_at" timestamp,
	"suspended_by_id" text,
	"suspended_reason" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "email_log_type" NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"html_body" text NOT NULL,
	"status" "email_log_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_estimate_participant" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_estimate_round" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"round_number" integer NOT NULL,
	"story_name" varchar(255) NOT NULL,
	"ticket_number" varchar(100) NOT NULL,
	"story_description" text,
	"story_link" varchar(2048),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"revealed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_estimate_session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"status" "estimate_session_status" DEFAULT 'waiting' NOT NULL,
	"sprint_link" varchar(2048),
	"current_round_id" varchar(255),
	"current_story" text,
	"timer_duration" integer,
	"timer_ends_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_estimate_vote" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"round_id" varchar(255),
	"voter_id" varchar(255) NOT NULL,
	"points" varchar(20) NOT NULL,
	"voted_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"link" varchar(2048),
	"read" boolean DEFAULT false NOT NULL,
	"metadata" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo" varchar(2048),
	"owner_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retro_reminder" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"retro_id" varchar(255),
	"created_by_id" varchar(255) NOT NULL,
	"type" "retro_reminder_type" NOT NULL,
	"schedule" varchar(255) NOT NULL,
	"message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_item" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"retro_id" varchar(255) NOT NULL,
	"card_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"description" text,
	"assignee_id" varchar(255),
	"status" "action_item_status" DEFAULT 'pending' NOT NULL,
	"is_carried_forward" boolean DEFAULT false NOT NULL,
	"due_date" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_item_comment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"action_item_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_item_like" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"action_item_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"retro_id" varchar(255) NOT NULL,
	"column_id" varchar(255) NOT NULL,
	"author_id" varchar(255),
	"content" text NOT NULL,
	"is_discussed" boolean DEFAULT false NOT NULL,
	"discussed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_comment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retro_participant" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"retro_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"joined_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrospective" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"status" "retro_status" DEFAULT 'draft' NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"max_votes_per_user" integer DEFAULT 3 NOT NULL,
	"vote_type" "retro_vote_type" DEFAULT 'multi' NOT NULL,
	"timer_duration" integer,
	"timer_started_at" timestamp,
	"timer_ends_at" timestamp,
	"created_by_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"scheduled_at" timestamp,
	"reminder_sent_at" timestamp,
	"lobby_started_at" timestamp,
	"lobby_auto_starts_at" timestamp,
	"current_discussion_card_id" varchar(255),
	"current_discussion_action_item_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"organization_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_column" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"emoji" varchar(100),
	"prompt" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"emoji" varchar(100) DEFAULT '👥',
	"organization_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_join_request" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"status" "team_join_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"reviewed_by_id" varchar(255),
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "team_member_role",
	"tag" "team_member_tag" DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preference" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"email_verification_reminders" boolean DEFAULT true NOT NULL,
	"weekly_digest_enabled" boolean DEFAULT true NOT NULL,
	"weekly_digest_day" varchar(50) DEFAULT 'monday' NOT NULL,
	"retrospective_reminders_enabled" boolean DEFAULT true NOT NULL,
	"retrospective_reminder_hours" integer DEFAULT 24 NOT NULL,
	"team_activity_emails_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_notification_preference_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_digest" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"day_of_week" integer DEFAULT 1 NOT NULL,
	"hour_of_day" integer DEFAULT 9 NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"include_metrics" boolean DEFAULT true NOT NULL,
	"include_action_items" boolean DEFAULT true NOT NULL,
	"include_upcoming_retros" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action_log" ADD CONSTRAINT "admin_action_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action_log" ADD CONSTRAINT "admin_action_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_participant" ADD CONSTRAINT "story_estimate_participant_session_id_story_estimate_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."story_estimate_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_participant" ADD CONSTRAINT "story_estimate_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_round" ADD CONSTRAINT "story_estimate_round_session_id_story_estimate_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."story_estimate_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_session" ADD CONSTRAINT "story_estimate_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_session" ADD CONSTRAINT "story_estimate_session_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_vote" ADD CONSTRAINT "story_estimate_vote_session_id_story_estimate_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."story_estimate_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_vote" ADD CONSTRAINT "story_estimate_vote_round_id_story_estimate_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."story_estimate_round"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_vote" ADD CONSTRAINT "story_estimate_vote_voter_id_user_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retro_reminder" ADD CONSTRAINT "retro_reminder_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retro_reminder" ADD CONSTRAINT "retro_reminder_retro_id_retrospective_id_fk" FOREIGN KEY ("retro_id") REFERENCES "public"."retrospective"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retro_reminder" ADD CONSTRAINT "retro_reminder_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_retro_id_retrospective_id_fk" FOREIGN KEY ("retro_id") REFERENCES "public"."retrospective"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item" ADD CONSTRAINT "action_item_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item_comment" ADD CONSTRAINT "action_item_comment_action_item_id_action_item_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item_comment" ADD CONSTRAINT "action_item_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item_like" ADD CONSTRAINT "action_item_like_action_item_id_action_item_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_item_like" ADD CONSTRAINT "action_item_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_retro_id_retrospective_id_fk" FOREIGN KEY ("retro_id") REFERENCES "public"."retrospective"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_column_id_template_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."template_column"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_comment" ADD CONSTRAINT "card_comment_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_comment" ADD CONSTRAINT "card_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retro_participant" ADD CONSTRAINT "retro_participant_retro_id_retrospective_id_fk" FOREIGN KEY ("retro_id") REFERENCES "public"."retrospective"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retro_participant" ADD CONSTRAINT "retro_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrospective" ADD CONSTRAINT "retrospective_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_column" ADD CONSTRAINT "template_column_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_request" ADD CONSTRAINT "team_join_request_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_request" ADD CONSTRAINT "team_join_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_request" ADD CONSTRAINT "team_join_request_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digest" ADD CONSTRAINT "weekly_digest_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_digest" ADD CONSTRAINT "weekly_digest_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;