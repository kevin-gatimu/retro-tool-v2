CREATE TYPE "public"."standup_cadence" AS ENUM('daily', 'weekly', 'fortnightly');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'standup_created' BEFORE 'convex_table_clear';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'standup_comment_added' BEFORE 'convex_table_clear';--> statement-breakpoint
CREATE TABLE "standup" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"cadence" "standup_cadence" DEFAULT 'daily' NOT NULL,
	"schedule_days" varchar(50) DEFAULT 'MON,TUE,WED,THU,FRI' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_answer" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"question_id" varchar(255) NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_comment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_entry" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"standup_id" varchar(255) NOT NULL,
	"entry_date" date NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_question" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"standup_id" varchar(255) NOT NULL,
	"prompt" varchar(500) NOT NULL,
	"color" varchar(7),
	"order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_reaction" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"emoji" varchar(50) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standup_submission" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entry_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "standup" ADD CONSTRAINT "standup_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup" ADD CONSTRAINT "standup_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_answer" ADD CONSTRAINT "standup_answer_submission_id_standup_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."standup_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_answer" ADD CONSTRAINT "standup_answer_question_id_standup_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."standup_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_comment" ADD CONSTRAINT "standup_comment_submission_id_standup_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."standup_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_comment" ADD CONSTRAINT "standup_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_entry" ADD CONSTRAINT "standup_entry_standup_id_standup_id_fk" FOREIGN KEY ("standup_id") REFERENCES "public"."standup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_question" ADD CONSTRAINT "standup_question_standup_id_standup_id_fk" FOREIGN KEY ("standup_id") REFERENCES "public"."standup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_reaction" ADD CONSTRAINT "standup_reaction_submission_id_standup_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."standup_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_reaction" ADD CONSTRAINT "standup_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_submission" ADD CONSTRAINT "standup_submission_entry_id_standup_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."standup_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standup_submission" ADD CONSTRAINT "standup_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standup_team_id_idx" ON "standup" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "standup_created_by_id_idx" ON "standup" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "standup_team_active_idx" ON "standup" USING btree ("team_id","is_active");--> statement-breakpoint
CREATE INDEX "standup_answer_submission_id_idx" ON "standup_answer" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_answer_submission_question_unique" ON "standup_answer" USING btree ("submission_id","question_id");--> statement-breakpoint
CREATE INDEX "standup_comment_submission_id_idx" ON "standup_comment" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "standup_comment_author_id_idx" ON "standup_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "standup_entry_standup_id_idx" ON "standup_entry" USING btree ("standup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_entry_standup_date_unique" ON "standup_entry" USING btree ("standup_id","entry_date");--> statement-breakpoint
CREATE INDEX "standup_question_standup_id_idx" ON "standup_question" USING btree ("standup_id");--> statement-breakpoint
CREATE INDEX "standup_reaction_submission_id_idx" ON "standup_reaction" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_reaction_submission_user_emoji_unique" ON "standup_reaction" USING btree ("submission_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "standup_submission_entry_id_idx" ON "standup_submission" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "standup_submission_user_id_idx" ON "standup_submission" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standup_submission_entry_user_unique" ON "standup_submission" USING btree ("entry_id","user_id");