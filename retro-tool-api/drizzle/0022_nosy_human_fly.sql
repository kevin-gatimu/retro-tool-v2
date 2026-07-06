CREATE TYPE "public"."survey_question_type" AS ENUM('text', 'rating', 'choice');--> statement-breakpoint
CREATE TYPE "public"."survey_scope" AS ENUM('team', 'org', 'system');--> statement-breakpoint
CREATE TABLE "survey" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"scope" "survey_scope" DEFAULT 'team' NOT NULL,
	"team_id" varchar(255),
	"organization_id" varchar(255),
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closes_at" timestamp,
	"created_by_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_answer" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"response_id" varchar(255) NOT NULL,
	"question_id" varchar(255) NOT NULL,
	"text_value" text,
	"rating_value" integer,
	"choice_value" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "survey_question" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"survey_id" varchar(255) NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"prompt" varchar(500) NOT NULL,
	"options" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_response" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"survey_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey" ADD CONSTRAINT "survey_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answer" ADD CONSTRAINT "survey_answer_response_id_survey_response_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_response"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answer" ADD CONSTRAINT "survey_answer_question_id_survey_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_question" ADD CONSTRAINT "survey_question_survey_id_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_survey_id_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_team_id_idx" ON "survey" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "survey_org_id_idx" ON "survey" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "survey_scope_idx" ON "survey" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "survey_created_by_id_idx" ON "survey" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "survey_closed_idx" ON "survey" USING btree ("is_closed");--> statement-breakpoint
CREATE INDEX "survey_answer_response_id_idx" ON "survey_answer" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "survey_answer_question_id_idx" ON "survey_answer" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_answer_response_question_unique" ON "survey_answer" USING btree ("response_id","question_id");--> statement-breakpoint
CREATE INDEX "survey_question_survey_id_idx" ON "survey_question" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_response_survey_id_idx" ON "survey_response" USING btree ("survey_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_response_survey_user_unique" ON "survey_response" USING btree ("survey_id","user_id");