-- Remove duplicate participants, keeping the earliest joinedAt per (retro_id, user_id)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY retro_id, user_id ORDER BY joined_at ASC) AS rn
  FROM retro_participant
)
DELETE FROM retro_participant WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE "retro_participant" ADD CONSTRAINT "retro_participant_retro_user_unique" UNIQUE("retro_id","user_id");