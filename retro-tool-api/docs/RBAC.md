## Role-Based Access Control (RBAC)

The application implements a hierarchical role-based access control system with five distinct levels across two role dimensions.

---

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                SUPER ADMIN (user.role = "super-admin")              │
│  • One user only — the root administrator                           │
│  • Promote/demote System Admins                                     │
│  • Full access to all system, organization, team, and retro ops     │
│  • Suspend/unsuspend any user account                               │
├─────────────────────────────────────────────────────────────────────┤
│               SYSTEM ADMIN (user.role = "system-admin")             │
│  • Create and delete organizations (system-wide)                    │
│  • View and manage all organizations                                │
│  • Suspend user accounts                                            │
│  • Assign/revoke Organization Admin roles                           │
│  • Full access to all org, team, and retro operations               │
├─────────────────────────────────────────────────────────────────────┤
│       ORGANIZATION ADMIN (user.role = "org-admin")         │
│       Sub-roles determined by organization.role:                    │
│                                                                     │
│  ┌─ Owner (organization.role = "owner") ────────────────────────┐  │
│  │  • All admin capabilities below                              │  │
│  │  • Promote/demote Organization Admins within their org       │  │
│  │  • Delete their organization                                 │  │
│  │  • Transfer ownership to another member                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌─ Admin (organization.role = "admin") ────────────────────────┐  │
│  │  • Create/rename/delete teams within their organization      │  │
│  │  • Invite/remove members from their org and its teams        │  │
│  │  • Promote/demote Team Leads within their organization       │  │
│  │  • Update organization and team descriptions                 │  │
│  │  • Run retro operations                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                  TEAM LEAD (user.role = "team-lead")                │
│  • Invite members to their team                                     │
│  • Remove members from their team                                   │
│  • Approve/reject join requests for their team                      │
│  • Update their team's details                                      │
│  • Demote themselves to Member                                      │
│  • Run retro operations                                             │
├─────────────────────────────────────────────────────────────────────┤
│                    MEMBER (user.role = "member")                    │
│  • Request to join teams                                            │
│  • Leave teams they belong to                                       │
│  • Participate in retro sessions                                    │
│  • View organization and team information they belong to            │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Role Structure in Database

The role system uses **two** role dimensions:

| Dimension        | Field               | Values                                                            | Location                                |
| ---------------- | ------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| **System**       | `user.role`         | `super-admin`, `system-admin`, `org-admin`, `team-lead`, `member` | `user` table                            |
| **Organization** | `organization.role` | `owner`, `admin`, `member`                                        | `member` table (Better Auth org plugin) |

> **Note on team-lead scope**: `user.role = "team-lead"` is a global designation. Per-team context (which team(s) they lead) is resolved at query time via the `team_member` table. If Better Auth's teams feature is used, team membership is tracked there; the `user.role` field only indicates the user has at least one team lead assignment.

> **Note on super-admin singleton**: The uniqueness of the super-admin is enforced at the application layer (not database constraint) — only one user may hold `user.role = "super-admin"` at a time.

---

### Better Auth Integration

| Feature                   | Approach                                                                          | Notes                                       |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| `user.role` custom values | `additionalFields` on the user schema or Better Auth's built-in `user.role` field | Supports any string value                   |
| `organization.role`       | Better Auth organization plugin (built-in: `owner`, `admin`, `member`)            | No change needed                            |
| Teams                     | `organization({ teams: { enabled: true } })`                                      | Team membership tracked by Better Auth      |
| Team lead per-team        | `additionalFields` on `team_member` schema if granularity is needed               | `user.role` handles global designation      |
| Super-admin singleton     | Application-layer enforcement on promote/demote endpoints                         | No database unique constraint               |
| Permission checking       | `hasPermission()` endpoint + server-side `assertPermission()`                     | Use Dynamic Access Control for custom roles |

---

### Permission Actions

#### System Actions

| Action                        | Super Admin | System Admin | Org Admin | Team Lead | Member |
| ----------------------------- | :---------: | :----------: | :-------: | :-------: | :----: |
| `system:promote_system_admin` |     ✅      |      ❌      |    ❌     |    ❌     |   ❌   |
| `system:demote_system_admin`  |     ✅      |      ❌      |    ❌     |    ❌     |   ❌   |
| `system:suspend_user`         |     ✅      |      ✅      |    ❌     |    ❌     |   ❌   |
| `system:unsuspend_user`       |     ✅      |      ✅      |    ❌     |    ❌     |   ❌   |
| `system:view_all_orgs`        |     ✅      |      ✅      |    ❌     |    ❌     |   ❌   |

#### Organization Actions

Org actions require an organization context. Super Admin and System Admin operate across all orgs; Org Admins are scoped to their own organization.

| Action                   | Super Admin | System Admin | Org Owner | Org Admin | Team Lead | Member |
| ------------------------ | :---------: | :----------: | :-------: | :-------: | :-------: | :----: |
| `org:create`             |     ✅      |      ✅      |    ❌     |    ❌     |    ❌     |   ❌   |
| `org:read`               |     ✅      |      ✅      |    ✅     |    ✅     |   ✅\*    |  ✅\*  |
| `org:update`             |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `org:delete`             |     ✅      |      ✅      |    ✅     |    ❌     |    ❌     |   ❌   |
| `org:invite_member`      |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `org:remove_member`      |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `org:promote_to_admin`   |     ✅      |      ✅      |    ✅     |    ❌     |    ❌     |   ❌   |
| `org:demote_admin`       |     ✅      |      ✅      |    ✅     |    ❌     |    ❌     |   ❌   |
| `org:transfer_ownership` |     ✅      |      ✅      |    ✅     |    ❌     |    ❌     |   ❌   |
| `org:promote_team_lead`  |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `org:demote_team_lead`   |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |

\* Team Leads and Members can only read orgs they belong to.

#### Team Actions

| Action                      | Super Admin | System Admin | Org Owner | Org Admin | Team Lead | Member |
| --------------------------- | :---------: | :----------: | :-------: | :-------: | :-------: | :----: |
| `team:create`               |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `team:read`                 |     ✅      |      ✅      |    ✅     |    ✅     |    ✅     |  ✅\*  |
| `team:update`               |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:delete`               |     ✅      |      ✅      |    ✅     |    ✅     |    ❌     |   ❌   |
| `team:invite_member`        |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:remove_member`        |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:view_join_requests`   |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:approve_join_request` |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:reject_join_request`  |     ✅      |      ✅      |    ✅     |    ✅     |  ✅\*\*   |   ❌   |
| `team:self_demote_lead`     |     ❌      |      ❌      |    ❌     |    ❌     |  ✅\*\*   |   ❌   |

\* Members can only read teams they belong to.
\*\* Team Leads can only perform these actions on their own team(s).

#### Retro Actions

| Action              | Super Admin | System Admin | Org Admin (any) | Team Lead |    Member    |
| ------------------- | :---------: | :----------: | :-------------: | :-------: | :----------: |
| `retro:create`      |     ✅      |      ✅      |       ✅        |    ✅     |      ✅      |
| `retro:read`        |     ✅      |      ✅      |       ✅        |    ✅     |      ✅      |
| `retro:update`      |     ✅      |      ✅      |       ✅        |    ✅     | Creator only |
| `retro:start`       |     ✅      |      ✅      |       ✅        |    ✅     | Creator only |
| `retro:end`         |     ✅      |      ✅      |       ✅        |    ✅     | Creator only |
| `retro:delete`      |     ✅      |      ✅      |       ✅        |    ✅     | Creator only |
| `retro:participate` |     ✅      |      ✅      |       ✅        |    ✅     |      ✅      |

---

### Role Transition Rules

| Transition                           | Who Can Perform                                      |
| ------------------------------------ | ---------------------------------------------------- |
| Promote user → `system-admin`        | Super Admin only                                     |
| Demote `system-admin` → `member`     | Super Admin only                                     |
| Promote member → `org-admin` (owner) | System Admin, Org Owner                              |
| Promote member → `org-admin` (admin) | System Admin, Org Owner                              |
| Demote `org-admin` → `member`        | Super Admin, System Admin, Org Owner                 |
| Promote member → `team-lead`         | System Admin, Org Owner, Org Admin                   |
| Demote `team-lead` → `member`        | System Admin, Org Owner, Org Admin, Team Lead (self) |

---

### Implementation

The RBAC system is implemented in `src/lib/rbac.ts` and provides:

- **Type-safe context objects**: `UserContext`, `OrgContext`, `TeamContext`
- **Role guards**: `isSuperAdmin()`, `isSystemAdmin()`, `isOrgAdmin()`, `isOrgOwner()`, `isTeamLead()`
- **Permission matrix**: `canPerformSystemAction()`, `canPerformOrgAction()`, `canPerformTeamAction()`, `canPerformRetroAction()`
- **Context builders**: `getOrgContext()`, `getTeamContext()` for resolving org/team membership and role
- **Helper utilities**: `assertPermission()` for throwing on unauthorized access

```typescript
// User role type
type UserRole =
  | 'super-admin'
  | 'system-admin'
  | 'org-admin'
  | 'team-lead'
  | 'member';

// Org role type (from Better Auth organization plugin)
type OrgRole = 'owner' | 'admin' | 'member';

// Example: checking a system-level action
assertPermission(
  isSuperAdmin(user),
  'Only super-admin can perform this action',
);

// Example: checking an org-scoped action
const orgCtx = await getOrgContext(user, organizationId);
assertPermission(
  canPerformOrgAction(orgCtx, 'org:delete'),
  'Permission denied',
);

// Example: checking a team-scoped action
const teamCtx = await getTeamContext(user, teamId);
assertPermission(
  canPerformTeamAction(teamCtx, 'team:invite_member'),
  'Permission denied',
);
```

---

### Member Visibility Rules

| Viewer Role     | Can See Organizations    | Can See Teams         | Can See Members         |
| --------------- | ------------------------ | --------------------- | ----------------------- |
| Super Admin     | ✅ All orgs              | ✅ All teams          | ✅ All members          |
| System Admin    | ✅ All orgs              | ✅ All teams          | ✅ All members          |
| Org Owner/Admin | ✅ Their org only        | ✅ Teams in their org | ✅ Members in their org |
| Team Lead       | ✅ Their org (read-only) | ✅ Their team only    | ✅ Their team members   |
| Member          | ✅ Their org (read-only) | ✅ Their team only    | ✅ Their team members   |
| Non-Member      | ❌ Hidden                | ❌ Hidden             | ❌ Hidden               |

---

### Test Users (Dev Seed)

All seeded users share the password: **`password`**

#### System-Level Users

| Email               | Name        | Role           | Status   |
| ------------------- | ----------- | -------------- | -------- |
| `admin@example.com` | Super Admin | `super-admin`  | Approved |
| `alice@example.com` | Alice Admin | `system-admin` | Approved |
| `bob@example.com`   | Bob Admin   | `system-admin` | Approved |

#### Organization & Team Users

| Email                 | Name            | Role        | Status   | Notes                                   |
| --------------------- | --------------- | ----------- | -------- | --------------------------------------- |
| `charlie@example.com` | Charlie Member  | `org-admin` | Approved | Acme Corp owner, Backend Team member    |
| `diana@example.com`   | Diana Developer | `org-admin` | Approved | Acme Corp org admin, Frontend Team lead |
| `frank@example.com`   | Frank Frontend  | `org-admin` | Approved | TechCo Inc owner, Mobile Team lead      |
| `grace@example.com`   | Grace Backend   | `team-lead` | Approved | Backend Team lead                       |
| `eve@example.com`     | Eve Engineer    | `member`    | Approved | Frontend Team member                    |
| `liam@example.com`    | Liam Frontend   | `member`    | Approved | Frontend Team member                    |
| `mia@example.com`     | Mia Frontend    | `member`    | Approved | Frontend Team member                    |
| `peter@example.com`   | Peter Backend   | `member`    | Approved | Backend Team member                     |
| `quinn@example.com`   | Quinn Backend   | `member`    | Approved | Backend Team member                     |
| `tom@example.com`     | Tom Mobile      | `member`    | Approved | Mobile Team member                      |
| `uma@example.com`     | Uma Mobile      | `member`    | Approved | Mobile Team member                      |

#### Pending Users

| Email               | Name          | Role     | Status  |
| ------------------- | ------------- | -------- | ------- |
| `henry@example.com` | Henry Pending | `member` | Pending |
| `ivy@example.com`   | Ivy Pending   | `member` | Pending |

#### Suspended Users

| Email                | Name             | Role     | Status    | Team          |
| -------------------- | ---------------- | -------- | --------- | ------------- |
| `noah@example.com`   | Noah Suspended   | `member` | Suspended | Frontend Team |
| `olivia@example.com` | Olivia Suspended | `member` | Suspended | Frontend Team |
| `ryan@example.com`   | Ryan Suspended   | `member` | Suspended | Backend Team  |
| `sophie@example.com` | Sophie Suspended | `member` | Suspended | Backend Team  |
| `victor@example.com` | Victor Suspended | `member` | Suspended | Mobile Team   |
| `wendy@example.com`  | Wendy Suspended  | `member` | Suspended | Mobile Team   |
| `jack@example.com`   | Jack Suspended   | `member` | Suspended | (none)        |

#### Organization & Team Structure

```text
Acme Corporation (owner: Charlie)
├── org admin: Diana
├── Frontend Team (lead: Diana)
│   ├── Eve Engineer        [member, approved]
│   ├── Liam Frontend       [member, approved]
│   ├── Mia Frontend        [member, approved]
│   ├── Noah Suspended      [member, suspended]
│   └── Olivia Suspended    [member, suspended]
└── Backend Team (lead: Grace)
    ├── Charlie Member      [member, approved]
    ├── Peter Backend       [member, approved]
    ├── Quinn Backend       [member, approved]
    ├── Ryan Suspended      [member, suspended]
    └── Sophie Suspended    [member, suspended]

TechCo Inc (owner: Frank)
└── Mobile Team (lead: Frank)
    ├── Diana Developer     [member, approved]
    ├── Tom Mobile          [member, approved]
    ├── Uma Mobile          [member, approved]
    ├── Victor Suspended    [member, suspended]
    └── Wendy Suspended     [member, suspended]
```
