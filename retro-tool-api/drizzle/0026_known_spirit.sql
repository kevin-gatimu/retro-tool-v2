CREATE INDEX "session_user_updated_at_idx" ON "session" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "story_estimate_vote_session_voter_idx" ON "story_estimate_vote" USING btree ("session_id","voter_id");--> statement-breakpoint
CREATE INDEX "card_retro_author_idx" ON "card" USING btree ("retro_id","author_id");--> statement-breakpoint
CREATE INDEX "retrospective_team_status_completed_idx" ON "retrospective" USING btree ("team_id","status","completed_at");