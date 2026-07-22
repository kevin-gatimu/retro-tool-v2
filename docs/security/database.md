# Database security

> How the PostgreSQL layer (`retro-tool-api` → Azure Database for PostgreSQL) is secured: TLS to the
> server, where the connection string lives, why SQL injection is structurally prevented by Drizzle, and
> the honest gaps — loose cert validation, a single app DB user, and no row-level security.

## Overview

PostgreSQL is the **system of record** — all durable business state lives here; Convex holds only
short-lived projection snapshots the API pushes after each write (see
[../architecture/convex.md](../architecture/convex.md)). The engine is **Azure Database for PostgreSQL
Flexible Server** (PostgreSQL 17, `Standard_B1ms` Burstable) in each environment, accessed through
[Drizzle ORM](https://orm.drizzle.team/) over the `pg` (`node-postgres`) driver.

| Environment | Server host | Database |
| --- | --- | --- |
| Production | `retro-tool-db-server….postgres.database.azure.com` | `retro_tool_db` |
| Staging | `retrotool-staging-db.postgres.database.azure.com` | `retro_tool_db` |
| Local | `localhost:5432` (Docker Postgres) | `retro_tool_db` |

Two independent connection pools exist in the API process, both built the same way:

- The **app pool** in [`database.module.ts`](../../retro-tool-api/src/database/database.module.ts)
  (the injected `DATABASE_CONNECTION` Drizzle instance used by every module).
- The **Better Auth pool** in [`auth.config.ts`](../../retro-tool-api/src/auth/auth.config.ts)
  (a separate `Pool` + `drizzleAdapter` owned by Better Auth for the `user`/`session`/`account`/
  `jwks`/… tables).

The self-hosted Convex backend also connects to the same Flexible Server, on a **separate DB user**
(`convex_<env>`) — see [Access control](#access-control-at-the-db-layer).

## Connection security (TLS/SSL)

Both API pools decide SSL from the host: a `DATABASE_URL` whose host contains
`.postgres.database.azure.com` is treated as Azure Postgres and connected with TLS; anything else
(local Docker) connects plaintext.

```ts
// database.module.ts / auth.config.ts (identical shape)
const isAzurePostgres = databaseUrl.includes('.postgres.database.azure.com');
const url = new URL(databaseUrl);
url.searchParams.delete('sslmode');              // sslmode normalization (below)
const pool = new Pool({
  connectionString: url.toString(),
  ssl: isAzurePostgres ? { rejectUnauthorized: false } : false,
});
```

### `rejectUnauthorized: false` — what it does and doesn't protect

TLS is **on** for all Azure connections, so traffic between the API and Postgres is **encrypted in
transit**. But `rejectUnauthorized: false` tells `node-postgres` **not to verify the server
certificate** against a CA chain. Be honest about the consequence:

- ✅ Protects against **passive eavesdropping** — the wire is encrypted.
- ❌ Does **not** protect against an **active man-in-the-middle** who can present any certificate:
  the client accepts it without checking it chains to a trusted CA or matches the hostname.

This is the common managed-Postgres shortcut (Azure's chain isn't in the default Node bundle without
shipping the CA), and the exposure is bounded because both endpoints live inside Azure on the same
private-ish path. The stronger posture — pinning Azure's CA and using `sslmode=verify-full` — is a
tracked gap, not the current reality. The migration runner
([`migrate.ts`](../../retro-tool-api/src/migrate.ts)) uses the same `rejectUnauthorized: false`.

For **Convex → Postgres**, TLS is required at the server: the Convex App Service sets
`DO_NOT_REQUIRE_SSL=false`
([`convex-app-service.bicep`](../../infra/modules/convex-app-service.bicep)).

### sslmode normalization

`DATABASE_URL` strings carry `?sslmode=require` (that's what the Bicep `databaseUrl` output and the
deployment docs hand out). `pg-connection-string` emits a deprecation warning for
`require`/`prefer`/`verify-ca`, so both pools **delete the `sslmode` query param** from the URL and
control SSL exclusively through the explicit `ssl` option. The parameter is normalized away, not
honored — the `ssl` object is the single source of truth.

### Pooling

Each `new Pool(...)` is a standard `node-postgres` pool (default sizing). The app pool and the Better
Auth pool are distinct, so auth traffic and application queries don't share connections.

## Credential management

`DATABASE_URL` is the only DB credential — a single connection string carrying the `pgadmin` admin
login and password. It is **never committed**; each environment sources it differently:

| Context | Where `DATABASE_URL` comes from |
| --- | --- |
| Local | `retro-tool-api/.env.local` (git-ignored; copied from `.env.example`) |
| Staging-local / prod-local | `.env.staging-local` / `.env.production-local`, preloaded by `dotenv-cli` in the `:staging`/`:prod` scripts |
| Deployed API (staging/prod) | Azure **App Service application setting**, fed from the GitHub Actions `DATABASE_URL` secret at deploy time |

The full env-file strategy (which file loads when, and why mixing staging/prod is dangerous) is in
[../workflows/running-the-app.md](../workflows/running-the-app.md).

**How it reaches the deployed API.** `main.bicep` renders the connection string as an *output template*
(`postgresql://pgadmin:<password>@…:5432/retro_tool_db?sslmode=require`) with the password left as a
placeholder — the real value is never in the template. The App Service receives it as a plain
`appSettings` entry via the `apiAppSettings` parameter, which the `deploy-api` workflow populates from
the `DATABASE_URL` GitHub secret.

> **Note the asymmetry:** the NestJS API's `DATABASE_URL` is a **plain App Service setting** (from a
> GitHub secret), whereas the Convex backend's `POSTGRES_URL` is a **Key Vault reference**
> (`@Microsoft.KeyVault(SecretUri=…)`) resolved by a managed identity — see
> [`convex-app-service.bicep`](../../infra/modules/convex-app-service.bicep). Moving the API's
> `DATABASE_URL` behind the same Key Vault reference is the obvious hardening step.

## SQL injection posture

**All queries are parameterized.** The app uses Drizzle's query builder (`.select()/.where(eq(...))`
etc.), which binds values as `$1, $2, …` placeholders — user input never reaches the SQL text.

A handful of places use Drizzle's raw `sql` tagged template. **These are safe**: `${…}` inside a
Drizzle `sql\`\`` is **not string concatenation** — Drizzle turns embedded values into **bound
parameters** and embedded columns/tables into escaped identifiers. Every occurrence was checked:

| File | Usage | Why it's safe |
| --- | --- | --- |
| [`auth.config.ts:102,115`](../../retro-tool-api/src/auth/auth.config.ts) | `eq(sql\`lower(${orgInvitation.email})\`, lowered)` | `${…}` is a **column reference** (identifier), not user text; `lowered` is bound via `eq()`. |
| [`convex-admin-cron.service.ts:194,207`](../../retro-tool-api/src/convex-admin/convex-admin-cron.service.ts) | `pg_try_advisory_lock(${lockId})` | `lockId` is a numeric constant, bound as a parameter. |
| [`organizations.service.ts:361`](../../retro-tool-api/src/organizations/organizations.service.ts) | correlated `COUNT(*)` subquery for sort | Only a **column reference** is interpolated; the `sort` value is validated against an allow-list before this branch. |
| `reports/queries/*.ts` | `count(sql\`case when … end\`)` aggregates | Interpolants are column references only. |
| [`health.controller.ts:88`](../../retro-tool-api/src/health.controller.ts) | `SELECT 1` liveness probe | No interpolation. |

**One raw path is not Drizzle-parameterized:** the migration runner
([`migrate.ts`](../../retro-tool-api/src/migrate.ts)) reads `drizzle/*.sql` files from disk and executes
them statement-by-statement. That is **trusted DDL checked into the repo**, not user input, so it is not
an injection surface. `markApplied` still uses bound parameters (`$1, $2`).

**No unsafe interpolation was found** — no query builds SQL by concatenating request-derived strings.

## Access control at the DB layer

Authorization is **entirely application-layer**. Be explicit about what the database does *not* do:

- **One app DB user.** The API connects as the Flexible Server admin (`pgadmin`) through a single
  `DATABASE_URL`. There are **no per-user or least-privilege DB roles** for application traffic — every
  request runs with the same full-privilege connection. (Convex connects as its own `convex_<env>`
  user, but that is a second service principal, not per-end-user separation.)
- **No row-level security (RLS).** No `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` exists. The
  database will return any row the query asks for; it enforces no tenancy or ownership rules.
- **All isolation is in code.** Org/team/retro scoping and the RBAC matrices are enforced by NestJS
  guards and service-layer checks, documented in [./rbac.md](./rbac.md). A missing check in the app
  layer is **not** backstopped by the database.

Network exposure: the Flexible Server has `publicNetworkAccess: Enabled` with an `AllowAzureServices`
firewall rule (`0.0.0.0`), i.e. reachable from Azure-hosted services rather than isolated in a VNet.

## Migrations & schema changes

Migrations are custom-run (not `drizzle-kit push`) by
[`migrate.ts`](../../retro-tool-api/src/migrate.ts) via the
[`scripts/db.mjs`](../../retro-tool-api/scripts/db.mjs) task runner:

- Applies `drizzle/*.sql` files listed in `meta/_journal.json`, tracked in a `__drizzle_migrations`
  table, idempotently (already-applied tags and "already exists" DDL errors are skipped).
- `pnpm --dir retro-tool-api db:migrate` runs locally; `db:migrate … staging`/`prod` build `dist/` and
  run against the environment's `.env.*-local` file. Demo-user/role seeds are marked `localOnly` and
  **refuse** to target staging or prod.
- The `deploy-api` workflow runs the same migrate + prod-safe seeds automatically against the
  `staging` `DATABASE_URL` secret on deploy.

**Shared-DB coordination risk:** the deployed staging API **and** any developer running
`dev:*:staging` point at the *same* `retrotool-staging-db` instance. A migration run from a laptop
mutates the schema under the live staging API, and mixing staging/prod env files scatters data and
breaks JWKS trust (see [../workflows/running-the-app.md](../workflows/running-the-app.md)). There is no
per-developer staging DB. Anyone holding the admin `DATABASE_URL` has full DDL rights.

## Backups & recovery

Azure-managed, configured in [`main.bicep`](../../infra/main.bicep):

| Setting | Value |
| --- | --- |
| Automated backups | Enabled (Flexible Server default) |
| Retention | **7 days** (`backupRetentionDays: 7`) |
| Geo-redundant backup | **Disabled** |
| High availability | **Disabled** (`highAvailability.mode: 'Disabled'`) |
| Storage autogrow | Enabled (32 GiB, P4) |

Recovery is point-in-time restore within the 7-day window via Azure. There is no HA standby and no
geo-redundancy, so an outage or regional failure has no automatic failover — this is the accepted
posture for the current scale, not an oversight to document as more than it is.

## Known gaps / residual risk

| Gap | Impact | Note |
| --- | --- | --- |
| `rejectUnauthorized: false` | TLS encrypts but the server cert is not verified → no MITM protection at the cert layer | Bounded (both endpoints in Azure). Fix: pin Azure CA + `verify-full`. |
| Single admin DB user | Every query runs with full privileges; a compromised API connection has total DB access | No least-privilege app role. |
| No row-level security | DB enforces no tenancy/ownership; a missing app-layer check is not backstopped | All isolation is in NestJS guards ([./rbac.md](./rbac.md)). |
| Shared staging DB | Local `dev:*:staging` and the deployed staging API mutate the same instance; laptop migrations hit live staging | No per-developer DB. |
| `DATABASE_URL` as plain App Service setting | The API's connection string is not a Key Vault reference (Convex's `POSTGRES_URL` is) | Move behind `@Microsoft.KeyVault`. |
| No HA / no geo-redundant backup | No automatic failover; recovery limited to 7-day PITR in-region | Accepted for current scale. |
| Public network access | Server reachable from Azure services (not VNet-isolated) | `AllowAzureServices` firewall rule. |

For the app-layer authorization model these gaps rely on, see [./rbac.md](./rbac.md); for the schema
itself see [../database/schema.md](../database/schema.md).
