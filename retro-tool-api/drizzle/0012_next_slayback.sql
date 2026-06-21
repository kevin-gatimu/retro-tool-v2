DROP INDEX "account_provider_account_idx";--> statement-breakpoint
DROP INDEX "template_column_template_id_order_idx";--> statement-breakpoint
-- Deduplicate account: keep most recently updated row per (provider_id, account_id)
DELETE FROM "account"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("provider_id", "account_id") "id"
  FROM "account"
  ORDER BY "provider_id", "account_id", "updated_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
-- Deduplicate estimate_template_value: keep lowest id per (template_id, order)
DELETE FROM "estimate_template_value"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("template_id", "order") "id"
  FROM "estimate_template_value"
  ORDER BY "template_id", "order", "id" ASC
);--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_template_value_template_order_unique" ON "estimate_template_value" USING btree ("template_id","order");--> statement-breakpoint
-- Deduplicate story_estimate_round: keep most recently created per (session_id, round_number)
DELETE FROM "story_estimate_round"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("session_id", "round_number") "id"
  FROM "story_estimate_round"
  ORDER BY "session_id", "round_number", "created_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "story_estimate_round_session_number_unique" ON "story_estimate_round" USING btree ("session_id","round_number");--> statement-breakpoint
-- Deduplicate push_subscription: keep most recently created per endpoint
DELETE FROM "push_subscription"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("endpoint") "id"
  FROM "push_subscription"
  ORDER BY "endpoint", "created_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscription_endpoint_unique" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
-- Deduplicate template_column: keep lowest id per (template_id, order)
DELETE FROM "template_column"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("template_id", "order") "id"
  FROM "template_column"
  ORDER BY "template_id", "order", "id" ASC
);--> statement-breakpoint
CREATE UNIQUE INDEX "template_column_template_order_unique" ON "template_column" USING btree ("template_id","order");--> statement-breakpoint
-- Deduplicate team: keep earliest created per (organization_id, name)
DELETE FROM "team"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("organization_id", "name") "id"
  FROM "team"
  ORDER BY "organization_id", "name", "created_at" ASC
);--> statement-breakpoint
CREATE UNIQUE INDEX "team_org_name_unique" ON "team" USING btree ("organization_id","name");--> statement-breakpoint
-- Deduplicate team_role: keep earliest created per (org_id, name)
DELETE FROM "team_role"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("org_id", "name") "id"
  FROM "team_role"
  ORDER BY "org_id", "name", "created_at" ASC
);--> statement-breakpoint
CREATE UNIQUE INDEX "team_role_org_name_unique" ON "team_role" USING btree ("org_id","name");
