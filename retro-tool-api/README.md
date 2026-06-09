# Retro Tool API

NestJS REST API + WebSocket backend for the Retro Tool application. Handles authentication, retrospective board management, story estimate session management, in-app notifications, browser push notifications, analytics reporting, and automated email workflows.

- [License](../LICENSE)
- [RBAC & Permissions](../RBAC.md)

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
| Scheduler          | @nestjs/schedule (cron jobs)               |
| Git Hooks          | Husky + lint-staged                        |
| Package Manager    | pnpm                                       |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for local PostgreSQL + Redis)

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

DATABASE_URL=postgresql://postgres:password@localhost:5432/retro_tool_db

BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:8000
BETTER_AUTH_SESSION_EXPIRES_IN=604800

FRONTEND_URL=http://localhost:3000
LOCAL_SERVER_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# OAuth (Microsoft)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Retro Tool <noreply@yourdomain.com>

# Browser push notifications (VAPID)
# Generate keys with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Convex projection sync
CONVEX_SYNC_URL=http://localhost:3210
CONVEX_SYNC_ADMIN_KEY=

# Scheduled jobs
ENABLE_CRON_JOBS=false
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
| `.env.production.example` | Template for production app settings |

The API uses `ConfigModule.forRoot` with `envFilePath: ['.env.local', '.env']`. When running `dev:staging` or `dev:prod`, `dotenv-cli` pre-loads the environment-specific file — `ConfigModule` won't overwrite existing `process.env` vars.

### 3. Start the database

```bash
# From repo root — starts Postgres, Redis, Convex
pnpm local:infra
```

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Seed the database

```bash
# Dev — seeds demo users, orgs, teams, retros + all built-in templates
pnpm db:seed

# Built-in templates only (idempotent — safe to re-run anytime)
pnpm db:seed:templates

# Production — templates only (compiled)
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

```bash
pnpm db:generate              # generate a new migration from schema changes
pnpm db:migrate               # apply pending migrations (local)
pnpm db:migrate:prod          # apply migrations (production, from compiled dist/)
pnpm db:studio                # open Drizzle Studio (visual DB browser)

pnpm db:seed                  # seed dev demo data + all built-in templates
pnpm db:seed:templates        # seed built-in retro templates (idempotent)
pnpm db:seed:estimate-templates  # seed estimate templates (idempotent)
pnpm db:seed:users            # seed demo users only
pnpm db:seed:roles            # seed team roles
pnpm db:seed:large-org        # seed a large org (stress testing)
pnpm db:seed:prod             # production: templates only (compiled)

pnpm db:backup                # backup local DB to backups/
pnpm db:backup:prod           # backup production DB

pnpm db:ensure:convex         # create Convex-specific PostgreSQL database
pnpm db:ensure:convex:prod    # same for production
```

### Schema

Drizzle-kit scans `src/**/schema/**.ts` for table definitions.

| Module                         | Tables                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `src/auth/schema/`             | `user`, `session`, `account`, `verification`, `admin_action_log`                                    |
| `src/organizations/schema/`    | `organization`, `organization_member`                                                               |
| `src/teams/schema/`            | `team`, `team_member`, `team_join_request`                                                          |
| `src/user-preferences/schema/` | `user_notification_preference`                                                                      |
| `src/retros/schema/`           | `template`, `template_column`, `retrospective`, `retro_participant`, `card`, `vote`, `card_comment` |
| `src/notifications/schema/`    | `notification`, `push_subscription`                                                                 |
| `src/estimates/schema/`        | `story_estimate_session`, `story_estimate_participant`, `story_estimate_vote`                       |
| `src/email/schema/`            | `email_log`                                                                                         |

### Migrations

Located in `drizzle/`. Applied in order via `pnpm db:migrate`.

| Migration                  | Description                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_dapper_starjammers`  | Initial schema — auth tables, organisations, teams, retros, estimates, email log                                                                                          |
| `0001_slimy_giant_girl`    | User preferences, notification preferences                                                                                                                                |
| `0002_smooth_makkari`      | `user_role` enum, RBAC enhancements                                                                                                                                       |
| `0003_volatile_wolverine`  | All enum type conversions (varchar → pg enum), `push_subscription` table, `is_carried_forward` column on `action_item`, rename `poker_session` → `story_estimate_session` |
| `0004_rename_poker_tables` | Rename `poker_participant` → `story_estimate_participant`, `poker_vote` → `story_estimate_vote`                                                                           |

---

## Authentication

Powered by [better-auth](https://better-auth.com) via the `@thallesp/nestjs-better-auth` NestJS integration.

All routes are **protected by a global `AuthGuard` by default**. Use decorators to control access.

### Auth Endpoints

| Method | Path                      | Description                     |
| ------ | ------------------------- | ------------------------------- |
| `POST` | `/api/auth/sign-up/email` | Register a new user             |
| `POST` | `/api/auth/sign-in/email` | Sign in, returns session cookie |
| `POST` | `/api/auth/sign-out`      | Invalidate current session      |
| `GET`  | `/api/auth/get-session`   | Get the current session + user  |

Sessions are stored in an HTTP-only cookie (`better-auth.session_token`).

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

| Method   | Path                         | Description                                   |
| -------- | ---------------------------- | --------------------------------------------- |
| `GET`    | `/retros/dashboard`          | Dashboard stats for the current user          |
| `GET`    | `/retros/templates`          | List all available templates                  |
| `GET`    | `/retros/templates/:id`      | Get template with columns                     |
| `POST`   | `/retros/templates/seed`     | Re-seed built-in templates (admin)            |
| `GET`    | `/retros`                    | Recent retrospectives for the current user    |
| `POST`   | `/retros`                    | Create a new retrospective                    |
| `GET`    | `/retros/:id`                | Get retrospective with participants and cards |
| `POST`   | `/retros/:id/join`           | Join a retrospective as a participant         |
| `POST`   | `/retros/:id/start`          | Move to active (collecting) phase             |
| `POST`   | `/retros/:id/voting`         | Move to voting phase                          |
| `POST`   | `/retros/:id/discussion`     | Move to discussion phase                      |
| `POST`   | `/retros/:id/complete`       | Complete the retrospective                    |
| `POST`   | `/retros/cards`              | Create a card                                 |
| `PATCH`  | `/retros/cards/:id`          | Update a card                                 |
| `DELETE` | `/retros/cards/:id`          | Delete a card                                 |
| `POST`   | `/retros/cards/:id/vote`     | Vote for a card                               |
| `DELETE` | `/retros/cards/:id/vote`     | Remove vote from a card                       |
| `POST`   | `/retros/cards/:id/comments` | Add a comment to a card                       |
| `DELETE` | `/retros/comments/:id`       | Delete a comment                              |

**Retro lifecycle:** `draft` → `active` → `voting` → `discussing` → `completed`

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

| Method | Path                | Description                                 |
| ------ | ------------------- | ------------------------------------------- |
| `GET`  | `/estimates`        | List estimate sessions for the current user |
| `GET`  | `/estimates/active` | List active sessions (waiting or voting)    |
| `GET`  | `/estimates/:id`    | Get session with participants and votes     |
| `POST` | `/estimates`        | Create a new estimate session               |

| `DELETE` | `/estimates/:id/votes` | Remove own vote (unvote) |

See [WebSockets — Estimates Gateway](#estimates-gateway) for real-time voting events.

### Reports & Analytics

| Method | Path                                      | Query                           | Description               |
| ------ | ----------------------------------------- | ------------------------------- | ------------------------- |
| `GET`  | `/reports/teams/:teamId/metrics`          | `period` = week\|month\|quarter | Team retro metrics        |
| `GET`  | `/reports/teams/:teamId/health`           | —                               | Team health score (0–100) |
| `GET`  | `/reports/teams/:teamId/action-items`     | —                               | Action item analytics     |
| `GET`  | `/reports/organizations/:orgId/templates` | —                               | Template usage metrics    |

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
| `update-story`          | `{ sessionId, currentStory }` | Update the story being estimated (creator only) |
| `start-timer`           | `{ sessionId, duration }`     | Start a countdown timer (creator only)          |
| `end-session`           | `{ sessionId }`               | End and close the session (creator only)        |

| Event (server → client) | Payload                      | When                            |
| ----------------------- | ---------------------------- | ------------------------------- |
| `participant-joined`    | participant data             | A user joins the session        |
| `participant-left`      | `{ userId }`                 | A user leaves or disconnects    |
| `vote-cast`             | `{ userId }` (points hidden) | A participant submits a vote    |
| `votes-revealed`        | full votes array             | Creator reveals all votes       |
| `votes-cleared`         | —                            | Votes are reset for a new round |
| `story-updated`         | `{ currentStory }`           | Story text changes              |
| `timer-started`         | `{ duration, timerEndsAt }`  | A timer begins                  |
| `session-ended`         | —                            | Session is closed               |

---

## Background Jobs

### Retro Reminders (hourly)

Cron: `0 * * * *` — runs every hour.

Finds retrospectives with a `scheduledAt` time within the next hour that haven't had a reminder sent (`reminderSentAt` is null), and sends an email reminder to all team members.

### Weekly Digests (daily at 06:00)

Cron: `0 6 * * *` — runs every day at 06:00.

Sends a weekly digest email to users whose `weeklyDigestDay` matches today's day of the week (when `weeklyDigestEnabled` is true). The digest includes recent retro summaries and team activity via the Reports service.

---

## Seed Data

Two seed scripts are provided for different environments.

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

Seeds all 8 built-in retrospective templates. Idempotent — safe to re-run.

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

### `pnpm db:seed:prod` (production)

Runs only the templates seed — equivalent to `db:seed:templates` but uses the compiled `dist/` output.

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
│   └── socket-io.adapter.ts      # Socket.IO Redis adapter
├── convex-admin/                 # Convex projection sync service
│   └── types/
│       └── index.ts
├── email/                        # Resend wrapper + email_log table
├── estimates/                    # Story estimates — REST + Socket.io gateway
│   └── types/
│       └── index.ts
├── estimate-templates/           # Estimate card deck templates
│   └── types/
│       └── index.ts
├── invitations/                  # Org + team invitation handling
│   └── types/
│       └── index.ts
├── lib/
│   ├── email.ts                  # Email template helpers
│   └── utils.ts                  # generateId(), etc.
├── notifications/                # In-app notifications — REST + Socket.io + push
├── organizations/                # Organisation CRUD + membership + invitations
├── reports/                      # Analytics — team metrics, health score
├── retros/                       # Retrospective lifecycle, templates, cards, votes
│   └── types/
│       └── index.ts
├── seed/
│   ├── seed-users.ts             # Dev seed: users, orgs, teams, retros
│   ├── seed-templates.ts         # Retro templates (prod-safe, idempotent)
│   ├── seed-estimate-templates.ts # Estimate templates
│   ├── seed-team-roles.ts        # Team roles
│   └── seed-large-org.ts         # Large org for stress testing
├── sessions/                     # Session listing & revocation
├── teams/                        # Team CRUD + membership + join requests
├── team-roles/                   # Team role definitions
├── action-items/                 # Retro action items
├── user-preferences/             # Notification preferences
├── users/                        # User management + admin actions
├── health.controller.ts          # GET /health — DB connectivity check
├── app.module.ts                 # Root module
├── main.ts                       # Bootstrap (CORS, cookie-parser, Swagger)
├── migrate.ts                    # Standalone migration runner (used in prod)
└── ensure-convex-database.ts     # Creates Convex-specific PostgreSQL database

scripts/
└── db-backup.ts                  # Database backup via pg_dump
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
- **Git hooks** — Husky runs `lint-staged` on every commit: ESLint + Prettier on `src/**/*.ts`, Prettier on `test/**/*.ts`.

---

## License

See [LICENSE](../LICENSE) at the repository root.

## Permissions

See [RBAC.md](../RBAC.md) for the full role and permission matrix covering all user roles, organization roles, team roles, and retro actions.
