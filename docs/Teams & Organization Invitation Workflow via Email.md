# Teams & Organization Invitation Workflow via Email

> Technical reference showing the complete invitation flow with file paths and code excerpts.

---

## High-Level Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INVITATION LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  +-----------+         +-----------+         +-------------+       +-----------+
  |  Admin    |-invite->|  Email    |-click-->|  Accept     |-done->|  Member   |
  |  Panel    |         |  Inbox    |         |  Invite     |       |  of Org   |
  +-----------+         +-----------+         |  Page       |       |  / Team   |
                                              +-------------+       +-----------+
                                                  │
                                    ┌─────────────┴────────────┐
                                    │                          │
                              ┌─────v─────┐             ┌──────v──────┐
                              │ EXISTING  │             │ NEW USER    │
                              │ USER      │             │ (no account)│
                              └─────┬─────┘             └──────┬──────┘
                                    │                          │
                              ┌─────v─────┐             ┌──────v──────┐
                              │ Sign In & │             │ Create Acct │
                              │ Accept    │             │ & Accept    │
                              └─────┬─────┘             └──────┬──────┘
                                    │                          │
                                    │                    ┌─────┴─────┐
                                    │                    │           │
                                    │              ┌─────v───┐  ┌────v─────┐
                                    │              │ Email + │  │ Microsoft│
                                    │              │Password │  │ OAuth    │
                                    │              └─────┬───┘  └────┬─────┘
                                    │                    │           │
                                    └───────┬────────────┴───────────┘
                                            │
                                    ┌───────v────────┐
                                    │ Accept Invite  │
                                    │ (Click button) │
                                    └───────┬────────┘
                                            │
                                    ┌───────v─────────┐
                                    │ * User added    │
                                    │ * Status→Active │
                                    │ * Email verified│
                                    │ * Redirect to   │
                                    │   team/org page │
                                    └─────────────────┘
```

---

## Detailed Flow: Team Invitation

```text
 ┌───────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Admin sends invite from /teams/$teamId                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  UI Button Click                                                           │
│  └─> POST /api/teams/:teamId/invite  { email, tag }                        │
│       │                                                                    │
│       ├─ FILE: retro-tool-api/src/teams/invitations/invitations.service.ts │
│       │  METHOD: inviteToTeam()                                            │
│       │                                                                    │
│       ├─ Creates teamInvitation record:                                    │
│       │    { token: UUID, email, teamId, tag, expiresAt: +3 days }         │
│       │                                                                    │
│       └─ Sends email via EmailService                                      │
│          ├─ Existing user → buildTeamInviteHtml()                          │
│          └─ New user      → buildTeamExternalInviteHtml()                  │
│                                                                            │
│  FILE: retro-tool-api/src/email/email.service.ts                           │
│  Link in email: {appUrl}/auth/accept-invite?token={token}&email={email}    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User clicks email link → Accept Invite Page                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ROUTE: /auth/accept-invite?token=UUID                                     │
│  FILE:  retro-tool-ui/src/routes/auth/accept-invite.tsx                    │
│                                                                            │
│  ┌─ Calls GET /api/invitations/preview/:token (public endpoint)            │
│  │  FILE: retro-tool-api/src/invitations/invitations.controller.ts         │
│  │  FILE: retro-tool-api/src/invitations/invitations.service.ts            │
│  │                                                                         │
│  │  Returns InvitationPreview:                                             │
│  │    { type, orgName, teamName, role, invitedEmail,                       │
│  │      expired, accepted, isExistingUser }                                │
│  │                                                                         │
│  └─ UI renders based on state:                                             │
│       │                                                                    │
│       ├── expired: true        → "Invitation Expired" message              │
│       ├── accepted: true       → "Already Accepted" + go to team           │
│       ├── !authenticated       → NotAuthenticatedView (see Step 3)         │
│       ├── email mismatch       → "Wrong Account Signed In" (see Step 2B)   │
│       └── email matches        → "Accept Invitation" button (Step 5)       │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 2B: Wrong Account Signed In — Email Mismatch                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  FILE: retro-tool-ui/src/routes/auth/accept-invite.tsx                     │
│  COMPONENT: EmailMismatchView                                              │
│                                                                            │
│  Shown when: user is authenticated but session email != invited email       │
│                                                                            │
│  Displays:                                                                 │
│    - "Wrong Account Signed In" heading                                     │
│    - Signed in as: {currentEmail}                                          │
│    - Invited: {invitedEmail}                                               │
│                                                                            │
│  Actions:                                                                  │
│  ┌─── [Sign Out & Continue] (primary, emerald) ───────────────────┐       │
│  │                                                                 │       │
│  │  1. Calls authClient.signOut()                                  │       │
│  │  2. Session clears, page re-renders as unauthenticated          │       │
│  │  3. Shows NotAuthenticatedView (Step 3) on same page            │       │
│  │     (token stays in URL, no navigation needed)                  │       │
│  │                                                                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│  ┌─── [Cancel] (outline) ─────────────────────────────────────────┐       │
│  │                                                                 │       │
│  │  Navigates to /auth/sign-in (login page)                        │       │
│  │                                                                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                            │
│  Code (accept-invite.tsx):                                                 │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ const handleSwitchAccount = async () => {               │               │
│  │   setSigningOut(true)                                   │               │
│  │   try {                                                 │               │
│  │     await authClient.signOut()                          │               │
│  │   } catch (err) {                                       │               │
│  │     toast.error(err.message || 'Failed to sign out')    │               │
│  │   } finally {                                           │               │
│  │     setSigningOut(false)                                │               │
│  │   }                                                     │               │
│  │ }                                                       │               │
│  └─────────────────────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Not Authenticated — Choose path                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  FILE: retro-tool-ui/src/routes/auth/accept-invite.tsx                     │
│  COMPONENT: NotAuthenticatedView                                           │
│                                                                            │
│  ┌─── isExistingUser: true ───────────────────────────────────────┐        │
│  │                                                                │        │
│  │  Shows: "We found your account"                                │        │
│  │  Primary:   [Sign In & Accept]  →  /auth/sign-in               │        │
│  │  Secondary: [Create a new account] → /auth/sign-up             │        │
│  │                                                                │        │
│  │  Both pass: ?inviteToken={token}&email={invitedEmail}          │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                            │
│  ┌─── isExistingUser: false ──────────────────────────────────────┐        │
│  │                                                                │        │
│  │  Shows: "You're new here"                                      │        │
│  │  Primary:   [Create Account & Accept] → /auth/sign-up          │        │
│  │  Secondary: [I already have an account] → /auth/sign-in        │        │
│  │                                                                │        │
│  │  Both pass: ?inviteToken={token}&email={invitedEmail}          │        │
│  └────────────────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 4A: New User — Create Account (Email + Password)                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ROUTE: /auth/sign-up?inviteToken=TOKEN&email=EMAIL                        │
│  FILE:  retro-tool-ui/src/routes/auth/sign-up.tsx                          │
│                                                                            │
│  ┌─ Email field: pre-filled + LOCKED (not editable)                        │
│  ├─ User enters: name + password                                           │
│  ├─ Banner: "Fill in your name and password below,                         │
│  │           or use Sign up with Microsoft at the bottom."                 │
│  │                                                                         │
│  └─ On success → redirect to /auth/accept-invite?token=TOKEN               │
│                                                                            │
│  Code (sign-up.tsx):                                                       │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │ if (inviteToken) {                                      │               │
│  │   navigate({                                            │               │
│  │     to: '/auth/accept-invite',                          │               │
│  │     search: { token: inviteToken }                      │               │
│  │   })                                                    │               │
│  │   return                                                │               │
│  │ }                                                       │               │
│  └─────────────────────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 4B: New User — Sign Up with Microsoft OAuth                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  FILE: retro-tool-ui/src/routes/auth/sign-up.tsx                           │
│  FILE: retro-tool-ui/src/routes/auth/social-callback.tsx                   │
│                                                                            │
│  ┌─ User clicks "Sign up with Microsoft"                                   │
│  ├─ OAuth flow completes                                                   │
│  ├─ Callback checks for inviteToken in search params                       │
│  └─ If present → redirect to /auth/accept-invite?token=TOKEN               │
│                                                                            │
│  NOTE: Microsoft may normalize email to lowercase.                         │
│  Email comparison is case-insensitive (fixed with .toLowerCase())          │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 4C: Existing User — Sign In                                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ROUTE: /auth/sign-in?inviteToken=TOKEN&email=EMAIL                        │
│  FILE:  retro-tool-ui/src/routes/auth/sign-in.tsx                          │
│                                                                            │
│  ┌─ User signs in with credentials or Microsoft OAuth                      │
│  └─ On success → redirect to /auth/accept-invite?token=TOKEN               │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Accept Invitation (authenticated + email matches)                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  UI: User clicks "Accept Invitation" button                                │
│  └─> POST /api/invitations/:token/accept                                   │
│                                                                            │
│  FILE: retro-tool-api/src/invitations/invitations.controller.ts            │
│  FILE: retro-tool-api/src/invitations/invitations.service.ts               │
│  FILE: retro-tool-api/src/teams/invitations/invitations.service.ts         │
│  METHOD: acceptTeamInvitation(token, userId)                               │
│                                                                            │
│  Backend performs (in order):                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 1. Validate: token exists, not expired, not already accepted    │       │
│  │ 2. Email check: user.email.toLowerCase() ===                    │       │
│  │                  invitation.email.toLowerCase()                 │       │
│  │ 3. User status: Pending → Approved (approvedAt, approvedById)   │       │
│  │ 4. Mark emailVerified: true                                     │       │
│  │ 5. Add to org (if not already member) with role: 'member'       │       │
│  │ 6. Add to team with tag from invitation                         │       │
│  │ 7. Mark invitation acceptedAt: new Date()                       │       │
│  │ 8. Send notification (async)                                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                            │
│  Returns: { type: 'team', organizationId, teamId }                         │
│  UI redirects to: /teams/$teamId                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow: Organization Invitation

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Org Invitation — Differences from Team flow                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Trigger: Admin clicks "Invite" on /organizations/$orgId                   │
│  └─> POST /api/organizations/:orgId/invite  { email, role }                │
│                                                                            │
│  FILE: retro-tool-api/src/organizations/invitations/invitations.service.ts │
│  METHOD: inviteToOrg()                                                     │
│                                                                            │
│  Creates orgInvitation record:                                             │
│    { token: UUID, email, organizationId, role, expiresAt: +3 days }        │
│                                                                            │
│  Email templates:                                                          │
│    ├─ Existing user → buildOrgInviteHtml()                                 │
│    └─ New user      → buildOrgExternalInviteHtml()                         │
│                                                                            │
│  Acceptance (Step 5 equivalent):                                           │
│  FILE: retro-tool-api/src/organizations/invitations/invitations.service.ts │
│  METHOD: acceptOrgInvitation(token, userId)                                │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 1. Validate: token exists, not expired, not already accepted    │       │
│  │ 2. Email check (case-insensitive)                               │       │
│  │ 3. User status: Pending → Approved                              │       │
│  │ 4. Mark emailVerified: true                                     │       │
│  │ 5. Add to org with role from invitation                         │       │
│  │ 6. Mark invitation acceptedAt                                   │       │
│  │ 7. Send notification (async)                                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                            │
│  Returns: { type: 'org', organizationId }                                  │
│  UI redirects to: /organizations/$orgId                                    │
│                                                                            │
│  KEY DIFFERENCE: No team membership created, only org membership.          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Code Deep Dive

### Unified Router — Determines Invite Type

```typescript
// FILE: retro-tool-api/src/invitations/invitations.service.ts

async accept(token: string, userId: string) {
  let preview = await this.getPreview(token);

  if (preview.type === 'org') {
    const result = await this.orgInvitations.acceptOrgInvitation(token, userId);
    return { type: 'org', organizationId: result.organizationId };
  }

  const result = await this.teamInvitations.acceptTeamInvitation(token, userId);
  return { type: 'team', organizationId: result.organizationId, teamId: result.teamId };
}
```

### Team Acceptance — Full Logic

```typescript
// FILE: retro-tool-api/src/teams/invitations/invitations.service.ts
// METHOD: acceptTeamInvitation()

// 1. Validate invitation
const [invitation] = await this.database
  .select().from(teamSchema.teamInvitation)
  .where(eq(teamSchema.teamInvitation.token, token)).limit(1);

if (!invitation) throw new NotFoundException('Invitation not found');
if (invitation.acceptedAt) throw new ConflictException('Already accepted');
if (invitation.expiresAt < new Date()) throw new ForbiddenException('Expired');

// 2. Case-insensitive email verification
const [user] = await this.database
  .select({ email: userSchema.user.email })
  .from(userSchema.user)
  .where(eq(userSchema.user.id, userId)).limit(1);

if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
  throw new ForbiddenException('This invitation was sent to a different email address');
}

// 3. Approve user (Pending → Approved)
await this.database.update(userSchema.user).set({
  status: USER_STATUSES.Approved,
  approvedAt: new Date(),
  approvedById: invitation.createdById,
}).where(and(
  eq(userSchema.user.id, userId),
  eq(userSchema.user.status, USER_STATUSES.Pending),
));

// 4. Mark email as verified
await this.database.update(userSchema.user)
  .set({ emailVerified: true })
  .where(eq(userSchema.user.id, userId));

// 5. Add to org (if not already a member)
if (!existingOrgMember) {
  await this.database.insert(orgSchema.organizationMember).values({
    id: generateId(), organizationId: team.organizationId,
    userId, role: ORG_MEMBER_ROLES.Member,
  });
}

// 6. Add to team (if not already a member)
if (!existingTeamMember) {
  await this.database.insert(teamSchema.teamMember).values({
    id: generateId(), teamId: invitation.teamId,
    userId, tag: invitation.tag,
  });
}

// 7. Mark invitation as accepted
await this.database.update(teamSchema.teamInvitation)
  .set({ acceptedAt: new Date() })
  .where(eq(teamSchema.teamInvitation.token, token));
```

### Frontend — Accept Invite Decision Tree

```typescript
// FILE: retro-tool-ui/src/routes/auth/accept-invite.tsx

// After fetching preview from GET /api/invitations/preview/:token
const preview = previewQuery.data!

if (preview.expired)       → render "Invitation Expired"
if (preview.accepted)      → render "Already Accepted" + link to team/org
if (!isAuthenticated)      → render NotAuthenticatedView (sign-in or sign-up)
if (emailMismatch)         → render "Wrong Account Signed In"
else                       → render "Accept Invitation" button
```

### Email Templates

```typescript
// FILE: retro-tool-api/src/email/email.service.ts

// Team invite — existing user (knows their name)
buildTeamInviteHtml({ userName, invitedEmail, orgName, teamName, tag, appUrl, token })
// → "Hi {name}, you've been invited to join team {teamName} in {orgName}"

// Team invite — new user (no account yet)
buildTeamExternalInviteHtml({ orgName, teamName, tag, appUrl, token, invitedEmail })
// → "You've been invited to join team {teamName} in {orgName} on Retro Tool"

// Org invite — existing user
buildOrgInviteHtml({ userName, invitedEmail, orgName, role, appUrl, token })
// → "Hi {name}, you've been invited to join {orgName}"

// Org invite — new user
buildOrgExternalInviteHtml({ orgName, role, appUrl, token, invitedEmail })
// → "You've been invited to join {orgName} on Retro Tool"

// All emails include:
// - Accept link: {appUrl}/auth/accept-invite?token={token}&email={email}
// - Expiration notice: "This link expires in 3 days"
// - Instructions differ for existing vs new users
```

---

## File Reference Map

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (NestJS)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Unified Router (public preview + authenticated accept)                 │
│  ├── src/invitations/invitations.controller.ts                          │
│  │     GET  /api/invitations/preview/:token  (public)                   │
│  │     POST /api/invitations/:token/accept   (auth required)            │
│  └── src/invitations/invitations.service.ts                             │
│        Routes to org or team based on token lookup                      │
│                                                                         │
│  Organization Invitations                                               │
│  ├── src/organizations/invitations/invitations.controller.ts            │
│  │     POST /api/organizations/:id/invite                               │
│  │     GET  /api/organizations/:id/invitations  (list/pagination)       │
│  │     DELETE /api/organizations/:id/invitations/:invId  (revoke)       │
│  │     POST /api/organizations/:id/invitations/:invId/resend            │
│  └── src/organizations/invitations/invitations.service.ts               │
│        inviteToOrg(), acceptOrgInvitation(), getOrgInvitationPreview()  │
│        listInvitations(), revokeInvitation(), resendInvitation()        │
│                                                                         │
│  Team Invitations                                                       │
│  ├── src/teams/invitations/invitations.controller.ts                    │
│  │     POST /api/teams/:id/invite                                       │
│  │     GET  /api/teams/:id/invitations  (list/pagination)               │
│  │     DELETE /api/teams/:id/invitations/:invId  (revoke)               │
│  │     POST /api/teams/:id/invitations/:invId/resend                    │
│  └── src/teams/invitations/invitations.service.ts                       │
│        inviteToTeam(), acceptTeamInvitation(), getTeamInvitationPreview()│
│        listInvitations(), revokeInvitation(), resendInvitation()         │
│                                                                         │
│  Email                                                                  │
│  └── src/email/email.service.ts                                         │
│        buildTeamInviteHtml(), buildTeamExternalInviteHtml()             │
│        buildOrgInviteHtml(), buildOrgExternalInviteHtml()               │
│                                                                         │
│  Auth (verification email suppression for invited users)                │
│  └── src/auth/auth.config.ts  (lines 117-141)                           │
│        Skips verification email if pending invitation exists            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                          FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Accept Invite Page                                                     │
│  └── src/routes/auth/accept-invite.tsx                                  │
│        Preview fetch, state machine, accept mutation, redirects         │
│                                                                         │
│  Sign-Up (with invite mode)                                             │
│  └── src/routes/auth/sign-up.tsx                                        │
│        Pre-fills email (locked), redirects to accept-invite on success  │
│                                                                         │
│  Sign-In (with invite mode)                                             │
│  └── src/routes/auth/sign-in.tsx                                        │
│        Passes inviteToken through, redirects to accept-invite           │
│                                                                         │
│  OAuth Callback                                                         │
│  └── src/routes/auth/social-callback.tsx                                │
│        Checks for inviteToken, redirects to accept-invite               │
│                                                                         │
│  API Endpoints                                                          │
│  └── src/lib/api-endpoints.ts                                           │
│        INVITATIONS_ENDPOINTS.PREVIEW(token)                             │
│        INVITATIONS_ENDPOINTS.ACCEPT(token)                              │
│        ORGANIZATIONS_ENDPOINTS.INVITE(orgId)                            │
│        TEAMS_ENDPOINTS.INVITE(teamId)                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

```text
┌───────────────────────────────────────────────────────────────────────┐
│                     USER STATUS LIFECYCLE                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  New Sign-Up (no invite):                                             │
│    [Created] → email verify → [Pending] → admin approves → [Approved] │
│                                                                       │
│  New Sign-Up (with invite):                                           │
│    [Created] → [Pending] → accept invite → [Approved] *               │
│                            (skips email verify + admin approval)      │
│                                                                       │
│  Existing User (with invite):                                         │
│    [Approved] → accept invite → added to org/team (no status change)  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                     INVITATION RECORD STATE                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [Created]                                                            │
│    acceptedAt: NULL                                                   │
│    expiresAt: createdAt + 3 days                                      │
│                                                                       │
│  [Pending] (expiresAt > now, acceptedAt = NULL)                       │
│    → User can accept                                                  │
│    → Admin can resend (new token + reset expiry)                      │
│    → Admin can revoke (delete record)                                 │
│                                                                       │
│  [Expired] (expiresAt < now, acceptedAt = NULL)                       │
│    → User cannot accept (403 Forbidden)                               │
│    → Admin can resend (new token + reset expiry)                      │
│    → Admin can revoke                                                 │
│                                                                       │
│  [Accepted] (acceptedAt != NULL)                                      │
│    → Terminal state                                                   │
│    → Removed from pending invitations tracker table                   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Organization Invitation
CREATE TABLE org_invitation (
  id          UUID PRIMARY KEY,
  token       UUID UNIQUE NOT NULL,         -- used in email link
  email       TEXT NOT NULL,                 -- invited email address
  organization_id UUID REFERENCES organization(id),
  role        TEXT NOT NULL,                 -- 'member', 'org-admin', 'org-owner'
  created_by_id UUID REFERENCES user(id),   -- who sent the invite
  expires_at  TIMESTAMP NOT NULL,           -- created_at + 3 days
  accepted_at TIMESTAMP,                    -- NULL until accepted
  created_at  TIMESTAMP DEFAULT now()
);

-- Team Invitation
CREATE TABLE team_invitation (
  id          UUID PRIMARY KEY,
  token       UUID UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  team_id     UUID REFERENCES team(id),
  tag         TEXT NOT NULL,                 -- 'member', 'team-lead'
  created_by_id UUID REFERENCES user(id),
  expires_at  TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT now()
);
```

---

## Important Notes

1. **Email comparison is case-insensitive** — uses `.toLowerCase()` on both sides to handle OAuth providers normalizing emails.
2. **Accepting an invite auto-approves the user** — no admin approval step needed when joining via invitation.
3. **Accepting marks email as verified** — because clicking the token link proves mailbox ownership.
4. **Team invite adds to both org AND team** — user gets `member` role in org + invitation tag in team.
5. **Org invite adds to org only** — no team membership created.
6. **Verification email is suppressed** if user has a pending invitation — handled in `auth.config.ts`.
