CREATE TABLE "team_role" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "is_built_in" boolean NOT NULL DEFAULT false,
  "org_id" varchar(255),
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_team_role_config" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "org_id" varchar(255) NOT NULL,
  "team_role_id" varchar(255) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "org_team_role_config_org_id_team_role_id_unique" UNIQUE("org_id","team_role_id")
);
--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "org_team_role_config" ADD CONSTRAINT "org_team_role_config_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "org_team_role_config" ADD CONSTRAINT "org_team_role_config_team_role_id_team_role_id_fk" FOREIGN KEY ("team_role_id") REFERENCES "public"."team_role"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "role_id" varchar(255);
--> statement-breakpoint
INSERT INTO "team_role" ("id", "name", "is_built_in", "is_active", "sort_order", "created_at", "updated_at") VALUES
  ('01ec0000-0000-4000-8000-000000000001', 'Tech Lead',               true, true,  1, now(), now()),
  ('01ec0000-0000-4000-8000-000000000002', 'Data Engineer',           true, true,  2, now(), now()),
  ('01ec0000-0000-4000-8000-000000000003', 'Project Manager',         true, true,  3, now(), now()),
  ('01ec0000-0000-4000-8000-000000000004', 'Business Analyst',        true, true,  4, now(), now()),
  ('01ec0000-0000-4000-8000-000000000005', 'Senior Business Analyst', true, true,  5, now(), now()),
  ('01ec0000-0000-4000-8000-000000000006', 'Senior Developer',        true, true,  6, now(), now()),
  ('01ec0000-0000-4000-8000-000000000007', 'QA/Scrum Master',         true, true,  7, now(), now()),
  ('01ec0000-0000-4000-8000-000000000008', 'QE/Scrum Master',         true, true,  8, now(), now()),
  ('01ec0000-0000-4000-8000-000000000009', 'Salesforce System Admin', true, true,  9, now(), now()),
  ('01ec0000-0000-4000-8000-000000000010', 'Salesforce Developer',    true, true, 10, now(), now()),
  ('01ec0000-0000-4000-8000-000000000011', 'Data Analyst',            true, true, 11, now(), now()),
  ('01ec0000-0000-4000-8000-000000000012', 'Developer',               true, true, 12, now(), now()),
  ('01ec0000-0000-4000-8000-000000000013', 'QA',                      true, true, 13, now(), now()),
  ('01ec0000-0000-4000-8000-000000000014', 'QE',                      true, true, 14, now(), now()),
  ('01ec0000-0000-4000-8000-000000000015', 'QA/QE',                   true, true, 15, now(), now()),
  ('01ec0000-0000-4000-8000-000000000016', 'DevOps',                  true, true, 16, now(), now()),
  ('01ec0000-0000-4000-8000-000000000017', 'BI-Dev',                  true, true, 17, now(), now()),
  ('01ec0000-0000-4000-8000-000000000018', 'Oversight',               true, true, 18, now(), now());
--> statement-breakpoint
UPDATE "team_member" tm
SET role_id = tr.id
FROM "team_role" tr
WHERE tr.is_built_in = true
  AND (
    tr.name = tm.role::text
    OR (tm.role::text = 'Dev' AND tr.name = 'Developer')
  );
--> statement-breakpoint
ALTER TABLE "team_member" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_role_id_team_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."team_role"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."team_member_role";
