# Role-Based Access Control (RBAC)

This document describes the complete permission system used across the Retro Tool platform. Both the API and the frontend share identical role definitions and permission logic.

---

## Role Hierarchy

The system uses two parallel role dimensions: a **system-level user role** (stored on the user record) and a **context role** (stored per org/team membership).

```
System Level (user.role)
├── super-admin       ← root administrator, full access everywhere
├── system-admin      ← platform admin, manages orgs & users globally
├── org-admin         ← deprecated field; org authority is via OrgRole
├── team-lead         ← deprecated field; team authority is via TeamTag
└── member            ← default for all new users
```

> `org-admin` and `team-lead` in `user.role` are legacy values. Authoritative org/team authority is derived from the membership tables below.

---

## Context Roles

### Organization Role (`organizationMember.role`)

Assigned per org membership. A user can have different roles in different organizations.

| Value | Label | Description |
|-------|-------|-------------|
| `org-owner` | Owner | Created the org; can delete it, transfer ownership, promote/demote admins |
| `org-admin` | Admin | Can manage members, invite users, update org settings, create/delete teams |
| `member` | Member | Can view org and team information, join teams |

### Team Tag (`teamMember.tag`)

Assigned per team membership.

| Value | Label | Description |
|-------|-------|-------------|
| `team-lead` | Team Lead | Can manage team members, approve join requests, manage retros |
| `member` | Member | Can participate in retros, vote, add cards |

---

## System-Level Permissions

System permissions are derived from `user.role` alone.

| Action | super-admin | system-admin | Any other role |
|--------|:-----------:|:------------:|:--------------:|
| Promote user to system-admin | ✓ | | |
| Demote system-admin to member | ✓ | | |
| Reactivate suspended user | ✓ | | |
| Suspend a user | ✓ | ✓ | |
| View all organizations | ✓ | ✓ | |
| Manage all users (list, view details, change status/role) | ✓ | ✓ | |
| Bootstrap first admin | anon | anon | anon |

---

## Organization-Level Permissions

Org permissions are evaluated from the combined `(user.role, organizationMember.role)` context.

> **Note:** `super-admin` and `system-admin` can perform any org action even if they are not org members.

| Action | super-admin | system-admin | org-owner | org-admin | member |
|--------|:-----------:|:------------:|:---------:|:---------:|:------:|
| Create organization | ✓ | ✓ | ✓ (for self) | | |
| Read organization details | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update organization settings | ✓ | ✓ | ✓ | ✓ | |
| Delete organization | ✓ | ✓ | ✓ | | |
| Invite / add member | ✓ | ✓ | ✓ | ✓ | |
| Remove member | ✓ | ✓ | ✓ | ✓ | |
| Promote member to org-admin | ✓ | ✓ | ✓ | | |
| Demote org-admin to member | ✓ | ✓ | ✓ | | |
| Transfer org ownership | ✓ | ✓ | ✓ | | |
| Create team in org | ✓ | ✓ | ✓ | ✓ | |
| Delete team in org | ✓ | ✓ | ✓ | ✓ | |

---

## Team-Level Permissions

Team permissions are evaluated from the combined `(user.role, organizationMember.role, teamMember.tag)` context.

> **Note:** `super-admin`, `system-admin`, `org-owner`, and `org-admin` always have team management authority even if they are not team members.

| Action | super-admin / system-admin | org-owner / org-admin | team-lead | member |
|--------|:--------------------------:|:---------------------:|:---------:|:------:|
| Create team | ✓ | ✓ | | |
| Read team details | ✓ | ✓ | ✓ | ✓ |
| Update team settings | ✓ | ✓ | ✓ | |
| Delete team | ✓ | ✓ | | |
| Invite / add member to team | ✓ | ✓ | ✓ | |
| Remove member from team | ✓ | ✓ | ✓ | |
| View join requests | ✓ | ✓ | ✓ | |
| Approve join request | ✓ | ✓ | ✓ | |
| Reject join request | ✓ | ✓ | ✓ | |
| Self-join an open team | ✓ (if org member) | ✓ (if org member) | ✓ | ✓ (if org member) |
| Leave team | ✓ | ✓ | ✓ | ✓ |

---

## Retro-Level Permissions

Any authenticated team member can create and participate in retros. Control actions (start, end, phase transitions) require being the retro creator or having team-lead/admin authority.

| Action | Any team member | Retro creator | team-lead / org-admin / admin |
|--------|:---------------:|:-------------:|:-----------------------------:|
| Create retro | ✓ | | |
| Read retro | ✓ | ✓ | ✓ |
| Participate (add cards, vote, comment) | ✓ | ✓ | ✓ |
| Start retro | | ✓ | ✓ |
| Move phase (grouping / voting / discussion) | | ✓ | ✓ |
| Complete retro | | ✓ | ✓ |
| Delete retro | | ✓ | ✓ |
| Update retro settings | | ✓ | ✓ |

---

## Reports Access (v2 dashboards)

Enforced by dedicated guards in `retro-tool-api/src/reports/guards/` (not service asserts).
Lead status comes from `teamMember.tag === 'team-lead'` with the standard admin cascade
(`isTeamLead()` is also true for org-owner/org-admin/system-admin/super-admin). The `user.role`
legacy values are never consulted.

| Endpoint | member | team-lead | org-owner / org-admin | system-admin / super-admin |
|----------|:------:|:---------:|:---------------------:|:--------------------------:|
| `GET /reports/v2/me` (always self-scoped) | ✓ | ✓ | ✓ | ✓ |
| `GET /reports/v2/teams/:teamId` (aggregate) | ✓ (own team) | ✓ | ✓ (own org) | ✓ |
| — `memberBreakdown` field in the payload | | ✓ | ✓ (own org) | ✓ |
| `GET /reports/v2/teams/:teamId/members` | | ✓ | ✓ (own org) | ✓ |
| `GET /reports/v2/organizations/:orgId` (+`/teams`) | | | ✓ (own org) | ✓ |
| `GET /reports/v2/platform` (+`/organizations`) | | | | ✓ |

Response shaping is server-side: a plain member calling the team endpoint receives the aggregate
`TeamReport` without `memberBreakdown` — the client never has to hide fields.

---

## Type Definitions

### Backend (`src/lib/rbac.ts`)

```typescript
type UserRole = 'super-admin' | 'system-admin' | 'org-admin' | 'team-lead' | 'member'
type OrgRole  = 'org-owner' | 'org-admin' | 'member'

interface UserContext  { id: string; role: UserRole }
interface OrgContext   { user: UserContext; orgRole: OrgRole | null; isSuperAdmin: boolean; isSystemAdmin: boolean }
interface TeamContext  { user: UserContext; orgRole: OrgRole | null; teamTag: 'team-lead' | 'member' | null; isSuperAdmin: boolean; isSystemAdmin: boolean }
```

### Frontend (`src/lib/rbac.ts`)

The frontend mirrors all backend types and permission functions for UI-level gating (showing/hiding buttons, redirecting unauthorized routes).

```typescript
// Enums
USER_ROLES    = { SuperAdmin: 'super-admin', SystemAdmin: 'system-admin', OrgAdmin: 'org-admin', TeamLead: 'team-lead', Member: 'member' }
ORG_ROLES     = { Owner: 'org-owner', Admin: 'org-admin', Member: 'member' }
TEAM_TAGS     = { Lead: 'team-lead', Member: 'member' }
```

---

## Permission Helper Functions

Both backend and frontend expose the same set of pure helper functions:

| Function | Returns `true` when |
|----------|---------------------|
| `isSuperAdmin(user)` | `user.role === 'super-admin'` |
| `isSystemAdmin(user)` | `user.role` is `super-admin` or `system-admin` |
| `isOrgAdmin(ctx)` | user is system-admin+ OR org member with role `org-owner` or `org-admin` |
| `isOrgOwner(ctx)` | user is system-admin+ OR org member with role `org-owner` |
| `isTeamLead(ctx)` | user is system-admin+ OR org admin+ OR team member with tag `team-lead` |
| `canPerformSystemAction(user, action)` | Action is in the system permission matrix |
| `canPerformOrgAction(ctx, action)` | Action is in the org permission matrix |
| `canPerformTeamAction(ctx, action)` | Action is in the team permission matrix |
| `canPerformRetroAction(user, action, opts)` | Action is in the retro permission matrix |
| `assertPermission(condition, message)` | Throws `ForbiddenException` if `condition` is false |

---

## Context Builders (Backend)

`CommonService` provides async helpers that query the DB and return typed context objects:

```typescript
// Build org-level context for a user+org combination
commonService.buildOrgContext(userId, orgId): Promise<OrgContext>

// Build team-level context (resolves team → org automatically)
commonService.buildTeamContext(userId, teamId): Promise<TeamContext>
```

---

## User Status Lifecycle

A user's `status` field controls whether they can log in and access the platform.

```
pending  →  approved  →  suspended
   ↓            ↓             ↓
rejected    (active)     reactivated → approved
```

| Status | Can log in | Notes |
|--------|:----------:|-------|
| `pending` | No* | Awaiting admin approval |
| `approved` | Yes | Normal active user |
| `rejected` | No | Application declined |
| `suspended` | No | Suspended by admin; can be reactivated |

> *Users added directly to a team by an admin are auto-approved.

---

## Authentication

- Session-based via **Better Auth** (cookie: `better-auth.session_token`)
- WebSocket connections authenticate by extracting the session cookie from the handshake headers and validating against the `session` DB table
- All REST endpoints (except `/auth/*`, `/api/users/admin/exists`, `/api/users/admin/bootstrap`) require an active session
