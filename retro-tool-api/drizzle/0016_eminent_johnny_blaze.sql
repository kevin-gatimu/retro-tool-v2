CREATE TYPE "public"."icebreaker_flavour" AS ENUM('fun', 'professional', 'creative');--> statement-breakpoint
CREATE TYPE "public"."icebreaker_prompt_decision" AS ENUM('pending', 'kept', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."icebreaker_session_status" AS ENUM('waiting', 'curating', 'responding', 'revealed', 'completed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'icebreaker_session_created' BEFORE 'convex_table_clear';--> statement-breakpoint
CREATE TABLE "icebreaker_participant" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icebreaker_prompt" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"color" varchar(7)
);
--> statement-breakpoint
CREATE TABLE "icebreaker_response" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"session_prompt_id" varchar(255),
	"responder_id" varchar(255) NOT NULL,
	"answer" text NOT NULL,
	"responded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icebreaker_session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"created_by_id" varchar(255) NOT NULL,
	"status" "icebreaker_session_status" DEFAULT 'waiting' NOT NULL,
	"template_id" varchar(255),
	"current_prompt_id" varchar(255),
	"selection_mode" varchar(20) DEFAULT 'ordered' NOT NULL,
	"seed" integer NOT NULL,
	"flavour_filter" "icebreaker_flavour",
	"timer_duration" integer,
	"timer_ends_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icebreaker_session_prompt" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"prompt_id" varchar(255),
	"text" text NOT NULL,
	"deck_order" integer NOT NULL,
	"decision" "icebreaker_prompt_decision" DEFAULT 'pending' NOT NULL,
	"presented_at" timestamp,
	"revealed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icebreaker_template" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"flavour" "icebreaker_flavour" DEFAULT 'fun' NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"organization_id" varchar(255),
	"color" varchar(7),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "icebreaker_participant" ADD CONSTRAINT "icebreaker_participant_session_id_icebreaker_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_participant" ADD CONSTRAINT "icebreaker_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_prompt" ADD CONSTRAINT "icebreaker_prompt_template_id_icebreaker_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."icebreaker_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_response" ADD CONSTRAINT "icebreaker_response_session_id_icebreaker_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_response" ADD CONSTRAINT "icebreaker_response_session_prompt_id_icebreaker_session_prompt_id_fk" FOREIGN KEY ("session_prompt_id") REFERENCES "public"."icebreaker_session_prompt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_response" ADD CONSTRAINT "icebreaker_response_responder_id_user_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ADD CONSTRAINT "icebreaker_session_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ADD CONSTRAINT "icebreaker_session_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_session" ADD CONSTRAINT "icebreaker_session_template_id_icebreaker_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."icebreaker_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_session_prompt" ADD CONSTRAINT "icebreaker_session_prompt_session_id_icebreaker_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_session_prompt" ADD CONSTRAINT "icebreaker_session_prompt_prompt_id_icebreaker_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."icebreaker_prompt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_template" ADD CONSTRAINT "icebreaker_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "icebreaker_participant_session_id_idx" ON "icebreaker_participant" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "icebreaker_participant_user_id_idx" ON "icebreaker_participant" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "icebreaker_participant_session_user_unique" ON "icebreaker_participant" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "icebreaker_prompt_template_id_idx" ON "icebreaker_prompt" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "icebreaker_prompt_template_order_unique" ON "icebreaker_prompt" USING btree ("template_id","order");--> statement-breakpoint
CREATE INDEX "icebreaker_response_session_id_idx" ON "icebreaker_response" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "icebreaker_response_session_prompt_id_idx" ON "icebreaker_response" USING btree ("session_prompt_id");--> statement-breakpoint
CREATE INDEX "icebreaker_response_responder_id_idx" ON "icebreaker_response" USING btree ("responder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "icebreaker_response_prompt_responder_unique" ON "icebreaker_response" USING btree ("session_prompt_id","responder_id");--> statement-breakpoint
CREATE INDEX "icebreaker_session_team_id_idx" ON "icebreaker_session" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "icebreaker_session_created_by_id_idx" ON "icebreaker_session" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "icebreaker_session_status_idx" ON "icebreaker_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "icebreaker_session_template_id_idx" ON "icebreaker_session" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "icebreaker_session_team_status_idx" ON "icebreaker_session" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "icebreaker_session_updated_at_idx" ON "icebreaker_session" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "icebreaker_session_prompt_session_id_idx" ON "icebreaker_session_prompt" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "icebreaker_session_prompt_session_decision_idx" ON "icebreaker_session_prompt" USING btree ("session_id","decision");--> statement-breakpoint
CREATE UNIQUE INDEX "icebreaker_session_prompt_session_order_unique" ON "icebreaker_session_prompt" USING btree ("session_id","deck_order");--> statement-breakpoint
CREATE INDEX "icebreaker_template_org_id_idx" ON "icebreaker_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "icebreaker_template_flavour_idx" ON "icebreaker_template" USING btree ("flavour");