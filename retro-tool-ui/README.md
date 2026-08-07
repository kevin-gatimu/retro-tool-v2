# Retro Tool UI

The frontend application for the Retro Tool platform — a collaborative agile retrospective, story-estimate, icebreaker, standup, poll, and survey tool. Built with React 19, TanStack Router, TanStack Query, Radix UI, and TailwindCSS 4.

- [License](../LICENSE)
- [RBAC & Permissions](../docs/security/authorization-rbac.md)
- [Backend API](../retro-tool-api/README.md)
- [File naming conventions](../docs/guidelines/file-naming-conventions.md)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [App Modules & Pages](#app-modules--pages)
4. [Authentication](#authentication)
5. [RBAC & Permission Gating](#rbac--permission-gating)
6. [API Layer](#api-layer)
7. [Real-Time](#real-time)
8. [User Flows](#user-flows)
9. [Roles Reference](#roles-reference)
10. [Environment Setup](#environment-setup)
11. [Running the App](#running-the-app)
12. [User Guide (VitePress)](#user-guide-vitepress)

---

## Tech Stack

| Layer           | Technology                          |
| --------------- | ----------------------------------- |
| Framework       | React 19 (React Compiler)           |
| Routing         | TanStack Router (file-based)        |
| Data Fetching   | TanStack Query                      |
| Forms           | TanStack Form                       |
| Tables          | TanStack Table                      |
| Auth Client     | Better Auth (passkey/JWT/sessions)  |
| UI Components   | Radix UI + shadcn/ui pattern        |
| Styling         | TailwindCSS 4                       |
| Charts          | Recharts                            |
| Drag & Drop     | dnd-kit                             |
| PDF export      | jsPDF                               |
| Real-time       | Socket.IO client + Convex React SDK |
| Env parsing     | `@t3-oss/env-core` + Zod            |
| Validation      | Zod 4                               |
| Package Manager | pnpm                                |

---

## Project Structure

Source files use **`kebab-case`** file names; the exported symbol keeps its idiomatic case
(`notification-bell.tsx` → `export function NotificationBell()`, `use-current-user.ts` →
`export function useCurrentUser()`). Files under `routes/` that define routes are named by
TanStack Router (`index.tsx`, `$teamId.tsx`, `__root.tsx`, …). See
[docs/guidelines/file-naming-conventions.md](../docs/guidelines/file-naming-conventions.md).

```text
src/
├── env.ts                        # Zod-validated import.meta.env (VITE_* vars, APP_ENVS, helpers)
│
├── common/
│   ├── enums/                    # user, organization, team, retro, estimate, icebreaker,
│   │                             #   standup, poll, survey, notification, reports, … enums
│   ├── helpers/                  # Shared pure helpers
│   └── types/                    # Cross-app TS types (users, organizations, teams, retros,
│                                 #   estimates, icebreakers, standups, polls, surveys, …)
│
├── components/
│   ├── ui/                       # Base components (Button, Input, Dialog, Badge…)
│   ├── tables/                   # Reusable table column definitions
│   ├── skeletons/                # Loading skeleton screens
│   ├── landing/                  # Marketing landing page sections
│   ├── app-sidebar.tsx           # Primary nav (dashboard, retros, estimate, icebreakers, …)
│   ├── header.tsx / footer.tsx   # Chrome
│   ├── account-switcher.tsx      # Multi-session account switcher
│   ├── notification-bell.tsx     # Header notification dropdown
│   ├── notification-convex-sync.tsx
│   └── user-role-badges.tsx      # Renders org/team role badges
│
├── hooks/
│   ├── use-auth.ts               # useAuth() — session + user
│   ├── use-current-user.ts       # useCurrentUser() — own profile
│   ├── use-push-notifications.ts # subscribe/unsubscribe to browser push
│   ├── use-theme.ts              # useTheme() — dark/light mode
│   └── …                         # use-mobile, use-debounced-value, poll/survey mutations, …
│
├── integrations/
│   ├── better-auth/              # authClient wiring
│   └── tanstack-query/           # queryClient singleton
│
├── lib/
│   ├── api.ts                    # Typed HTTP wrapper (api.get/post/patch/put/delete)
│   ├── api-endpoints.ts          # All endpoint URL constants
│   ├── auth-client.ts            # Better Auth client (passkey, jwt, multiSession) + bearer token
│   ├── rbac.ts                   # Frontend RBAC helpers (mirrors backend)
│   ├── realtime-config.ts        # Per-feature backend selection (socket-io | convex)
│   ├── realtime-providers.tsx    # Convex provider + JWT auth wiring
│   ├── convex-client.ts / convex-api.ts
│   ├── socket.ts                 # Socket.IO namespace singletons
│   └── save-pdf.ts / avatar.ts / utils.ts
│
├── routes/                       # File-based routes (see App Modules below). Each feature
│                                 #   folder colocates components/, hooks/, helpers/, types/,
│                                 #   skeleton/.
└── main.tsx                      # App entry (Router + QueryClient providers)
```

---

## App Modules & Pages

Navigation (`app-sidebar.tsx`) surfaces: dashboard, retros, estimate, icebreakers, standups,
polls, surveys, reports, templates, teams, organizations, admin, profile.

### Landing & Auth (`/`, `/auth/*`)

- **Landing** (`/`) — Public marketing page (hero, features, templates). Authenticated users navigate on to the dashboard.
- **Sign in** (`/auth/sign-in`) — Email/password + passkey + Microsoft OAuth. Redirects to `/dashboard` on success.
- **Sign up** (`/auth/sign-up`) — New account creation. Account enters `pending` status awaiting admin approval.
- Also: `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/accept-invite`, `/auth/social-callback`.

### Dashboard (`/dashboard`)

The current user's home — recent activity and key stats. Accessible to all authenticated users.

### Profile (`/profile/*`)

Own account management: profile details, security (password, passkeys), active sessions, and preferences (`/profile`, `/profile/security`, `/profile/sessions`, `/profile/settings`).

### Admin Panel (`/admin/*`)

Restricted to `super-admin` / `system-admin`. The `admin.tsx` layout gates access via `canAccessAdminPanel`.

- **Users** (`/admin/users`) — Paginated user list with filters. Actions: approve, reject, suspend, reactivate, change role, bulk approve/reject; org-member management and activity log.
- **Organizations** (`/admin/organizations`) — Create/edit/delete any org; list all orgs.
- **Org setup** (`/admin/org-setup`) — Bulk org + team + member provisioning.
- **Templates** (`/admin/templates`) — Manage retro / estimate / icebreaker templates.
- **Team roles** (`/admin/team-roles`) — Manage assignable team job roles.
- **Convex** (`/admin/convex`) — Convex projection metrics and admin actions.

### Organizations (`/organizations/*`)

- **List** (`/organizations`) — Orgs the current user belongs to, plus create.
- **Detail** (`/organizations/$orgId`) — Members, teams, team roles, estimate templates, invitations. Actions gated on the caller's org role.

### Teams (`/teams`, `/teams/$teamId`)

- **List** (`/teams`) and **Detail** (`/teams/$teamId`) — Members, join requests, invitations. Actions by role: org-admin+/team-lead manage members and requests; members view and leave.

### Retros (`/retros/*`)

- **List** (`/retros`), **New** (`/retros/new`).
- **Board** (`/retros/$retroId`) — Full retro board across phases (`draft` → `waiting` → `active` → `grouping` → `voting` → `discussing` → `completed`). Real-time card, voting, and phase updates.
  - Facilitator controls (start, advance phases, group cards, complete) shown to creator / team-lead / admin.
  - Participants add cards, vote, and comment per the current phase.

### Estimates (`/estimate/*`)

- **List** (`/estimate`), **New** (`/estimate/new`).
- **Session** (`/estimate/$sessionId`) — Story estimate board: current story, participants, vote cards, timer. Click a card again to unvote.

### Icebreakers (`/icebreakers/*`)

- **List** (`/icebreakers`), **New** (`/icebreakers/new`), **Session** (`/icebreakers/$sessionId`) — Swipe-deck icebreaker sessions with live celebration feedback.

### Standups (`/standups/*`)

- **List** (`/standups`), **New** (`/standups/new`), **Detail** (`/standups/$standupId`) — Async standup submissions, calendar, comments, and reactions.

### Polls (`/polls`) & Surveys (`/surveys/*`)

- **Polls** (`/polls`) and **Surveys** (`/surveys`, `/surveys/$surveyId`) — Convex-only realtime features with PDF export.

### Reports (`/reports/*`)

- Dashboards for personal, team, org, and system scopes (`/reports`, `/reports/me`, `/reports/team/$teamId`, `/reports/org/$orgId`, `/reports/system`) — charts, league tables, CSV and PDF export. Access gated by `use-report-access`.

### Templates (`/templates`)

Browse and create retro and estimate templates available to the user.

---

## Authentication

Authentication is handled by **Better Auth**. The auth client is configured in
`src/lib/auth-client.ts` with the `passkey`, `jwt`, and `multiSession` plugins.

Credentials: a **session bearer token** (captured from the `set-auth-token` response header and
stored in `sessionStorage`) is the primary API credential; the `better-auth` session cookie is
kept as a fallback (`credentials: 'include'`). The `jwt` plugin also mints the RS256 token used to
authenticate the Convex client (see `realtime-providers.tsx`).

**Session flow:**

1. User signs in on `/auth/sign-in` (email/password, passkey, or Microsoft OAuth).
2. The auth response sets the cookie and returns a bearer token, which is stored client-side.
3. Subsequent requests send `Authorization: Bearer …` (cookie as fallback).
4. `useAuth()` reads the current session reactively.
5. Route layouts guard access — unauthenticated users are redirected to sign-in.

**Auth client methods used:**

```typescript
authClient.signIn.email({ email, password })
authClient.signIn.passkey()
authClient.signUp.email({ email, password, name })
authClient.signOut()            // use signOutWithCleanup() to also clear the bearer token
authClient.useSession()         // reactive session state
authClient.token()              // RS256 JWT for Convex
authClient.multiSession.{listDeviceSessions, setActive}
```

---

## RBAC & Permission Gating

The frontend mirrors the backend RBAC system in `src/lib/rbac.ts`. UI elements are shown or hidden
based on the current user's roles. See [docs/security/authorization-rbac.md](../docs/security/authorization-rbac.md) for the full permission matrix.

### Key Permission Helpers

```typescript
import {
  isSystemAdmin,
  isOrgAdminCtx,
  isOrgOwnerCtx,
  isTeamLeadCtx,
  buildOrgContext,
  buildTeamContext,
  canPerformOrgAction,
  canPerformTeamAction,
} from '@/lib/rbac'

// System-level
isSystemAdmin(user.role) // true for super-admin or system-admin

// Org-level (requires OrgContext)
const ctx = buildOrgContext(user, myOrgRole)
isOrgAdminCtx(ctx) // true for org-owner, org-admin, system-admin+
isOrgOwnerCtx(ctx) // true for org-owner, super-admin
canPerformOrgAction(ctx, 'org:update')

// Team-level (requires TeamContext)
const tCtx = buildTeamContext(user, myOrgRole, myTeamTag)
isTeamLeadCtx(tCtx) // true for team-lead, org-admin+, system-admin+
canPerformTeamAction(tCtx, 'team:invite_member')
```

### Enum Values

| Constant                  | Values                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| `USER_ROLES`              | `super-admin`, `system-admin`, `org-admin`, `team-lead`, `member` |
| `ORG_MEMBER_ROLES`        | `org-owner`, `org-admin`, `member`                                |
| `TEAM_MEMBER_TAGS`        | `team-lead`, `member`                                             |
| `TEAM_MEMBER_ROLES` (job) | `Dev`, `QA`, `QE`, `QA/QE`, `DevOps`, `BI-Dev`, `Oversight`       |

---

## API Layer

All HTTP calls go through the typed wrapper in `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api'

api.get<T>(url)
api.post<T>(url, body?)
api.patch<T>(url, body?)
api.put<T>(url, body?)
api.delete<T>(url)
```

- Base URL: `VITE_API_URL` env variable.
- Credentials: `Authorization: Bearer <token>` when present, plus `credentials: 'include'` (cookie fallback).
- Errors: throws `ApiError` carrying the HTTP status and the response error message.

All endpoint URLs are centralized in `src/lib/api-endpoints.ts` (each grouped constant already
includes the `/api` prefix):

```typescript
USERS_ENDPOINTS.ME // '/api/users/me'
USERS_ENDPOINTS.BULK_STATUS // '/api/users/bulk/status'
ORGANIZATIONS_ENDPOINTS.BY_ID(id) // '/api/organizations/:id'
TEAMS_ENDPOINTS.JOIN_REQUEST_APPROVE(id, requestId)
RETROS_ENDPOINTS.START(retroId)
ESTIMATES_ENDPOINTS.VOTES(sessionId)
NOTIFICATIONS_ENDPOINTS.MARK_READ(id)
// etc.
```

---

## Real-Time

Realtime is pluggable per feature. `src/lib/realtime-config.ts` selects a backend from the
`VITE_*_REALTIME_BACKEND` flags (`socket-io` | `convex`); Convex is only used when a feature is set
to `convex` **and** `VITE_CONVEX_URL` is configured. Convex is **self-hosted** (local Docker /
Azure App Service), not Convex Cloud.

### Socket.IO namespaces

`src/lib/socket.ts` opens lazy singletons against the API server: `/notifications`, `/retros`,
`/estimates`, `/icebreakers`, `/standups`. Handshake auth sends the bearer token (cookie fallback).

- **Retros** — `retro:phase`, `card:*`, `vote:*` events drive live phase transitions and card updates.
- **Estimates** — join/vote/reveal/clear/timer events for a story estimate session.
- **Icebreakers / Standups** — live session participation and reactions.
- **Notifications** — `new-notification` events update the `NotificationBell` badge and dropdown.

### Convex

When enabled, feature-specific Convex sync components (e.g. `retro-convex-sync.tsx`,
`estimate-convex-sync.tsx`, `notification-convex-sync.tsx`) subscribe to the projection layer via
the Convex React SDK, authenticated with the RS256 JWT from Better Auth. **Polls and surveys are
Convex-only** — they have no Socket.IO path and use Convex whenever `VITE_CONVEX_URL` is set.

### Browser Push Notifications

Opt-in push is available via the `NotificationBell` dropdown toggle.

- `use-push-notifications.ts` — wraps the VAPID flow: fetch public key → request permission → register `sw.js` → subscribe.
- `public/sw.js` — service worker that handles `push` events and displays system notifications.
- Requires `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` configured on the API server.

---

## User Flows

### 1. New User Registration

```text
/auth/sign-up  →  POST /api/auth/sign-up/email
                    ↓
         Status: 'pending' (awaiting admin approval)
                    ↓
         Admin approves via /admin/users:
           PATCH /api/users/:id/status { status: 'approved' }
                    ↓
         User can now sign in
```

### 2. Creating an Organization

```text
/organizations  →  "Create"
                    ↓
POST /api/organizations { name, slug }
                    ↓
         Redirected to /organizations/:orgId; creator becomes org-owner
```

### 3. Creating a Team & Adding Members

```text
/organizations/:orgId  →  "Create Team" (org-admin+ only)
                    ↓
POST /api/teams { name, organizationId, description }
                    ↓
/teams/:teamId  →  "Add Member" (org-admin+ or team-lead)
```

### 4. Running a Retrospective (Facilitator)

```text
POST /api/retros { name, teamId, templateId, ... }   →  retro created ('draft')
POST /api/retros/:id/start                            →  phase → 'active'; participants add cards
… advance through grouping → voting → discussing …
POST /api/retros/:id/complete                         →  completed; action items saved
```

### 5. Story Estimate Session

```text
POST /api/estimates { name, currentStory }
POST /api/estimates/:id/join                          →  participants join
POST /api/estimates/:id/votes { points }              →  vote (click again to unvote)
POST /api/estimates/:id/reveal                        →  reveal votes
POST /api/estimates/:id/clear                         →  next round
```

### 6. Admin: Managing Users

```text
/admin/users  →  Filter by status='pending'
PATCH /api/users/:id/status { status: 'approved' | 'rejected' }
POST  /api/users/:id/suspend { reason }  /  POST /api/users/:id/reactivate
POST  /api/users/bulk/status { userIds, status }
```

> Endpoint paths above are illustrative of the flow. The authoritative endpoint list lives in the
> [backend API README](../retro-tool-api/README.md) and `src/lib/api-endpoints.ts`.

---

## Roles Reference

See [docs/security/authorization-rbac.md](../docs/security/authorization-rbac.md) for the full permission matrix.

| Role           | Context | What they can do in the UI                                       |
| -------------- | ------- | ---------------------------------------------------------------- |
| `super-admin`  | System  | Everything — plus promote/demote other admins                    |
| `system-admin` | System  | Admin panel (user management, all orgs), org/team overrides      |
| `org-owner`    | Org     | All org settings, promote/demote org-admins, delete org          |
| `org-admin`    | Org     | Invite/remove members, create/delete teams, manage join requests |
| `member`       | Org     | View org, join teams, participate in sessions                    |
| `team-lead`    | Team    | Manage team members, approve join requests, facilitate sessions  |
| `member`       | Team    | Add cards, vote, comment, participate in estimates/standups/etc. |

---

## Environment Setup

Copy the example env file:

```powershell
Copy-Item .env.example .env.local
```

Key variables in `.env.local`:

```env
VITE_APP_TITLE=Retro Tool
VITE_APP_ENV=local                         # local | development | staging | production
VITE_API_URL=http://localhost:8000
VITE_CONVEX_URL=http://localhost:3210      # optional; omit to disable Convex realtime

# Per-feature realtime backend — socket-io | convex (defaults to socket-io locally)
VITE_ESTIMATES_REALTIME_BACKEND=socket-io
VITE_RETROS_REALTIME_BACKEND=socket-io
VITE_ICEBREAKERS_REALTIME_BACKEND=socket-io
VITE_STANDUPS_REALTIME_BACKEND=socket-io
VITE_NOTIFICATIONS_REALTIME_BACKEND=socket-io
```

- All `VITE_*` vars are validated by `src/env.ts` (`@t3-oss/env-core` + Zod) at build/startup.
- `VITE_CONVEX_URL` is **compiled into the bundle at build time** — it is not a runtime switch, so a build is tied to one Convex deployment.
- Locally, the realtime flags default to `socket-io`. Flip individual features to `convex` once the local Convex container is running (`VITE_CONVEX_URL` set). Polls and surveys use Convex automatically whenever `VITE_CONVEX_URL` is set.

### Running against remote environments

Additional env files exist for local development against Azure resources:

| File                    | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `.env.staging-local`    | Points at staging Convex + local API (which hits staging DB) |
| `.env.production-local` | Points at production Convex + local API (which hits prod DB) |

```powershell
pnpm dev:staging   # Loads .env.staging-local     (vite --mode staging-local)
pnpm dev:prod      # Loads .env.production-local   (vite --mode production-local)
```

---

## Running the App

The recommended local setup starts the whole stack from the **repo root**:

```bash
pnpm install            # install all workspace deps (run once)
pnpm local:bootstrap    # one-time: start local infra (Postgres + Convex) & seed
pnpm local:dev          # run API + UI + Convex watcher together
```

To run just the UI (Vite on port 3000) against an already-running API:

```bash
pnpm dev:ui             # from repo root  (or: pnpm dev  from retro-tool-ui/)
```

Package-level scripts (run from `retro-tool-ui/`):

```bash
pnpm dev                # dev server on :3000
pnpm dev:staging        # against staging resources (--mode staging-local)
pnpm dev:prod           # against production resources (--mode production-local)
pnpm build              # production build
pnpm preview            # preview the production build
pnpm lint               # ESLint
pnpm type-check         # tsc --noEmit
pnpm test               # Vitest
```

App runs at `http://localhost:3000`.

> The API server must be running at `VITE_API_URL` (default `http://localhost:8000`) for
> authentication and data fetching to work. The UI does not talk to Postgres directly.

---

## User Guide (VitePress)

An end-user guide lives alongside the app source in `retro-tool-ui/docs/` and is built with
VitePress. It is served same-origin at `/docs` from the same Azure Static Web App artifact as the
React SPA.

### How it works

The VitePress config (`docs/.vitepress/config.ts`) sets:

- `base: '/docs/'` — all asset URLs are rooted at `/docs`.
- `outDir: '../dist/docs'` — output lands inside the Vite build output (`retro-tool-ui/dist/docs`),
  so the `deploy-ui.yml` workflow's single upload of `retro-tool-ui/dist` ships both the SPA and
  the guide.

The SWA routing config (`public/staticwebapp.config.json`) excludes `/docs/*` from the SPA
`navigationFallback` rewrite, so requests to `/docs/*` are served as plain static files rather than
being rewritten to `index.html`.

### Scripts (`retro-tool-ui/package.json`)

| Script              | What it does                                                                         |
| ------------------- | ------------------------------------------------------------------------------------ |
| `pnpm docs:dev`     | VitePress dev server with hot-reload (`vitepress dev docs`)                          |
| `pnpm docs:build`   | Build the guide only (`vitepress build docs`)                                        |
| `pnpm docs:preview` | Preview the built guide (`vitepress preview docs`)                                   |
| `pnpm build`        | Full production build: `vite build` then `vitepress build docs` (both SPA and guide) |

### Local development

Run the VitePress dev server independently of the main app:

```bash
pnpm --filter retro-tool-ui docs:dev
```

The guide hot-reloads on any change to `retro-tool-ui/docs/**/*.md` or the VitePress config. It
does not depend on the API or Convex being running.

### Content location

Do **not** edit files under `retro-tool-ui/docs/` via the maintainer docs tooling — that directory
is the user-facing guide itself and is authored separately.

---

## License

See [LICENSE](../LICENSE) at the repository root.
</content>
</invoke>
