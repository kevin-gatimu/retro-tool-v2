DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type type_def
    WHERE type_def.typnamespace = 'public'::regnamespace
      AND type_def.typname = 'team_member_tag'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_type type_def
    JOIN pg_enum enum_def ON enum_def.enumtypid = type_def.oid
    WHERE type_def.typnamespace = 'public'::regnamespace
      AND type_def.typname = 'team_member_tag'
      AND enum_def.enumlabel = 'team-lead'
  ) THEN
    ALTER TYPE "public"."team_member_tag" ADD VALUE 'team-lead';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "team_member"
SET "tag" = 'team-lead'
WHERE "tag"::text = 'lead';
