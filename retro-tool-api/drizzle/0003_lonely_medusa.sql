CREATE TABLE "org_team_role_config" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"team_role_id" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "org_team_role_config_org_id_team_role_id_unique" UNIQUE("org_id","team_role_id")
);
--> statement-breakpoint
CREATE TABLE "team_role" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"org_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "role_id" varchar(255);--> statement-breakpoint
ALTER TABLE "org_team_role_config" ADD CONSTRAINT "org_team_role_config_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_team_role_config" ADD CONSTRAINT "org_team_role_config_team_role_id_team_role_id_fk" FOREIGN KEY ("team_role_id") REFERENCES "public"."team_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;