# Retro Tool API

NestJS REST API + WebSocket backend for the Retro Tool application. Handles authentication, retrospective board management, story estimate session management, in-app notifications, browser push notifications, analytics reporting, and automated email workflows.

- [License](../LICENSE)
- [RBAC & Permissions](../docs/security/rbac.md)

## Tech Stack

| Layer              | Technology                                 |
| ------------------ | ------------------------------------------ |
| Runtime            | Node.js + TypeScript                       |
| Framework          | NestJS 11                                  |
| Database           | PostgreSQL 16                              |
| ORM                | Drizzle ORM                                |
| Auth               | better-auth + @thallesp/nestjs-better-auth |
| WebSockets         | Socket.io (@nestjs/platform-socket.io)     |
| Validation         | class-validator + Zod                      |
| Email              | Resend                                     |
| Push Notifications | web-push (VAPID)                           |
| Realtime projection| Self-hosted Convex (admin API + RS256 JWT) |
| Scheduler          | @nestjs/schedule (cron jobs)               |
| Rate limiting      | @nestjs/throttler                          |
| Git Hooks          | Husky + lint-staged                        |
| Package Manager    | pnpm                                       |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for local PostgreSQL + self-hosted Convex)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
PORT=8000
NODE_ENV=development

# Local Postgres is published on host port 5433 (see docker-compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/retro_tool_db

BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:8000
BETTER_AUTH_SESSION_EXPIRES_IN=604800

# JWT for Convex customJwt verification (RS256) — both OPTIONAL.
# Issuer defaults to the API origin, audience to 'convex'. Only set to override,
# and keep them byte-for-byte in sync with the Convex deployment's JWT_ISSUER /
# JWT_AUDIENCE. The API serves GET /api/auth/jwks and GET /api/auth/token.
# BETTER_AUTH_JWT_ISSUER=http://localhost:8000
# BETTER_AUTH_JWT_AUDIENCE=convex

FRONTEND_URL=http://localhost:3000
LOCAL_SERVER_URL=http://localhost:8000
DEPLOYED_SERVER_URL=https://your-api-domain.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# OAuth (Microsoft) — leave empty to disable
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_AUTHORITY=https://login.microsoftonline.com

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Retro Tool <noreply@yourdomain.com>
EMAIL_SANDBOX_TO=delivered@resend.dev

# Browser push notifications (VAPID)
# Generate keys with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Self-hosted Convex projection sync (admin API)
CONVEX_SYNC_URL=http://localhost:3210
CONVEX_SYNC_ADMIN_KEY=

# Scheduled jobs — gates ALL cron jobs on this API slot (default: enabled)
ENABLE_CRON_JOBS=true
```

Generate `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

> **Note:** `BETTER_AUTH_URL` must match the URL the server is actually running on (including port).

### Environment file strategy

| File | Purpose |
| --- | --- |
| `.env.local` | Local dev with Docker infra — **not committed** |
| `.env.staging-local` | Local dev against staging Azure resources |
| `.env.production-local` | Local dev against production Azure resources |
| `.env.example` | Template for local development |

The API uses `ConfigModule.forRoot` with `envFilePath: ['.env.local', '.env']`. When running `dev:staging` or `dev:prod`, `dotenv-cli` pre-loads the environment-specific file — `ConfigModule` won't overwrite existing `process.env` vars.

### 3. Start the database

```bash
# From repo root — starts Postgres + self-hosted Convex
pnpm local:infra
```

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Seed the database

```bash
# Dev — seeds all templates (retro + estimate + icebreaker) + team roles + demo users
pnpm db:seed

# All templates only (retro + estimate + icebreaker, idempotent — safe to re-run)
pnpm db:seed:templates

# Templates against staging/prod
pnpm db:seed:templates:staging
pnpm db:seed:templates:prod

# All prod-safe seeds (templates + team roles) against staging/prod
pnpm db:seed:staging
pnpm db:seed:prod
```

See [Seed Data](#seed-data) for credentials and what gets created.

### 6. Start the server

```bash
# development (watch mode — local infra)
pnpm dev

# development against staging resources
pnpm dev:staging

# development against production resources
pnpm dev:prod

# production
pnpm start:prod
```

Server runs at `http://localhost:8000` by default. Swagger UI at `http://localhost:8000/api/docs`.

---

## Database

### Commands

Migrations and seeds run through `scripts/db.mjs`, a single task runner that
keeps local/staging/prod behavior identical. Local tasks execute the TypeScript
sources via `ts-node` against `.env.local`; staging/prod build once then run the
compiled `dist/` output with `dotenv` preloading the environment-specific file.

```bash
pnpm db:generate                    # generate a new migration from schema changes
pnpm db:generate:staging            # generate against staging schema
pnpm db:generate:prod               # generate against production schema
pnpm db:migrate                     # apply pending migrations (local)
pnpm db:migrate:staging             # apply migrations (staging, from compiled dist/)
pnpm db:migrate:prod                # apply migrations (production, from compiled dist/)
pnpm db:studio                      # open Drizzle Studio (visual DB browser)

pnpm db:seed                        # seed all (templates + team roles + demo users) — local only
pnpm db:seed:templates              # retro + estimate + icebreaker templates (idempotent)
pnpm db:seed:templates:staging      # templates against staging
pnpm db:seed:templates:prod         # templates against production
pnpm db:seed:icebreaker-templates   # icebreaker templates only (idempotent)
pnpm db:seed:roles                  # seed built-in team roles (local only)
pnpm db:seed:users                  # seed demo users only (local only)
pnpm db:seed:large-org              # seed a large org for stress testing (local only)
pnpm db:seed:staging                # all prod-safe seeds against staging
pnpm db:seed:prod                   # all prod-safe seeds against production

pnpm db:ensure:convex               # create Convex-specific PostgreSQL database
pnpm db:ensure:convex:prod          # same for production
```

> Demo-user, team-role, and large-org seeds are guarded as local-only in the
> task runner and refuse to target staging/prod. Staging/prod migrations also
> run the Convex-database bootstrap (`ensure-convex-database`) first.

### Schema

Drizzle-kit scans `src/**/schema/**.ts` (plus `src/common/schema-enums/**`) for
table and enum definitions.

| Module                         | Tables (representative)                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `src/auth/schema/`             | `user`, `session`, `account`, `verification`, `admin_action_log`, `passkey`, `jwks`                                 |
| `src/organizations/schema/`    | `organization`, `organization_member`                                                                               |
| `src/teams/schema/`            | `team`, `team_member`, `team_join_request`, `team_role`                                                             |
| `src/user-preferences/schema/` | `user_notification_preference`                                                                                      |
| `src/retros/schema/`           | `template`, `template_column`, `retrospective`, `retro_participant`, `card`, `vote`, `card_comment`, `action_item` |
| `src/notifications/schema/`    | `notification`, `push_subscription`                                                                                 |
| `src/estimates/schema/`        | `estimate_template`, `story_estimate_session`, `story_estimate_round`, `story_estimate_participant`, `story_estimate_vote` |
| `src/icebreakers/schema/`      | Icebreaker sessions, prompts, and responses                                                                          |
| `src/polls/schema/`            | Poll definitions, options, and votes                                                                                |
| `src/standups/schema/`         | Standup sessions and entries                                                                                        |
| `src/surveys/schema/`          | Survey definitions, questions, and responses                                                                        |
| `src/convex-admin/schema/`     | `projection_outbox`, `projection_outbox_control`                                                                    |
| `src/email/schema/`            | `email_log`                                                                                                         |

### Migrations

Located in `drizzle/`, applied in order via `pnpm db:migrate`. There are 28
migrations, `0000_many_korvac` through `0027_projection_outbox`. Notable ones:

| Migration                  | Description                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `0000_many_korvac`         | Initial schema — auth tables, organisations, teams, retros, estimates, email log                    |
| `0002_dynamic_team_roles`  | Dynamic built-in `team_role` table + RBAC enhancements                                              |
| `0010_team_invitations`    | Team invitation handling                                                                            |
| `0027_projection_outbox`   | Transactional projection outbox (`projection_outbox`, `projection_outbox_control`) for Convex sync  |

Run `git log`/`ls drizzle/` for the complete, authoritative list — this table
is a curated summary, not exhaustive.

---

## Authentication

Powered by [better-auth](https://better-auth.com) via the `@thallesp/nestjs-better-auth` NestJS integration.

All routes are **protected by a global `AuthGuard` by default**. Use decorators to control access.

### Auth Endpoints

| Method | Path                      | Description                                     |
| ------ | ------------------------- | ----------------------------------------------- |
| `POST` | `/api/auth/sign-up/email` | Register a new user                             |
| `POST` | `/api/auth/sign-in/email` | Sign in, returns session cookie                 |
| `POST` | `/api/auth/sign-out`      | Invalidate current session                      |
| `GET`  | `/api/auth/get-session`   | Get the current session + user                  |
| `GET`  | `/api/auth/token`         | Mint an RS256 JWT for Convex customJwt verification |
| `GET`  | `/api/auth/jwks`          | Public JWKS used by Convex to verify the JWT    |

Sessions are stored in an HTTP-only cookie (`better-auth.session_token`).
Better Auth plugins in use: `bearer`, `admin`, `multiSession`, `emailOTP`
(6-digit, 5-min expiry), `passkey` (WebAuthn), and `jwt` (RS256, for Convex).
The passkey and JWT plugins auto-mount their own routes under `/api/auth`
(`/sign-in/passkey`, `/passkey/*`, `/token`, `/jwks`) and own the `passkey` and
`jwks` tables respectively.

### Decorators

```typescript
import { Session, UserSession, AllowAnonymous, OptionalAuth } from '@thallesp/nestjs-better-auth';

// Inject the current session
@Get('me')
async getMe(@Session() session: UserSession) {
  return session.user;
}

// Allow unauthenticated access
@Get('public')
@AllowAnonymous()
async publicRoute() { ... }

// Auth optional — session may be null
@Get('feed')
@OptionalAuth()
async feed(@Session() session: UserSession | null) { ... }
```

---

## API Reference

### Resource Dependencies

```text
Auth → Users → Organizations → Teams → Retrospectives
                                     → Estimate Sessions
```

### Health

These endpoints are excluded from the `/api` prefix and accessible at the root path. No authentication required.

| Method | Path            | Description                                                                       |
| ------ | --------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/health`       | Full health check with DB status — always `200` (`ok` / `degraded`)               |
| `GET`  | `/health/live`  | Lightweight liveness probe — always `200` if the process is up                    |
| `GET`  | `/health/ready` | Readiness probe — `200` (`ready`) when the DB is reachable, else `503` (`not_ready`) |

All three responses include a `version` field (from `src/lib/app-version.ts`)
and are exempt from rate limiting (`@SkipThrottle`).

### Sessions

| Method   | Path               | Description                            |
| -------- | ------------------ | -------------------------------------- |
| `GET`    | `/sessions`        | List all sessions for the current user |
| `POST`   | `/sessions/revoke` | Revoke a specific session by token     |
| `DELETE` | `/sessions/others` | Revoke all other sessions              |

### Users

| Method   | Path                     | Role       | Description                            |
| -------- | ------------------------ | ---------- | -------------------------------------- |
| `GET`    | `/users/me`              | Any        | Get current user profile               |
| `PATCH`  | `/users/me`              | Any        | Update profile                         |
| `GET`    | `/users/search`          | Any        | Search approved users                  |
| `GET`    | `/users/admin/exists`    | Public     | Check if any admin exists              |
| `POST`   | `/users/admin/bootstrap` | First user | Bootstrap first admin account          |
| `GET`    | `/users`                 | Admin      | List all users (paginated, filterable) |
| `GET`    | `/users/:id`             | Admin      | Get user by ID                         |
| `POST`   | `/users/:id/status`      | Admin      | Update user status                     |
| `POST`   | `/users/:id/role`        | Admin      | Update user role                       |
| `DELETE` | `/users/:id`             | Admin/Self | Delete user                            |
| `POST`   | `/users/:id/suspend`     | Admin      | Suspend user                           |
| `POST`   | `/users/:id/reactivate`  | Admin      | Reactivate suspended user              |
| `POST`   | `/users/bulk/status`     | Admin      | Bulk update user status                |
| `GET`    | `/users/:id/details`     | Admin      | Get user details                       |
| `GET`    | `/users/admin/logs`      | Admin      | Get admin action log                   |

### Organizations

| Method   | Path                                           | Role        | Description               |
| -------- | ---------------------------------------------- | ----------- | ------------------------- |
| `POST`   | `/organizations`                               | Any         | Create organization       |
| `GET`    | `/organizations`                               | Any         | List user's organizations |
| `GET`    | `/organizations/:id`                           | Member      | Get organization details  |
| `PATCH`  | `/organizations/:id`                           | Owner/Admin | Update organization       |
| `DELETE` | `/organizations/:id`                           | Owner       | Delete organization       |
| `GET`    | `/organizations/:id/members`                   | Member      | List members              |
| `POST`   | `/organizations/:id/members`                   | Owner/Admin | Add member                |
| `DELETE` | `/organizations/:orgId/members/:memberId`      | Owner/Admin | Remove member             |
| `PATCH`  | `/organizations/:orgId/members/:memberId/role` | Owner/Admin | Update member role        |

### Teams

| Method   | Path                               | Role                | Description                    |
| -------- | ---------------------------------- | ------------------- | ------------------------------ |
| `POST`   | `/teams`                           | Org Owner/Admin     | Create team                    |
| `GET`    | `/teams`                           | Any                 | List teams the user belongs to |
| `GET`    | `/teams/:id`                       | Member              | Get team details               |
| `PUT`    | `/teams/:id`                       | Org Admin/Team Lead | Update team                    |
| `DELETE` | `/teams/:id`                       | Org Owner/Admin     | Delete team                    |
| `GET`    | `/teams/:id/members`               | Member              | List team members              |
| `POST`   | `/teams/:id/members`               | Org Admin/Team Lead | Add member                     |
| `DELETE` | `/teams/:teamId/members/:memberId` | Org Admin/Team Lead | Remove member                  |
| `PUT`    | `/teams/:teamId/members/:memberId` | Org Admin/Team Lead | Update member role/tag         |

### Retrospectives

Core endpoints (the controller also exposes template CRUD, card merge/unmerge,
action-item, and discussion-tracking routes — see the controller for the full set):

| Method   | Path                          | Description                                        |
| -------- | ----------------------------- | -------------------------------------------------- |
| `GET`    | `/retros/dashboard`           | Dashboard stats for the current user               |
| `GET`    | `/retros/templates`           | List all available templates                       |
| `GET`    | `/retros/templates/:id`       | Get template with columns                          |
| `POST`   | `/retros/templates`           | Create a custom template                           |
| `PATCH`  | `/retros/templates/:id`       | Update a template                                  |
| `DELETE` | `/retros/templates/:id`       | Delete a template                                  |
| `POST`   | `/retros/templates/seed`      | Re-seed built-in templates (admin)                 |
| `GET`    | `/retros`                     | Recent retrospectives for the current user         |
| `POST`   | `/retros`                     | Create a new retrospective                         |
| `GET`    | `/retros/:id`                 | Get retrospective with participants and cards      |
| `DELETE` | `/retros/:id`                 | Delete a retrospective                             |
| `POST`   | `/retros/:id/join`            | Join a retrospective as a participant              |
| `POST`   | `/retros/:id/lobby`           | Move to the waiting/lobby phase                    |
| `POST`   | `/retros/:id/start`           | Move to active (collecting) phase                  |
| `POST`   | `/retros/:id/grouping`        | Move to grouping phase                             |
| `POST`   | `/retros/:id/voting`          | Move to voting phase                               |
| `POST`   | `/retros/:id/discussion`      | Move to discussion phase                           |
| `POST`   | `/retros/:id/complete`        | Complete the retrospective                         |
| `POST`   | `/retros/:id/send-report`     | Email the retrospective report                     |
| `POST`   | `/retros/cards`               | Create a card                                      |
| `POST`   | `/retros/:id/merge-cards`     | Merge cards                                        |
| `POST`   | `/retros/:id/cards/:cardId/unmerge` | Unmerge a merged card                        |
| `PATCH`  | `/retros/cards/:id`           | Update a card                                      |
| `DELETE` | `/retros/cards/:id`           | Delete a card                                      |
| `POST`   | `/retros/cards/:id/vote`      | Vote for a card                                    |
| `DELETE` | `/retros/cards/:id/vote`      | Remove vote from a card                            |
| `POST`   | `/retros/cards/:id/comments`  | Add a comment to a card                            |
| `PATCH`  | `/retros/comments/:id`        | Edit a comment                                     |
| `DELETE` | `/retros/comments/:id`        | Delete a comment                                   |
| `GET`    | `/retros/:id/action-items`    | List action items                                  |
| `POST`   | `/retros/:id/action-items`    | Create an action item                              |

**Retro lifecycle:** `draft` → `waiting` → `active` → `grouping` → `voting` → `discussing` → `completed`

### Notifications

| Method   | Path                            | Description                                    |
| -------- | ------------------------------- | ---------------------------------------------- |
| `GET`    | `/notifications`                | List notifications (newest first, max 50)      |
| `GET`    | `/notifications/unread-count`   | Get unread notification count                  |
| `PATCH`  | `/notifications/read-all`       | Mark all notifications as read                 |
| `PATCH`  | `/notifications/:id/read`       | Mark a single notification as read             |
| `GET`    | `/notifications/push-vapid-key` | Get the VAPID public key for push subscription |
| `POST`   | `/notifications/push-subscribe` | Register a browser push subscription           |
| `DELETE` | `/notifications/push-subscribe` | Remove a browser push subscription             |

### Estimates (Story Estimates)

| Method   | Path                       | Description                                 |
| -------- | -------------------------- | ------------------------------------------- |
| `GET`    | `/estimates`               | List estimate sessions for the current user |
| `GET`    | `/estimates/active`        | List active sessions (waiting or voting)    |
| `GET`    | `/estimates/history`       | List ended/archived sessions                |
| `GET`    | `/estimates/:id`           | Get session with participants and votes     |
| `POST`   | `/estimates`               | Create a new estimate session               |
| `POST`   | `/estimates/:id/join`      | Join a session as a participant             |
| `POST`   | `/estimates/:id/votes`     | Cast a vote                                 |
| `DELETE` | `/estimates/:id/votes`     | Remove own vote (unvote)                    |
| `POST`   | `/estimates/:id/reveal`    | Reveal all votes                            |
| `POST`   | `/estimates/:id/clear`     | Clear votes and start a new round           |
| `POST`   | `/estimates/:id/rounds/start` | Start the first/next round by ticket     |
| `PATCH`  | `/estimates/:id/story`     | Update the story being estimated            |
| `PATCH`  | `/estimates/:id`           | Rename the session                          |
| `POST`   | `/estimates/:id/timer`     | Start a countdown timer                     |
| `PATCH`  | `/estimates/:id/consensus` | Record a consensus estimate                 |
| `POST`   | `/estimates/:id/revote`    | Trigger a re-vote                           |
| `DELETE` | `/estimates/:id`           | End and delete a session                    |
| `DELETE` | `/estimates/:id/permanent` | Permanently delete an archived session      |
| `POST`   | `/estimates/:id/send-report` | Email the session results                 |

See [WebSockets — Estimates Gateway](#estimates-gateway) for real-time voting events.

### Icebreakers

> **Sessions are ephemeral.** Ending a session or advancing past the last prompt hard-deletes
> the row (cascading to prompts + participants). There is no history or archive endpoint.

| Method   | Path                       | Description                                                                     |
| -------- | -------------------------- | ------------------------------------------------------------------------------- |
| `GET`    | `/icebreakers`             | List all icebreaker sessions for the current user                               |
| `GET`    | `/icebreakers/active`      | List active (non-completed) sessions                                            |
| `GET`    | `/icebreakers/:id`         | Get a single session with deck, participants, and responses                     |
| `POST`   | `/icebreakers`             | Create a new icebreaker session                                                 |
| `POST`   | `/icebreakers/:id/join`    | Join a session as a participant                                                 |
| `POST`   | `/icebreakers/:id/swipe`   | Keep or skip a specific prompt card (facilitator)                               |
| `POST`   | `/icebreakers/:id/advance` | Advance to next pending prompt, or finish (hard-delete) when deck is exhausted  |
| `POST`   | `/icebreakers/:id/timer`   | Start a countdown timer for the current prompt                                  |
| `PATCH`  | `/icebreakers/:id`         | Update session name                                                             |
| `DELETE` | `/icebreakers/:id`         | End a session — hard-deletes it (no history)                                    |

**Session lifecycle:** `waiting` → `curating` ⇄ `presenting` → hard-deleted when deck exhausted or session ended early.

**Realtime:** session and board state is pushed to Convex (`liveIcebreakerSessions` / `liveIcebreakerBoards`) after every mutation. Live "great answer" reactions during the `presenting` phase travel via a direct Convex path (`liveIcebreakerReactions:sendReaction` public mutation, 15-second self-expiry) — nothing is written to PostgreSQL.

**Who can manage:** session creator, team lead, org admin, or system admin (`canManageSession`).

### Reports & Analytics (Dashboards v2)

Mounted under `/reports/v2`. Responses set a private `Cache-Control` header and
each scope is gated by its own access guard.

| Method | Path                                     | Access        | Description                                    |
| ------ | ---------------------------------------- | ------------- | ---------------------------------------------- |
| `GET`  | `/reports/v2/me`                         | Any           | My Insights — personal contribution dashboard  |
| `GET`  | `/reports/v2/teams/:teamId`              | Team member   | Team health dashboard (team-lead+ adds breakdown) |
| `GET`  | `/reports/v2/teams/:teamId/members`      | Team lead+    | Paginated per-member breakdown                 |
| `GET`  | `/reports/v2/organizations/:orgId`       | Org admin+    | Organization dashboard                         |
| `GET`  | `/reports/v2/organizations/:orgId/teams` | Org admin+    | Paginated team league for an organization      |
| `GET`  | `/reports/v2/platform`                   | System admin+ | Platform-wide dashboard                        |
| `GET`  | `/reports/v2/platform/organizations`     | System admin+ | Paginated organization league                  |

### Convex Admin & Projection Sync

All routes are **super-admin only** and mounted under `/convex-admin`. They
expose Convex operational/usage metrics, the table-clear cron, full projection
reconciliation, and control of the projection outbox (see
[Projection sync](#projection-sync-transactional-outbox)).

| Method | Path                                   | Description                                                          |
| ------ | -------------------------------------- | -------------------------------------------------------------------- |
| `GET`  | `/convex-admin/metrics/operational`    | Operational metrics from the Convex admin API                        |
| `GET`  | `/convex-admin/metrics/usage`          | Billing/usage metrics (null when not configured)                     |
| `GET`  | `/convex-admin/cron-config`            | Get the table-clear cron configuration                               |
| `PUT`  | `/convex-admin/cron-config`            | Update the table-clear cron configuration                            |
| `POST` | `/convex-admin/clear-tables`           | Clear the named Convex tables immediately                            |
| `POST` | `/convex-admin/reconcile-memberships`  | Rebuild the team-membership projection from PostgreSQL               |
| `POST` | `/convex-admin/reconcile-projections`  | Rebuild **all** projections from PostgreSQL and mark-and-sweep prune |
| `GET`  | `/convex-admin/outbox/status`          | Projection outbox dispatcher status                                  |
| `POST` | `/convex-admin/outbox/pause`           | Pause the outbox dispatcher for maintenance                          |
| `POST` | `/convex-admin/outbox/resume`          | Resume the dispatcher and replay buffered events                     |
| `POST` | `/convex-admin/outbox/replay`          | Drain the entire pending outbox in order                             |

Full reconciliation also runs headlessly via the CLI
`node dist/convex-admin/reconcile-projections.js` (source
`src/convex-admin/reconcile-projections.ts`) — it exits non-zero if any
projection failed, so a deploy step can gate on it.

### User Preferences

| Method  | Path                | Description                     |
| ------- | ------------------- | ------------------------------- |
| `GET`   | `/user-preferences` | Get notification preferences    |
| `PATCH` | `/user-preferences` | Update notification preferences |

**Preference fields:** `emailVerificationReminders`, `weeklyDigestEnabled`, `weeklyDigestDay`, `retrospectiveRemindersEnabled`, `retrospectiveReminderHours`, `teamActivityEmailsEnabled`

---

## WebSockets

Connections authenticate via the `better-auth.session_token` cookie sent in `handshake.headers`.

### Notifications Gateway

**Namespace:** `/notifications`

The gateway is **emit-only** — clients connect and listen for events pushed by the server.

| Event (server → client) | Payload               | When                                       |
| ----------------------- | --------------------- | ------------------------------------------ |
| `new-notification`      | `Notification` object | A new notification is created for the user |

Clients are joined to room `user:<userId>` on connection.

### Estimates Gateway

**Namespace:** `/estimates`

> Tables: `story_estimate_session`, `story_estimate_participant`, `story_estimate_vote`.

| Event (client → server) | Payload                       | Description                                     |
| ----------------------- | ----------------------------- | ----------------------------------------------- |
| `join-session`          | `{ sessionId }`               | Join session room and mark participant online   |
| `leave-session`         | `{ sessionId }`               | Leave session room and mark participant offline |
| `cast-vote`             | `{ sessionId, points }`       | Submit an estimate vote                         |
| `reveal-votes`          | `{ sessionId }`               | Reveal all votes (creator only)                 |
| `clear-votes`           | `{ sessionId }`               | Clear all votes for a new round (creator only)  |
| `start-round`           | `{ sessionId }`               | Start a new estimation round (creator only)     |
| `update-story`          | `{ sessionId, currentStory }` | Update the story being estimated (creator only) |
| `start-timer`           | `{ sessionId, duration }`     | Start a countdown timer (creator only)          |
| `end-session`           | `{ sessionId }`               | End and close the session (creator only)        |

| Event (server → client) | Payload                       | When                            |
| ----------------------- | ----------------------------- | ------------------------------- |
| `participant-joined`    | participant data              | A user joins the session        |
| `participant-left`      | `{ userId }`                  | A user leaves or disconnects    |
| `vote-cast`             | `{ voterId }` (points hidden) | A participant submits a vote    |
| `votes-revealed`        | `{ votes }`                   | Creator reveals all votes       |
| `votes-cleared`         | —                             | Votes are reset for a new round |
| `round-started`         | —                             | A new estimation round begins   |
| `story-updated`         | `{ currentStory }`            | Story text changes              |
| `timer-started`         | `{ duration, timerEndsAt }`   | A timer begins                  |
| `session-ended`         | —                             | Session is closed               |
| `session-changed`       | `{ sessionId }`               | Session list should be refetched |

---

## Background Jobs

Scheduled jobs are defined in `src/convex-admin/convex-admin-cron.service.ts`.
**All are gated by `ENABLE_CRON_JOBS`** — when it is `false` the whole service
no-ops, so only the serving API slot runs cron. Each job additionally takes a
PostgreSQL advisory lock, so at most one instance runs a given job at a time.

### Convex team-membership reconciliation (daily 03:00)

Cron: `0 3 * * *`. Rebuilds the Convex `liveTeamMembers` projection from
PostgreSQL (the source of truth) to bound any drift from dropped projection
pushes. No-ops when Convex is not configured.

### Projection outbox dispatch (every minute)

Cron: `* * * * *`. Drains pending rows from the projection outbox and delivers
them to Convex, guaranteeing eventual delivery of every projection intent (see
[Projection sync](#projection-sync-transactional-outbox)). No-ops when the dispatcher is
paused or Convex is unconfigured.

### Convex table clear (configurable)

An optional, admin-configurable job that clears named Convex tables on a
schedule. Enabled/disabled and scheduled through the `/convex-admin/cron-config`
endpoints; super-admins are notified of each run.

### Projection sync (transactional outbox)

PostgreSQL is the system of record; Convex holds only active collaboration
snapshots. Business mutations enqueue a durable projection **intent** into the
`projection_outbox` table **inside the same transaction** as their write (see
migration `0027_projection_outbox`), so an intent commits atomically with the
data it projects. Delivery happens two ways: an immediate best-effort push right
after commit (so realtime latency is unchanged when Convex is healthy) and the
cron-driven dispatcher above (which guarantees eventual delivery and replays the
queue after a maintenance pause). Delivery is idempotent — every handler is a
full upsert of current state — and a `dedupe_key` collapses superseded intents
for the same entity. This replaced the previous best-effort fire-and-forget
pushes, which could silently drop a projection update when Convex was
unreachable.

---

## Seed Data

Seeds run through `scripts/db.mjs` (see [Database](#database)). Demo users,
team roles, and the large-org seed are local-only; template seeds are prod-safe.

### `pnpm db:seed` (development)

Seeds a complete demo dataset. **Do not run in production.**

**Users** (password for all: `password`)

| Email                   | Role   | Status                                         |
| ----------------------- | ------ | ---------------------------------------------- |
| `admin@example.com`     | Admin  | Approved                                       |
| `alice@example.com`     | Admin  | Approved                                       |
| `bob.admin@example.com` | Admin  | Approved                                       |
| `charlie@example.com`   | Member | Approved — Acme org owner                      |
| `diana@example.com`     | Member | Approved — Frontend Team lead                  |
| `eve@example.com`       | Member | Approved                                       |
| `frank@example.com`     | Member | Approved — TechCo org owner / Mobile Team lead |
| `grace@example.com`     | Member | Approved — Backend Team lead                   |
| `liam@example.com`      | Member | Approved                                       |
| `mia@example.com`       | Member | Approved                                       |
| `peter@example.com`     | Member | Approved                                       |
| `quinn@example.com`     | Member | Approved                                       |
| `tom@example.com`       | Member | Approved                                       |
| `uma@example.com`       | Member | Approved                                       |
| `henry@example.com`     | Member | **Pending**                                    |
| `ivy@example.com`       | Member | **Pending**                                    |
| `noah@example.com`      | Member | Suspended                                      |
| `olivia@example.com`    | Member | Suspended                                      |
| `ryan@example.com`      | Member | Suspended                                      |
| `sophie@example.com`    | Member | Suspended                                      |
| `victor@example.com`    | Member | Suspended                                      |
| `wendy@example.com`     | Member | Suspended                                      |
| `jack@example.com`      | Member | Suspended                                      |

#### Organisations & Teams

```text
Acme Corporation (org-acme)       — owner: charlie@example.com
├── Frontend Team 🎨               — lead: diana@example.com
└── Backend Team ⚙️                — lead: grace@example.com

TechCo Inc (org-techco)           — owner: frank@example.com
└── Mobile Team 📱                 — lead: frank@example.com
```

#### Demo Retrospectives

| ID                         | Name                          | Team     | Template            | Status    | Notes                         |
| -------------------------- | ----------------------------- | -------- | ------------------- | --------- | ----------------------------- |
| `retro-frontend-completed` | Sprint 42 Retrospective       | Frontend | 4Ls                 | Completed | 9 cards, 12 votes, 3 comments |
| `retro-backend-active`     | Q1 Sprint Review              | Backend  | Start/Stop/Continue | Active    | 4 cards, in progress          |
| `retro-mobile-draft`       | Mobile Sprint 5 Retrospective | Mobile   | Appreciation Game   | Draft     | —                             |

### `pnpm db:seed:templates` (any environment)

Seeds the built-in retrospective templates (below), plus estimate-deck and
icebreaker templates. Idempotent — safe to re-run.

| Template                | Columns                                              |
| ----------------------- | ---------------------------------------------------- |
| 4Ls                     | Liked, Learned, Lacked, Longed For                   |
| Appreciation Game       | Team Spirit, Ideas                                   |
| Cupid's Retrospective   | Self-love, Good Stuff!, My Wishes, A Team to Die For |
| Start / Stop / Continue | Start, Stop, Continue                                |
| DAKI                    | Drop, Add, Keep, Improve                             |
| Mad / Sad / Glad        | Mad, Sad, Glad                                       |
| Sailboat                | Wind, Anchor, Rocks, Island                          |
| 5 Whys                  | Problem, Why #1, Why #2, Why #3–5, Action            |

### `pnpm db:seed:templates:staging` / `pnpm db:seed:templates:prod`

Runs retro + estimate + icebreaker template seeds against the target
environment using compiled `dist/` output.

### `pnpm db:seed:roles` (local only)

Seeds all 57 built-in team roles. Idempotent — safe to re-run. Guarded as
local-only by the task runner; team roles reach staging/prod through the
prod-safe seed (`db:seed:staging` / `db:seed:prod`).

| Role | Role | Role |
| --- | --- | --- |
| Backend Developer | BE Dev | BI Dev |
| BI Developer | Business Analyst | Cloud Engineer |
| CTO | Data Analyst | Data Eng |
| Data Engineer | Data Scientist | Dev |
| Developer | DevOps | DevOps Engineer |
| Engineering Manager | FE Dev | Frontend Developer |
| FS Dev | Full Stack Developer | Jr Dev |
| JRS Lead | JRS Oversight | Junior Developer |
| Machine Learning Engineer | ML Eng | Mobile Developer |
| PM | PO | Product Manager |
| Product Owner | Project Manager | QA |
| QA/QE | QA/Scrum Master | QE |
| QE/Scrum Master | Quality Analyst | Quality Engineer |
| Release Manager | Salesforce Developer | Salesforce System Admin |
| Scrum Master | Security Engineer | Senior Business Analyst |
| Senior Developer | SF Admin | SF Dev |
| Solution Architect | Sr BA | Sr Dev |
| Tech Lead | Technical Writer | UI Designer |
| UX Designer | UX/UI Designer | VP of Engineering |

### `pnpm db:seed:staging` / `pnpm db:seed:prod`

Runs all production-safe seeds (templates + team roles) against the target environment using compiled `dist/` output.

> **Note:** Seeding also runs automatically in CI after migrations during every deployment (idempotent — no-ops if data already exists).

---

## Project Structure

```text
src/
├── auth/                         # better-auth config, controller, schema
├── common/
│   ├── common.module.ts
│   ├── common.service.ts         # Shared auth helpers (isSystemAdmin, isOrgAdmin, etc.)
│   ├── data/
│   │   └── built-in-templates.ts # Built-in template definitions (source of truth)
│   ├── enums/                    # Type-safe enums for all modules
│   ├── interceptors/             # LastActiveInterceptor, etc.
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   └── pipes/
│       └── zod-validation.pipe.ts
├── config/
│   └── configuration.ts          # Zod-validated env config
├── database/
│   ├── database.module.ts        # Drizzle provider (DATABASE_CONNECTION token)
│   └── database-connection.ts
├── adapters/
│   └── socket-io.adapter.ts      # Socket.IO adapter (CORS; Redis adapter disabled)
├── convex-admin/                 # Convex admin API + projection outbox & reconciliation
│   ├── projection-outbox.service.ts        # Transactional outbox dispatcher
│   ├── projection-reconciliation.service.ts # Full rebuild-from-Postgres
│   ├── reconcile-projections.ts            # Headless reconciliation CLI
│   ├── schema/                             # projection_outbox tables
│   └── types/
├── email/                        # Resend wrapper + email_log table
├── estimates/                    # Story estimates — REST + Socket.io gateway
├── estimate-templates/           # Estimate card-deck templates
├── icebreakers/                  # Icebreaker sessions — REST + realtime projection
├── icebreaker-templates/         # Icebreaker prompt templates
├── invitations/                  # Org + team invitation handling
├── lib/
│   ├── email.ts                  # Email template helpers
│   ├── app-version.ts            # Version surfaced by health endpoints
│   └── utils.ts                  # generateId(), etc.
├── notifications/                # In-app notifications — REST + Socket.io + push
├── organizations/                # Organisation CRUD + membership + invitations
├── polls/                        # Polls — REST + realtime projection
├── reports/                      # Analytics dashboards (v2)
├── retros/                       # Retrospective lifecycle, templates, cards, votes
├── seed/
│   ├── seed-users.ts             # Dev seed: users, orgs, teams, retros (local only)
│   ├── seed-retro-templates.ts   # Retro templates (prod-safe, idempotent)
│   ├── seed-estimate-templates.ts # Estimate templates
│   ├── seed-icebreaker-templates.ts # Icebreaker templates
│   ├── seed-team-roles.ts        # Team roles
│   └── seed-large-org.ts         # Large org for stress testing (local only)
├── standups/                     # Standups — REST + realtime projection
├── surveys/                      # Surveys — REST + realtime projection
├── sessions/                     # Session listing & revocation
├── teams/                        # Team CRUD + membership + join requests
├── team-roles/                   # Team role definitions
├── action-items/                 # Retro action items
├── user-preferences/             # Notification preferences
├── users/                        # User management + admin actions
├── health.controller.ts          # GET /health, /health/live, /health/ready
├── app.module.ts                 # Root module
├── main.ts                       # Bootstrap (CORS, cookie-parser, Swagger)
├── migrate.ts                    # Standalone migration runner (used in prod)
└── ensure-convex-database.ts     # Creates Convex-specific PostgreSQL database
```

### Module type convention

Each module keeps its TypeScript types in a `types/index.ts` file (not loose `*.types.ts` files).

---

## Development Guide

### Code Patterns

#### 1. Enum Pattern

```typescript
// src/common/enums/example.enums.ts
export const EXAMPLE_STATUSES = {
  Active: 'active',
  Inactive: 'inactive',
} as const;
export type TExampleStatus =
  (typeof EXAMPLE_STATUSES)[keyof typeof EXAMPLE_STATUSES];
```

#### 2. DTO Pattern (Zod)

```typescript
// src/feature/dto/create-example.dto.ts
import { z } from 'zod';
import { EXAMPLE_STATUSES } from '../../common/enums';

export const createExampleSchema = z.object({
  name: z.string().min(1),
  status: z.nativeEnum(EXAMPLE_STATUSES).optional(),
});
export type CreateExampleDto = z.infer<typeof createExampleSchema>;
```

#### 3. Controller Pattern

```typescript
@Controller('examples')
@UseGuards(AuthGuard)
@ApiBearerAuth('session')
export class ExamplesController {
  @Post()
  async create(
    @Body() body: CreateExampleDto,
    @Session() session: SessionUser,
  ) {
    const data = createExampleSchema.parse(body);
    return this.examplesService.create(session.user.id, data);
  }
}
```

#### 4. Service Pattern

```typescript
@Injectable()
export class ExamplesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<typeof schema>,
    private readonly commonService: CommonService,
  ) {}
}
```

#### 5. Schema Pattern (Drizzle)

```typescript
// src/feature/schema/index.ts
export const example = pgTable('example', {
  id: varchar('id', { length: 255 }).primaryKey(),
  status: varchar('status', { length: 50 }).$type<TExampleStatus>(),
  createdAt: timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date()),
});
```

### Authorization Helpers (`CommonService`)

| Method                         | Description                            |
| ------------------------------ | -------------------------------------- |
| `isSystemAdmin(userId)`        | Check if user is system admin          |
| `isOrgAdmin(userId, orgId)`    | Check if user is org owner or admin    |
| `isOrgOwner(userId, orgId)`    | Check if user is org owner only        |
| `isOrgMember(userId, orgId)`   | Check if user is org member (any role) |
| `isTeamLead(userId, teamId)`   | Check if user is team lead             |
| `isTeamMember(userId, teamId)` | Check if user is team member           |

### Testing Endpoints

Use `app.http` with the REST Client extension:

1. Set `@baseUrl` to your server URL
2. Sign in to get a session token
3. Copy the token to `@sessionToken`
4. Execute requests (Auth → Users → Organizations → Teams → Retros)

### Database Workflow

```bash
# 1. Edit schema file(s)
# 2. Generate migration
pnpm db:generate

# 3. Apply migration
pnpm db:migrate

# 4. Inspect in Drizzle Studio
pnpm db:studio
```

---

## Development Notes

- **Body parser** is disabled at the NestJS level (`bodyParser: false`). `@thallesp/nestjs-better-auth` manages body parsing — raw for auth routes, JSON for everything else.
- **CORS** is configured for `ALLOWED_ORIGINS` with `credentials: true` so session cookies work cross-origin.
- **Config** is Zod-validated at startup — the server throws if required env vars are missing.
- **IDs** use UUIDs generated by `generateId()` from `src/lib/utils.ts`.
- **WebSocket auth** uses the `better-auth.session_token` cookie from the Socket.io handshake headers — validated against the `session` DB table directly.
- **Email** falls back to console logging when `RESEND_API_KEY` is not set (useful in development).
- **Browser push notifications** require `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` env vars. If missing or invalid the server starts normally — push is silently disabled with a warning in the logs. Generate keys with `npx web-push generate-vapid-keys`.
- **Database SSL** — the `sslmode` query parameter is stripped from `DATABASE_URL` before passing it to `pg` to avoid a deprecation warning from `pg-connection-string`. SSL is controlled via the `ssl` Pool option instead (auto-enabled for Azure PostgreSQL hosts).
- **Rate limiting** — `@nestjs/throttler` is applied globally; health probes are exempt via `@SkipThrottle`.
- **Git hooks** — Husky runs `lint-staged` on every commit: ESLint + Prettier on `src/**/*.ts`, Prettier on `test/**/*.ts`.

---

## License

See [LICENSE](../LICENSE) at the repository root.

## Permissions

See [docs/security/rbac.md](../docs/security/rbac.md) for the full role and permission matrix covering all user roles, organization roles, team roles, and retro actions.
