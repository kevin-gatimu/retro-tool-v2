CREATE TABLE "poll" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"question" varchar(500) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"standup_id" varchar(255),
	"entry_date" date,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_by_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_option" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"poll_id" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"emoji" varchar(50),
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_vote" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"poll_id" varchar(255) NOT NULL,
	"option_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_standup_id_standup_id_fk" FOREIGN KEY ("standup_id") REFERENCES "public"."standup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_option" ADD CONSTRAINT "poll_option_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_option_id_poll_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poll_team_id_idx" ON "poll" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "poll_standup_id_idx" ON "poll" USING btree ("standup_id");--> statement-breakpoint
CREATE INDEX "poll_standup_date_idx" ON "poll" USING btree ("standup_id","entry_date");--> statement-breakpoint
CREATE INDEX "poll_created_by_id_idx" ON "poll" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "poll_option_poll_id_idx" ON "poll_option" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_vote_poll_id_idx" ON "poll_vote" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "poll_vote_option_id_idx" ON "poll_vote" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_vote_poll_user_unique" ON "poll_vote" USING btree ("poll_id","user_id");