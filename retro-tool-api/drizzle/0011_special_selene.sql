CREATE INDEX "org_invitation_org_id_idx" ON "org_invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_invitation_email_idx" ON "org_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "org_invitation_created_by_id_idx" ON "org_invitation" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "team_invitation_team_id_idx" ON "team_invitation" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invitation_email_idx" ON "team_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_invitation_created_by_id_idx" ON "team_invitation" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "admin_action_log_admin_id_idx" ON "admin_action_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_action_log_target_user_id_idx" ON "admin_action_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_action_log_created_at_idx" ON "admin_action_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_created_at_idx" ON "user" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "email_log_user_id_idx" ON "email_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_log_type_idx" ON "email_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_log_user_type_idx" ON "email_log" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "estimate_template_org_id_idx" ON "estimate_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "estimate_template_value_template_id_idx" ON "estimate_template_value" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "story_estimate_participant_session_id_idx" ON "story_estimate_participant" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "story_estimate_participant_user_id_idx" ON "story_estimate_participant" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "story_estimate_participant" WHERE "id" NOT IN (SELECT DISTINCT ON ("session_id","user_id") "id" FROM "story_estimate_participant" ORDER BY "session_id","user_id","joined_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "story_estimate_participant_session_user_unique" ON "story_estimate_participant" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "story_estimate_round_session_id_idx" ON "story_estimate_round" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "story_estimate_round_session_status_idx" ON "story_estimate_round" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "story_estimate_session_team_id_idx" ON "story_estimate_session" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "story_estimate_session_created_by_id_idx" ON "story_estimate_session" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "story_estimate_session_status_idx" ON "story_estimate_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "story_estimate_session_template_id_idx" ON "story_estimate_session" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "story_estimate_session_team_status_idx" ON "story_estimate_session" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "story_estimate_session_updated_at_idx" ON "story_estimate_session" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "story_estimate_vote_session_id_idx" ON "story_estimate_vote" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "story_estimate_vote_round_id_idx" ON "story_estimate_vote" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "story_estimate_vote_voter_id_idx" ON "story_estimate_vote" USING btree ("voter_id");--> statement-breakpoint
DELETE FROM "story_estimate_vote" WHERE "id" NOT IN (SELECT DISTINCT ON ("round_id","voter_id") "id" FROM "story_estimate_vote" ORDER BY "round_id","voter_id","voted_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "story_estimate_vote_round_voter_unique" ON "story_estimate_vote" USING btree ("round_id","voter_id");--> statement-breakpoint
CREATE INDEX "notification_user_id_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_read_idx" ON "notification" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notification_user_created_at_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_owner_id_idx" ON "organization" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "organization_created_at_idx" ON "organization" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organization_member_org_id_idx" ON "organization_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_user_id_idx" ON "organization_member" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "organization_member" WHERE "id" NOT IN (SELECT DISTINCT ON ("organization_id","user_id") "id" FROM "organization_member" ORDER BY "organization_id","user_id","created_at" ASC);--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_org_user_unique" ON "organization_member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_member_created_at_idx" ON "organization_member" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "action_item_retro_id_idx" ON "action_item" USING btree ("retro_id");--> statement-breakpoint
CREATE INDEX "action_item_card_id_idx" ON "action_item" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "action_item_assignee_id_idx" ON "action_item" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "action_item_status_idx" ON "action_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "action_item_retro_status_idx" ON "action_item" USING btree ("retro_id","status");--> statement-breakpoint
CREATE INDEX "action_item_assignee_status_idx" ON "action_item" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "action_item_created_at_idx" ON "action_item" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "action_item_due_date_idx" ON "action_item" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "action_item_comment_action_item_id_idx" ON "action_item_comment" USING btree ("action_item_id");--> statement-breakpoint
CREATE INDEX "action_item_comment_author_id_idx" ON "action_item_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "action_item_like_action_item_id_idx" ON "action_item_like" USING btree ("action_item_id");--> statement-breakpoint
CREATE INDEX "action_item_like_user_id_idx" ON "action_item_like" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "action_item_like" WHERE "id" NOT IN (SELECT DISTINCT ON ("action_item_id","user_id") "id" FROM "action_item_like" ORDER BY "action_item_id","user_id","created_at" ASC);--> statement-breakpoint
CREATE UNIQUE INDEX "action_item_like_item_user_unique" ON "action_item_like" USING btree ("action_item_id","user_id");--> statement-breakpoint
CREATE INDEX "card_retro_id_idx" ON "card" USING btree ("retro_id");--> statement-breakpoint
CREATE INDEX "card_column_id_idx" ON "card" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "card_author_id_idx" ON "card" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "card_retro_column_idx" ON "card" USING btree ("retro_id","column_id");--> statement-breakpoint
CREATE INDEX "card_created_at_idx" ON "card" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "card_comment_card_id_idx" ON "card_comment" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "card_comment_author_id_idx" ON "card_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "vote_card_id_idx" ON "vote" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "vote_user_id_idx" ON "vote" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "vote" WHERE "id" NOT IN (SELECT DISTINCT ON ("card_id","user_id") "id" FROM "vote" ORDER BY "card_id","user_id","created_at" ASC);--> statement-breakpoint
CREATE UNIQUE INDEX "vote_card_user_unique" ON "vote" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE INDEX "retro_participant_retro_id_idx" ON "retro_participant" USING btree ("retro_id");--> statement-breakpoint
CREATE INDEX "retro_participant_user_id_idx" ON "retro_participant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "retrospective_team_id_idx" ON "retrospective" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "retrospective_template_id_idx" ON "retrospective" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "retrospective_status_idx" ON "retrospective" USING btree ("status");--> statement-breakpoint
CREATE INDEX "retrospective_created_by_id_idx" ON "retrospective" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "retrospective_team_status_idx" ON "retrospective" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "retrospective_team_created_at_idx" ON "retrospective" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "retrospective_created_at_idx" ON "retrospective" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "template_organization_id_idx" ON "template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "template_column_template_id_idx" ON "template_column" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "template_column_template_id_order_idx" ON "template_column" USING btree ("template_id","order");--> statement-breakpoint
CREATE INDEX "org_team_role_config_org_id_idx" ON "org_team_role_config" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_team_role_config_team_role_id_idx" ON "org_team_role_config" USING btree ("team_role_id");--> statement-breakpoint
CREATE INDEX "team_organization_id_idx" ON "team" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "team_created_at_idx" ON "team" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "team_join_request_team_id_idx" ON "team_join_request" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_join_request_user_id_idx" ON "team_join_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_join_request_status_idx" ON "team_join_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_join_request_team_user_status_idx" ON "team_join_request" USING btree ("team_id","user_id","status");--> statement-breakpoint
CREATE INDEX "team_member_team_id_idx" ON "team_member" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_member_user_id_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_member_role_id_idx" ON "team_member" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "team_member_tag_idx" ON "team_member" USING btree ("tag");--> statement-breakpoint
DELETE FROM "team_member" WHERE "id" NOT IN (SELECT DISTINCT ON ("team_id","user_id") "id" FROM "team_member" ORDER BY "team_id","user_id","created_at" ASC);--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_team_user_unique" ON "team_member" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_role_org_id_idx" ON "team_role" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "notification" DROP COLUMN "metadata";
