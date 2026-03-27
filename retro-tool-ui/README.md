# Retro Tool UI

The frontend application for the Retro Tool platform — a collaborative agile retrospective tool. Built with React 19, TanStack Router, TanStack Query, Radix UI, and TailwindCSS 4.

- [License](../LICENSE)
- [RBAC & Permissions](../RBAC.md)
- [Backend API](../retro-tool-api/README.md)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [App Modules & Pages](#app-modules--pages)
4. [Authentication](#authentication)
5. [RBAC & Permission Gating](#rbac--permission-gating)
6. [API Layer](#api-layer)
7. [Real-Time (WebSocket)](#real-time-websocket)
8. [User Flows](#user-flows)
9. [Roles Reference](#roles-reference)
10. [Environment Setup](#environment-setup)
11. [Running the App](#running-the-app)

---

## Tech Stack

| Layer           | Technology                         |
| --------------- | ---------------------------------- |
| Framework       | React 19                           |
| Routing         | TanStack Router (file-based)       |
| Data Fetching   | TanStack Query                     |
| Forms           | TanStack Form                      |
| Tables          | TanStack Table                     |
| Auth Client     | Better Auth (`better-auth/client`) |
| UI Components   | Radix UI primitives                |
| Styling         | TailwindCSS 4                      |
| Charts          | Recharts                           |
| Real-time       | Socket.io client                   |
| Validation      | Zod                                |
| Package Manager | pnpm                               |

---

## Project Structure

```text
src/
├── common/
│   ├── enums/
│   │   ├── user.enums.ts          # USER_ROLES, USER_STATUSES
│   │   ├── organization.enums.ts  # ORG_MEMBER_ROLES
│   │   ├── team.enums.ts          # TEAM_MEMBER_TAGS, TEAM_MEMBER_ROLES (job roles)
│   │   ├── retro.enums.ts         # RETRO_STATUSES, RETRO_PHASES
│   │   └── notification.enums.ts  # NOTIFICATION_TYPES
│   └── types/
│       ├── user.ts                # User, UserDetails
│       ├── organizations.ts       # Organization, OrgMember, CreateOrganizationInput
│       ├── teams.ts               # Team, TeamMember, CreateTeamInput
│       ├── retros.ts              # Retro, RetroCard, RetroTemplate
│       ├── estimates.ts           # StoryEstimateSession, StoryEstimateParticipant, StoryEstimateVote
│       └── notifications.ts       # Notification
│
├── components/
│   ├── ui/                        # Base components (Button, Input, Dialog, Badge…)
│   ├── tables/                    # Reusable table column definitions
│   ├── skeletons/                 # Loading skeleton screens
│   ├── NotificationBell.tsx       # Header notification dropdown
│   └── UserRoleBadges.tsx         # Renders org/team role badges
│
├── hooks/
│   ├── use-auth.ts                # useAuth() — session + user
│   ├── useCurrentUser.ts          # useCurrentUser() — own profile
│   ├── usePushNotifications.ts    # useSubscribe/unsubscribe to browser push
│   └── use-theme.ts               # useTheme() — dark/light mode
│
├── integrations/
│   ├── better-auth/               # authClient singleton
│   └── tanstack-query/            # queryClient singleton
│
├── lib/
│   ├── api.ts                     # Typed HTTP wrapper (api.get/post/patch/put/delete)
│   ├── api-endpoints.ts           # All endpoint URL constants
│   ├── auth-client.ts             # Better Auth client (multiSession plugin)
│   └── rbac.ts                    # Frontend RBAC helpers (mirrors backend)
│
├── routes/
│   ├── __root.tsx                 # Root layout (header, sidebar, auth guard)
│   ├── index.tsx                  # Redirect to /dashboard
│   ├── auth/
│   │   ├── login.tsx              # Login page
│   │   └── register.tsx           # Registration page
│   ├── dashboard/
│   │   └── index.tsx              # User dashboard (recent retros, stats)
│   ├── admin/
│   │   ├── index.tsx              # Admin overview
│   │   ├── users.tsx              # User management (list, approve, suspend)
│   │   ├── organizations.tsx      # Admin org management
│   │   └── hooks/
│   │       ├── useAdminUserMutations.ts
│   │       └── useAdminOrganizationMutations.ts
│   ├── organizations/
│   │   ├── index.tsx              # Org list + create
│   │   ├── $orgId.tsx             # Org detail (members, teams, settings)
│   │   └── hooks/
│   │       └── useOrganizationMutations.ts
│   ├── teams/
│   │   ├── $teamId.tsx            # Team detail (members, join requests, retros)
│   │   └── hooks/                 # Team mutation hooks
│   ├── retros/
│   │   ├── index.tsx              # Retro list
│   │   ├── $retroId.tsx           # Active retro board (cards, voting, phases)
│   │   └── hooks/
│   │       └── useRetroMutations.ts
│   └── estimate/
│       ├── index.tsx              # Estimate session list
│       └── $sessionId.tsx         # Planning poker board
│
└── main.tsx                       # App entry (Router + QueryClient providers)
```

---

## App Modules & Pages

### Auth Pages (`/auth/*`)

- **Login** (`/auth/login`) — Email/password sign-in. Redirects to `/dashboard` on success.
- **Register** (`/auth/register`) — New account creation. Account enters `pending` status awaiting admin approval.

### Dashboard (`/dashboard`)

Displays the current user's recent retros, team activity, and key stats. Accessible to all authenticated users.

### Admin Panel (`/admin/*`)

Restricted to `super-admin` and `system-admin` users. The root layout checks `isSystemAdmin(user.role)` and redirects unauthorized users.

- **Users** (`/admin/users`) — Paginated user list with filters (status, role). Actions: approve, reject, suspend, reactivate, change role, promote to system-admin, bulk approve/reject.
- **Organizations** (`/admin/organizations`) — Create, edit, delete any organization. List all orgs across the platform.

### Organizations (`/organizations/*`)

- **List** (`/organizations`) — Shows organizations the current user belongs to. Button to create a new org.
- **Detail** (`/organizations/:orgId`) — Shows org info, member list, teams list. Actions available based on `myRole`:
  - `org-owner` / `org-admin` (or system-admin): edit org, invite members, remove members, change member roles, create teams, delete teams.
  - `member`: view only, can request to join teams.

### Teams (`/teams/:teamId`)

Shows team info, member list, join requests (if manager), and recent retros. Available actions by role:

- **system-admin / org-admin / org-owner**: add/remove members, approve join requests, update team, delete team.
- **team-lead**: manage members and join requests.
- **member**: view team info, leave team.

### Retros (`/retros/*`)

- **List** (`/retros`) — Recent retros the user is involved in.
- **Board** (`/retros/:retroId`) — The full retro board. Shows the current phase (collecting → grouping → voting → discussion → completed). Real-time card, voting, and phase updates via WebSocket.
  - Facilitator controls (start, advance phases, merge/unmerge cards, complete) shown only to creator / team-lead / admin.
  - All participants can add cards (in `active` phase), vote (in `voting` phase), and comment (in `discussion` phase).

### Estimates (`/estimate/*`)

- **List** (`/estimate`) — Active and all estimate sessions.
- **Session** (`/estimate/:sessionId`) — Story estimate board. Shows current story, participant list, vote cards, timer. Real-time via WebSocket. Voting toggles on second click (unvote).

---

## Authentication

Authentication is handled by **Better Auth** via a cookie-based session. The auth client is configured in `src/lib/auth-client.ts`.

**Session flow:**

1. User submits credentials on `/auth/login`
2. `authClient.signIn.email()` POST → API sets `better-auth.session_token` cookie
3. Subsequent requests include the cookie automatically (`credentials: 'include'`)
4. `useAuth()` hook reads the current session reactively
5. `__root.tsx` layout guards: unauthenticated users are redirected to `/auth/login`

**Auth client methods used:**

```typescript
authClient.signIn.email({ email, password })
authClient.signUp.email({ email, password, name })
authClient.signOut()
authClient.useSession() // reactive session state
authClient.updateUser({ name }) // update own profile
```

---

## RBAC & Permission Gating

The frontend mirrors the backend RBAC system in `src/lib/rbac.ts`. UI elements are shown or hidden based on the current user's roles.

See [RBAC.md](../RBAC.md) for the full permission matrix.

### Key Permission Helpers

```typescript
import {
  isSystemAdmin,
  isOrgAdmin,
  isTeamLead,
  canPerformOrgAction,
} from '@/lib/rbac'

// System-level
isSystemAdmin(user.role) // true for super-admin or system-admin

// Org-level (requires OrgContext)
const ctx = buildOrgContext(user, myOrgRole)
isOrgAdmin(ctx) // true for org-owner, org-admin, system-admin+
isOrgOwner(ctx) // true for org-owner, super-admin
canPerformOrgAction(ctx, 'org:update')

// Team-level (requires TeamContext)
const tCtx = buildTeamContext(user, myOrgRole, myTeamTag)
isTeamLead(tCtx) // true for team-lead, org-admin+, system-admin+
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

- Base URL: `VITE_API_URL` env variable
- Credentials: `'include'` (sends session cookie automatically)
- Errors: throws with the response error message

All endpoint URLs are centralized in `src/lib/api-endpoints.ts`:

```typescript
USERS_ENDPOINTS.ME // '/api/users/me'
ORGANIZATIONS_ENDPOINTS.BY_ID(id) // '/api/organizations/:id'
TEAMS_ENDPOINTS.JOIN_REQUEST_APPROVE(id, requestId)
RETROS_ENDPOINTS.START(retroId)
ESTIMATES_ENDPOINTS.VOTES(sessionId)
NOTIFICATIONS_ENDPOINTS.MARK_READ(id)
// etc.
```

---

## Real-Time (WebSocket)

The app connects to two Socket.io namespaces on the API server.

### Notifications namespace (`/notifications`)

- Connects on login, disconnects on logout
- Receives `new-notification` events → updates the `NotificationBell` badge and dropdown
- Authentication: session cookie in handshake headers

### Browser Push Notifications

Opt-in push notifications are available via the `NotificationBell` dropdown toggle.

- `usePushNotifications()` hook — wraps VAPID subscription flow: fetches public key → requests permission → registers `sw.js` service worker → subscribes via `POST /api/notifications/push-subscribe`
- `public/sw.js` — service worker that handles `push` events and displays system notifications
- Requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` configured on the API server

### Estimates namespace (`/estimates`)

- Connects when a user opens a story estimate session page
- Emits: `join-session`, `cast-vote`, `reveal-votes`, `clear-votes`, `update-story`, `start-timer`, `end-session`
- Receives: `participant-joined`, `participant-left`, `vote-cast`, `votes-revealed`, `votes-cleared`, `story-updated`, `timer-started`, `session-ended`

### Retros namespace (`/retros`)

- Connects when a user opens a retro board
- Receives: `retro:phase`, `card:created`, `card:updated`, `card:deleted`, `vote:changed`
- Real-time phase transitions and card updates without page refresh

---

## User Flows

### 1. New User Registration

```text
/auth/register  →  POST /api/auth/sign-up/email
                    ↓
         Status: 'pending' (awaiting admin approval)
                    ↓
         Admin approves via /admin/users:
           PATCH /api/users/:id/status { status: 'approved' }
                    ↓
         User can now log in
```

### 2. First Admin Bootstrap

```text
GET /api/users/admin/exists  →  { exists: false }
                    ↓
POST /api/users/admin/bootstrap { email, password, name }
                    ↓
         super-admin created, redirected to login
```

### 3. Creating an Organization

```text
/organizations  →  click "Create"
                    ↓
POST /api/organizations { name, slug }
                    ↓
         Redirected to /organizations/:orgId
         Creator becomes org-owner
```

### 4. Inviting Team Members

```text
/organizations/:orgId  →  "Invite Member" (org-admin+ only)
                    ↓
POST /api/organizations/:id/invite { email, role }
                    ↓
         User added to org as member (or org-admin)
```

### 5. Creating a Team & Adding Members

```text
/organizations/:orgId  →  "Create Team" (org-admin+ only)
                    ↓
POST /api/teams { name, organizationId, description }
                    ↓
/teams/:teamId  →  "Add Member" (org-admin+ or team-lead)
                    ↓
POST /api/teams/:id/members { userId, tag }
```

### 6. Running a Retrospective (Facilitator)

```text
POST /api/retros { name, teamId, templateId, ... }
         ↓ (retro created in 'draft' state)

POST /api/retros/:id/start
         ↓ WebSocket: retro:phase → 'active'
         Participants can add cards

POST /api/retros/:id/grouping
         ↓ Facilitator groups similar cards

POST /api/retros/:id/voting
         ↓ WebSocket: retro:phase → 'voting'
         Participants vote on cards

POST /api/retros/:id/discussion
         ↓ Team discusses highest-voted items

POST /api/retros/:id/complete
         ↓ Retro marked completed, action items saved
```

### 7. Participating in a Retrospective (Member)

```text
GET /api/retros/:id                      →  View retro board
POST /api/retros/:id/join                →  Join as participant
POST /api/retros/cards                   →  Add a card (active phase)
POST /api/retros/cards/:id/vote          →  Vote (voting phase)
POST /api/retros/cards/:id/comments     →  Comment (discussion)
```

### 8. Story Estimate Session

```text
POST /api/estimates { name, currentStory }
         ↓
POST /api/estimates/:id/join             →  Participants join
POST /api/estimates/:id/votes { points } →  Each votes (click again to unvote)
POST /api/estimates/:id/reveal           →  Reveal votes
POST /api/estimates/:id/clear            →  Next round
DELETE /api/estimates/:id                →  End session
```

### 9. Admin: Managing Users

```text
/admin/users  →  Filter by status='pending'
                    ↓
PATCH /api/users/:id/status { status: 'approved' }   →  Approve
PATCH /api/users/:id/status { status: 'rejected' }   →  Reject
POST  /api/users/:id/suspend { reason }              →  Suspend
POST  /api/users/:id/reactivate                      →  Reactivate
POST  /api/users/bulk/status { userIds, status }     →  Bulk approve
```

### 10. Promoting an Org Member to Admin

```text
/organizations/:orgId  →  Member row → "Change Role" (org-owner+ only)
                    ↓
PATCH /api/organizations/:orgId/members/:memberId/role { role: 'org-admin' }
```

### 11. Approving a Team Join Request

```text
/teams/:teamId  →  "Join Requests" tab (team-lead+ only)
                    ↓
GET  /api/teams/:id/join-requests
POST /api/teams/:id/join-requests/:requestId/approve
```

---

## Roles Reference

See [RBAC.md](../RBAC.md) for the full permission matrix.

| Role           | Context | What they can do in the UI                                       |
| -------------- | ------- | ---------------------------------------------------------------- |
| `super-admin`  | System  | Everything — plus promote/demote other admins                    |
| `system-admin` | System  | Admin panel (user management, all orgs), org/team overrides      |
| `org-owner`    | Org     | All org settings, promote/demote org-admins, delete org          |
| `org-admin`    | Org     | Invite/remove members, create/delete teams, manage join requests |
| `member`       | Org     | View org, join teams, participate in retros                      |
| `team-lead`    | Team    | Manage team members, approve join requests, facilitate retros    |
| `member`       | Team    | Add cards, vote, comment, participate in estimates               |

---

## Environment Setup

Create a `.env` file in the project root (`retro-tool-ui/`):

```env
# Required — points to the NestJS API server
VITE_API_URL=http://localhost:8000
```

---

## Running the App

```bash
# Install dependencies
pnpm install

# Start development server (hot reload)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Lint
pnpm lint

# Format
pnpm format

# Run tests
pnpm test
```

App runs at `http://localhost:5173` by default.

> The API server must be running at `VITE_API_URL` for authentication and data fetching to work.

---

## License

See [LICENSE](../LICENSE) at the repository root.
