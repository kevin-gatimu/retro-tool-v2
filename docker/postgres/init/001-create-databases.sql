-- Idempotent DB bootstrap for local Docker Postgres.
-- psql \gexec runs CREATE DATABASE only when the DB does not already exist.

SELECT 'CREATE DATABASE retro_tool_db'
WHERE NOT EXISTS (
	SELECT 1 FROM pg_database WHERE datname = 'retro_tool_db'
)\gexec

-- Used by the local Convex self-hosted backend when INSTANCE_NAME=convex-local.
SELECT 'CREATE DATABASE convex_local'
WHERE NOT EXISTS (
	SELECT 1 FROM pg_database WHERE datname = 'convex_local'
)\gexec