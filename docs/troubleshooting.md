# Troubleshooting & Known Edge Cases

A living record of bugs, gotchas, and non-obvious failures encountered in development and production. Check here before digging into logs.

---

## Auth / Database

### Ensure `retro_tool_db` + Convex DB exist after reprovisioning

If PostgreSQL is recreated, you need both the API database and the Convex database available.

Local strategy (Docker Compose):

- `docker/postgres/init/001-create-databases.sql` now creates databases idempotently:
  - `retro_tool_db`
  - `convex_local` (for local `INSTANCE_NAME=convex-local`)
- To re-run from a clean state:

```bash
docker compose --env-file docker/.env -f docker/docker-compose.local.yml down -v
docker compose --env-file docker/.env -f docker/docker-compose.local.yml up -d postgres
```

Production strategy (Azure):

- `infra/bicep/main.bicep` passes `convexDatabaseName: replace(convexInstanceName, '-', '_')`.
- `infra/bicep/modules/postgresql-flexible-server.bicep` creates:
  - `retro_tool_db`
  - Convex DB named from `convexInstanceName` (currently enforced as `convex_local`)
- This means every infra deploy can recreate DBs consistently without manual SQL.

Why not as the first Drizzle migration?

- `CREATE DATABASE` is an infrastructure/bootstrap concern, not a schema migration inside `retro_tool_db`.
- Many migration runners wrap execution in transactions; `CREATE DATABASE` is not transaction-safe in that model.
- The reliable pattern is: **ensure DB exists first**, then run schema migrations.

Implemented production-safe bootstrap:

- API package command `db:ensure:convex` runs `src/ensure-convex-database.ts`.
- Deployment workflow now runs `node dist/ensure-convex-database.js` before `node dist/migrate.js`.
- DB name resolution order:
  1. `CONVEX_DATABASE_NAME` (if set)
  2. Derived from `CONVEX_INSTANCE_NAME` (`-` -> `_`)
  3. Fallback `convex_local`

Current parity setting:

- Local and Azure both use `CONVEX_INSTANCE_NAME=convex-local`, so both target `convex_local`.

Operational rule:

- Keep `POSTGRES_URL` / `CONVEX_POSTGRES_URL` pointed at the PostgreSQL **server only** (no database segment).
- Keep `INSTANCE_NAME` stable per environment so Convex DB naming is predictable.

### OAuth sign-in fails with `password authentication failed for user "postgres"`

**When:** Clicking "Sign in with Microsoft" (or Google) redirects to the provider but then returns a server error. The NestJS API appears healthy (Swagger is accessible) but OAuth fails.

**Cause:** The API server starts successfully even with a wrong `DATABASE_URL` because the NestJS database connection is lazy — it only actually connects on the first query. Better Auth also creates its own separate `Pool` in `auth.ts` using `process.env.DATABASE_URL`. The first real DB hit happens when Better Auth tries to write an OAuth state token to the `verification` table, at which point the wrong password causes the failure.

The `DATABASE_URL` in `retro-tool-api/.env` still contained the placeholder value `replace-with-password`.

**Fix:**

```bash
# 1. Set or reset your local postgres password
psql -U postgres -c "ALTER USER postgres PASSWORD 'your-password';"

# 2. Ensure the database exists
psql -U postgres -c "CREATE DATABASE retro_tool;"

# 3. Update retro-tool-api/.env
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/retro_tool

# 4. Run migrations
cd retro-tool-api && pnpm drizzle-kit migrate
```

**Why the server boots without error:** NestJS and Better Auth both use lazy DB connections — the pool is created at startup but no query is issued until a request arrives. A wrong password therefore causes a silent startup and only surfaces on the first DB write.

---

## Convex

### `Operation query not permitted`

**When:** Running `npx convex dev` or any Convex CLI command.

**Cause:** The `CONVEX_SELF_HOSTED_ADMIN_KEY` in `convex-backend/.env` is stale. Admin keys are tied to the running container instance — they are invalidated any time the `convex-backend` container is recreated or `INSTANCE_SECRET` changes.

**Fix:**

```bash
docker exec retro-tool-local-convex-backend-1 ./generate_admin_key.sh
```

Update the new key in both:

- `convex-backend/.env` → `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `docker/.env` → `CONVEX_SYNC_ADMIN_KEY` + `CONVEX_SELF_HOSTED_ADMIN_KEY`

---

### `Src Pkg storage key not found` — 500 on `start_push`

**When:** Running `npx convex dev` after the `convex-backend` container was recreated.

**Cause:** Convex stores uploaded function packages on the container's **local filesystem**. PostgreSQL persists references to those packages. When the container is recreated the filesystem is wiped, but the PostgreSQL volume survives — leaving dangling references to objects that no longer exist.

**Fix:**

```bash
# 1. Drop and recreate the Convex database
docker exec retro-tool-local-postgres-1 psql -U postgres -c "DROP DATABASE convex_local;"
docker exec retro-tool-local-postgres-1 psql -U postgres -c "CREATE DATABASE convex_local;"

# 2. Restart the Convex container
docker compose -f docker/docker-compose.local.yml restart convex-backend

# 3. Regenerate the admin key — restart invalidates the previous one
docker exec retro-tool-local-convex-backend-1 ./generate_admin_key.sh
```

Update both env files with the new key (see above), then retry `npx convex dev`.

**Long-term fix:** Configure Convex to use an S3-compatible object store (e.g. MinIO) so package storage survives container restarts.

### Automate Convex admin key refresh after container recreation

Use the helper scripts to generate a fresh key and sync all local env files that depend on it:

- Windows (PowerShell): `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-convex-admin-key.ps1`
- macOS/Linux (Bash): `bash scripts/refresh-convex-admin-key.sh`

Command syntax and parameters:

- PowerShell syntax:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-convex-admin-key.ps1 [-DryRun] [-ServiceName <name>]
```

- PowerShell parameters:
  - `-DryRun`: preview actions without changing files
  - `-ServiceName <name>`: docker compose service name (default: `convex-backend`)

- Bash syntax:

```bash
bash scripts/refresh-convex-admin-key.sh [--dry-run] [--service <name>]
```

- Bash parameters:
  - `--dry-run`: preview actions without changing files
  - `--service <name>`: docker compose service name (default: `convex-backend`)

Examples:

- Windows default run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-convex-admin-key.ps1
```

- Windows dry run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-convex-admin-key.ps1 -DryRun
```

- Windows custom service name:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/refresh-convex-admin-key.ps1 -ServiceName convex-backend
```

- Bash default run:

```bash
bash scripts/refresh-convex-admin-key.sh
```

- Bash dry run:

```bash
bash scripts/refresh-convex-admin-key.sh --dry-run
```

- Bash custom service name:

```bash
bash scripts/refresh-convex-admin-key.sh --service convex-backend
```

Prerequisite: make sure the Convex service is running first (`pnpm local:infra`).

What these scripts update automatically:

- `convex-backend/.env` → `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `docker/.env` → `CONVEX_SELF_HOSTED_ADMIN_KEY` and `CONVEX_SYNC_ADMIN_KEY`
- `retro-tool-api/.env` → `CONVEX_SYNC_ADMIN_KEY`

If you only want to preview changes without editing files:

- PowerShell: `-DryRun`
- Bash: `--dry-run`

---

### `CONVEX_POSTGRES_URL` must not include a database name

**When:** Convex container fails to start or connect to PostgreSQL.

**Cause:** `CONVEX_POSTGRES_URL` must point at the PostgreSQL **server**, not a specific database. Convex creates and manages its own database internally (`convex_local`, named after `INSTANCE_NAME`).

```text
# Correct
CONVEX_POSTGRES_URL=postgresql://user:password@host:5432

# Wrong — causes connection errors
CONVEX_POSTGRES_URL=postgresql://user:password@host:5432/convex_local
```

The postgres init script pre-creates the `convex_local` database so it exists on first boot.

---

### `CONVEX_BETTER_AUTH_URL` env var name is case-sensitive

**When:** Convex can't validate sessions / auth fails silently.

**Cause:** The variable was accidentally written as `Convex_BETTER_AUTH_URL` (mixed case). Environment variable names are case-sensitive on Linux containers — the wrong casing means the variable is never read.

**Fix:** Ensure it is always uppercase: `CONVEX_BETTER_AUTH_URL`.

---

## Docker / Environment

### Production secrets accidentally committed in `docker/.env`

**When:** `docker/.env` contained real Azure PostgreSQL credentials, OAuth secrets, and an Azure CLI JSON blob appended to the bottom of the file.

**Cause:** Values were manually pasted without checking which file was open; a terminal `az group show` output was accidentally appended.

**Prevention:**

- `.env` (with real secrets) is in `.gitignore` — never force-add it
- Only `.env.example` and `.env.production.example` (with placeholders) are committed
- Before committing, run: `git diff --cached -- "*.env*"` to verify no secrets are staged

---

### `docker/.env` infra variables vs app secrets confusion

**When:** Variables passed to `docker compose` were mixed with variables injected into containers, making it hard to reason about what controls what.

**Convention now enforced in all docker env files:**

- **INFRASTRUCTURE** section — ports, Postgres/Redis/Convex container config consumed by Docker Compose itself to spin up services
- **APP SECRETS** section — values injected into the `nest-api` and `ui` containers at runtime

---

## Configuration (`configuration.ts`)

### Hardcoded fallback values duplicated schema defaults

**When:** Changing a default URL required updating it in two places: the Zod schema `.default(...)` and the `|| 'fallback'` in the factory function.

**Fix applied:** The factory function now passes `undefined` for any unset env var. Zod schema defaults are the single source of truth. The only exception is `cookieSecure`, which is derived from `nodeEnv` (a computed value, not a raw env var).

**Rule:** Never use `process.env.FOO || 'hardcoded'` in `configuration.ts`. Use `process.env.FOO` and let the Zod schema handle the default.

---

### Required env vars silently using wrong defaults

**When:** `FRONTEND_URL`, `LOCAL_SERVER_URL`, `DEPLOYED_SERVER_URL`, and `ALLOWED_ORIGINS` had Zod `.default(...)` values containing `http://localhost:5173` or `http://localhost:8000`. In production, if these env vars were missing, the app would start successfully but CORS would silently reject all browser requests.

**Fix applied:** These fields are now required in the Zod schema (no `.default(...)`). A missing value causes the app to **fail at startup** with a clear validation error rather than silently misbehaving.

---

### `EMAIL_FROM` missing in production

**When:** Emails fail to send in production with no obvious error.

**Cause:** `EMAIL_FROM` had a schema default of `noreply@example.com`. In production this default would be used silently if the env var was missing, causing Resend to reject the request (unverified domain).

**Fix applied:** `EMAIL_FROM` is now required — missing it causes a startup validation error.
