CREATE TABLE "estimate_template" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"organization_id" varchar(255),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_template_value" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"label" varchar(20) NOT NULL,
	"value" varchar(20) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"color" varchar(7),
	"description" text
);
--> statement-breakpoint
ALTER TABLE "story_estimate_session" ADD COLUMN "template_id" varchar(255);--> statement-breakpoint
ALTER TABLE "estimate_template" ADD CONSTRAINT "estimate_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_value" ADD CONSTRAINT "estimate_template_value_template_id_estimate_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_estimate_session" ADD CONSTRAINT "story_estimate_session_template_id_estimate_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_template"("id") ON DELETE set null ON UPDATE no action;