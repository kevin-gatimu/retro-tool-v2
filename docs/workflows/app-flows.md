# App Flows

Reference for every major user-facing flow — what triggers it, what the frontend does, what the backend does, what state changes, and known edge cases.

---

## Table of Contents

1. [Auth Flows](#1-auth-flows)
   - [Email/Password Sign-Up](#11-emailpassword-sign-up)
   - [OAuth Sign-Up (Microsoft)](#12-oauth-sign-up-microsoft)
   - [Email/Password Sign-In](#13-emailpassword-sign-in)
   - [OAuth Sign-In](#14-oauth-sign-in)
   - [Email Verification](#15-email-verification)
   - [Password Reset](#16-password-reset)
   - [Sign-Out](#17-sign-out)
2. [User Approval Flow](#2-user-approval-flow)
3. [Organization Flows](#3-organization-flows)
4. [Team Flows](#4-team-flows)
5. [Retro Flows](#5-retro-flows)
6. [Story Estimate Flows](#6-story-estimate-flows)
7. [Icebreaker Flows](#7-icebreaker-flows)
8. [Notifications](#8-notifications)

---

## 1. Auth Flows

### 1.1 Email/Password Sign-Up

**Trigger:** User submits the form at `/auth/sign-up`.

**Frontend steps:**

1. On page load: `GET /api/users/admin/exists` — checks whether any admin exists. If none, shows "First user — you'll become admin" banner.
2. User fills name, email, password → submits.
3. `authClient.signUp.email({ name, email, password })` — Better Auth creates user + session, sets cookie.
4. If `adminExists === false`: calls `POST /api/users/admin/bootstrap`.
   - Success → user is now `super-admin` + `approved`. Show "Welcome, Admin!" screen, redirect to `/dashboard`.
   - Failure (race condition, another user bootstrapped first) → caught silently, treat as normal pending user.
5. If `adminExists === true`: show "Account Pending Approval" screen, redirect to `/auth/sign-in`.

**Backend — `POST /api/users/admin/bootstrap`:**

1. Calls `checkAdminExists()` — queries for any `super-admin` or `system-admin` row.
2. If admin exists → `400 BadRequest` (endpoint is idempotent by design).
3. If no admin exists → updates the session user:
   - `role = 'super-admin'`
   - `status = 'approved'`
   - `emailVerified = true`
   - `approvedAt = now()`

**State after:**

| Field | First user | Subsequent users |
|---|---|---|
| `role` | `super-admin` | `member` |
| `status` | `approved` | `pending` |
| `emailVerified` | `true` | `false` (until verified) |

**Edge cases:**

- Two users sign up simultaneously before any admin exists — only one bootstrap call will succeed; the other gets `400` and is treated as pending.
- User closes tab after sign-up but before bootstrap call — user stays `pending`. They must ask an admin to approve or retry sign-in (which re-triggers the UI check).

---

### 1.2 OAuth Sign-Up (Microsoft)

**Trigger:** User clicks "Sign up with Microsoft" on `/auth/sign-up`.

**Frontend steps:**

1. `authClient.signIn.social({ provider: 'microsoft', callbackURL: '/auth/social-callback?inviteToken=...' })` — the `inviteToken` query param is included when the user arrived from an invitation link.
2. Browser redirects to OAuth provider. User authenticates.
3. Provider redirects back. Better Auth exchanges code for tokens, creates user + session (if new user), sets cookie.
4. Browser lands on `/auth/social-callback` (with `?inviteToken=...` preserved if present).
5. Social callback page:
   a. `GET /api/users/me` — fetch current user.
   b. `POST /api/users/admin/bootstrap` — attempt bootstrap.
      - **Success** → first user, now `super-admin` + `approved`. Navigate to `/dashboard`.
      - **Failure (400)** → admin already exists. Fall through.
   c. If `inviteToken` is present → navigate to `/auth/accept-invite?token={inviteToken}` (invitation acceptance auto-approves pending users).
   d. Check `user.status`:
      - `pending` → `signOutWithCleanup()`, navigate to `/auth/sign-in?status=pending`.
      - `rejected` → `signOutWithCleanup()`, navigate to `/auth/sign-in?status=rejected`.
      - `approved` → navigate to `/dashboard`.

**Backend — Better Auth OAuth handling:**

- Microsoft is a `trustedProvider` — email is marked `emailVerified = true` automatically.
- New user is created with `role = 'member'`, `status = 'pending'`.
- Account linking is enabled: if the email already exists from another provider, the new account is linked instead of creating a duplicate.

**State after:**

Same as email/password sign-up — first user becomes `super-admin` + `approved`; all others stay `pending`.

**Edge cases:**

- Existing email from another provider → accounts are linked (not duplicated).
- User denies OAuth consent → redirect back with error, no user created.
- OAuth provider unreachable → Better Auth returns error, user sees sign-in error.

---

### 1.3 Email/Password Sign-In

**Trigger:** User submits the form at `/auth/sign-in`.

**Frontend steps:**

1. `authClient.signIn.email({ email, password })`.
2. Wait 100 ms for cookies to be set.
3. Test if cookies work — if not (private/incognito window), fall back to bearer token stored in memory.
4. `GET /api/users/me` — fetch user to check status.
5. Route based on `user.status`:
   - `pending` → `signOutWithCleanup()`, redirect to `/auth/sign-in?status=pending`.
   - `rejected` → `signOutWithCleanup()`, redirect to `/auth/sign-in?status=rejected`.
   - `suspended` → `signOutWithCleanup()`, redirect to `/auth/sign-in?status=suspended`.
   - `approved` → invalidate React Query cache, redirect to `/dashboard`.

**Backend:**

- `POST /auth/sign-in/email`: Better Auth verifies password hash (bcrypt), creates session, sets HTTP-only secure cookie.
- Status check happens in the frontend via `GET /api/users/me` — the API does not block sign-in itself at the Better Auth layer.

**Edge cases:**

- Wrong password → Better Auth returns `401`, UI shows "Invalid credentials".
- Account doesn't exist → same 401 (no email enumeration).
- Session cookie blocked (private window) → bearer token fallback activates. Token lives in memory only — lost on page refresh.

---

### 1.4 OAuth Sign-In

**Trigger:** User clicks "Sign in with Microsoft" on `/auth/sign-in` (existing account).

**Flow:** Identical to [1.2 OAuth Sign-Up](#12-oauth-sign-up-microsoft). Better Auth detects the existing user by email + provider and creates a new session instead of a new user. If the user originally signed up with email/password, the Microsoft account is automatically linked (same user, new `account` row) because Microsoft is a `trustedProvider`.

**Invitation-aware:** When the sign-in page carries an `inviteToken` (the user arrived from an invitation link), the OAuth `callbackURL` includes it as a query param. After OAuth completes, the social callback redirects to `/auth/accept-invite?token={inviteToken}` instead of the dashboard.

---

### 1.5 Email Verification

**Trigger:** Automatic — fired on email/password sign-up.

**Flow:**

1. Better Auth calls `sendVerificationEmail` hook after sign-up.
2. Resend sends email with link: `{FRONTEND_URL}/auth/verify-email?token=...`
3. User clicks link → `GET /auth/verify-email?token=...` handled by Better Auth.
4. Better Auth validates token, sets `emailVerified = true` on the user.

**Note:** OAuth sign-ups (Microsoft) skip this — `emailVerified` is set to `true` immediately as it is a trusted provider. The bootstrap flow also sets `emailVerified = true` for the first user regardless of sign-up method.

---

### 1.6 Password Reset

**Trigger:** User clicks "Forgot Password" on the sign-in page.

**Forgot password phase:**

1. User navigates to `/auth/forgot-password`, enters email.
2. `authClient.forgetPassword({ email, redirectTo: '/auth/reset-password' })`.
3. Backend generates reset token, Resend sends email with link: `{FRONTEND_URL}/auth/reset-password?token=...`.
4. UI shows "Check your email" message regardless of whether email exists (no enumeration).

**Reset password phase:**

1. User clicks link → lands on `/auth/reset-password?token=...`.
2. User enters new password.
3. `authClient.resetPassword({ token, newPassword })`.
4. Better Auth validates token, updates password hash, **invalidates all existing sessions**.
5. UI redirects to `/auth/sign-in` with success message.

**Edge cases:**

- Token expired → Better Auth returns error, UI prompts to request a new link.
- Token already used → same error (tokens are single-use).
- User deleted before reset → reset fails gracefully with error.

---

### 1.7 Sign-Out

**Trigger:** User clicks sign-out button.

**Flow:**

1. `signOutWithCleanup()` — calls `authClient.signOut()` then clears any in-memory bearer token.
2. Better Auth revokes session in DB and expires the cookie.
3. React Query cache cleared.
4. Redirect to `/auth/sign-in`.

---

## 2. User Approval Flow

**Context:** All users except the first one start with `status = 'pending'` and cannot access the app until approved.

### Pending → Approved

**Trigger:** Admin navigates to `/admin/users`, sees pending user, clicks Approve.

1. `PATCH /api/users/{userId}/status` with `{ status: 'approved' }`.
2. Backend:
   - Requires caller to be `system-admin` or `super-admin`.
   - Sets `status = 'approved'`, `approvedAt = now()`, `approvedById = adminId`.
   - Logs admin action.
   - Sends "Your account has been approved" email via Resend.
3. User can now sign in — next sign-in status check passes.

### Pending → Rejected

1. `PATCH /api/users/{userId}/status` with `{ status: 'rejected' }`.
2. Backend: sets `status = 'rejected'`, logs action. No email sent.
3. User sees "access denied" message on next sign-in attempt and is signed out.

### Bulk approval

1. Admin selects multiple users, clicks "Bulk Approve / Reject".
2. `PATCH /api/users/bulk/status` with `{ userIds: [...], status: 'approved' | 'rejected' }`.
3. Backend processes each; skips admins and self. Sends approval emails for each approved user.

### Suspend / Reactivate

- `POST /api/users/{userId}/suspend` with `{ reason? }` → sets `status = 'suspended'`.
- `POST /api/users/{userId}/reactivate` → sets `status = 'approved'`, clears suspension fields.
- `super-admin` required to suspend/reactivate another `system-admin`.

---

## 3. Organization Flows

### 3.1 Create Organization

1. User navigates to `/organizations`, clicks "New Organization".
2. Fills name (required), description (optional).
3. `POST /api/organizations` with `{ name, description }`.
4. Backend: creates org, adds caller as `owner` in `organizationMember`.
5. Redirect to org detail page.

### 3.2 Invite Member

**Trigger:** Org `owner` or `admin` clicks "Invite Member".

1. Enters user's email, selects role (`member` / `admin`).
2. `POST /api/organizations/{orgId}/invite` with `{ email, role }`.
3. Backend:
   - Validates caller is `owner` or `admin` (or `system-admin`).
   - Finds user by email — returns `404` if not found.
   - Returns `409` if user is already a member.
   - Creates `organizationMember` row.
   - Emits in-app notification to the invited user (`org_invite` type).
4. UI shows success toast. Invited user sees notification bell update.

**Edge cases:**

- Email not in system → "No user found with that email". Users must sign up first.
- User already member → "User is already a member of this organization".

### 3.3 Remove Member

1. `DELETE /api/organizations/{orgId}/members/{memberId}`.
2. Backend:
   - Validates caller is `owner` or `system-admin`.
   - Deletes `organizationMember` row.
   - Cascades: removes user from all teams within that org.
3. UI removes user from the member list.

**Edge case:** Cannot remove the last owner — backend returns `400`.

### 3.4 Change Member Role

1. Admin selects new role from dropdown.
2. `PATCH /api/organizations/{orgId}/members/{memberId}/role` with `{ role }`.
3. Backend validates caller is `owner`; updates role.

**Edge case:** Cannot downgrade self if only owner — returns `400 "Cannot remove the last owner"`.

---

## 4. Team Flows

### 4.1 Create Team

1. Org admin or system admin clicks "New Team".
2. Fills name, description, emoji, selects organization.
3. `POST /api/teams` with `{ name, description, emoji, organizationId }`.
4. Backend: creates team, adds caller as `team-lead`.
5. Redirect to team detail page.

### 4.2 Join Request

**Send request (member):**

1. Non-member visits team page, clicks "Request to Join", optionally adds message.
2. `POST /api/teams/{teamId}/join-requests` with `{ message? }`.
3. Backend: creates join request with `status = 'pending'`, notifies team leads via in-app notification.
4. Button changes to "Cancel Request".

**Review request (team lead / org admin):**

1. Lead navigates to team → "Pending Requests" tab.
2. Clicks Approve → `POST /api/teams/{teamId}/join-requests/{requestId}/approve`.
   - Backend: creates `teamMember` row, deletes join request, notifies user.
3. Clicks Reject → `POST /api/teams/{teamId}/join-requests/{requestId}/reject`.
   - Backend: deletes join request, notifies user.

**Cancel request (member):**

1. Member clicks "Cancel Request".
2. `DELETE /api/teams/{teamId}/join-requests/{requestId}`.

### 4.3 Add Member Directly

1. Lead opens "Add Member" dialog — shows searchable list of org members.
2. Selects user, selects role (`member` / `team-lead`).
3. `POST /api/teams/{teamId}/members` with `{ userId, role }`.
4. Backend: validates user is org member, not already team member, creates `teamMember`.

### 4.4 Remove Member

1. `DELETE /api/teams/{teamId}/members/{memberId}`.
2. Backend: removes `teamMember` row. User loses access to team's retros and estimates.

---

## 5. Retro Flows

### 5.1 Create Retro

1. User clicks "New Retro" → `/retros/new`.
2. Selects team, optionally selects template, enters title.
3. `POST /api/retros` with `{ teamId, templateId?, title }`.
4. Backend: creates retro with `status = 'draft'`, copies template columns if provided. Caller is creator.
5. Redirect to retro board.

### 5.2 Phase Transitions

Retros move through phases in order. Only the creator (or system admin) can advance phases. Each transition is a separate endpoint and emits a WebSocket event (`retro-status-changed`) to all connected participants.

| From | To | Endpoint | What changes |
|---|---|---|---|
| `draft` | `waiting` | `POST /{id}/lobby` | Status = `waiting`. Lobby opens — others can join. |
| `waiting` | `active` | `POST /{id}/start` | Status = `active`. Card submission opens. |
| `active` | `grouping` | `POST /{id}/grouping` | Card editing closes. Creator can merge cards. |
| `grouping` | `voting` | `POST /{id}/voting` | Merged cards revealed. Voting opens. |
| `voting` | `discussing` | `POST /{id}/discussion` | Votes locked. Cards sorted by vote count. Discussion begins. |
| `discussing` | `completed` | `POST /{id}/complete` | Retro locked. Report available. |

### 5.3 Cards

| Action | Endpoint | Restrictions | WebSocket event |
|---|---|---|---|
| Add card | `POST /retros/cards` | `active` phase only | `retro-changed` |
| Edit card | `PATCH /retros/cards/{cardId}` | Author or creator, before `voting` | `retro-changed` |
| Delete card | `DELETE /retros/cards/{cardId}` | Author or creator | `retro-changed` |
| Vote | `POST /retros/cards/{cardId}/vote` | `voting` phase, one vote per card | `retro-changed` |
| Unvote | `DELETE /retros/cards/{cardId}/vote` | `voting` phase | `retro-changed` |
| Merge | `POST /{id}/merge-cards` | `grouping` phase, creator only | `retro-changed` |
| Unmerge | `POST /{id}/cards/{cardId}/unmerge` | `grouping` phase, creator only | `retro-changed` |

**Voting toggle:** Calling vote on a card the user already voted on removes the vote (same as unvote).

**Merge:** Source card votes transfer to target. Source hidden but not deleted. `mergedFromNames` returns `[]` when anonymity is active.

### 5.4 Discussion Phase

**Set current card:**

1. Creator clicks a card to discuss.
2. `POST /{id}/cards/{cardId}/discuss`.
3. Backend: sets `retro.currentDiscussionCardId = cardId`, emits `discussion-card-changed` WebSocket event.
4. All participants see the card highlighted in real time.

**Mark discussed:**

1. Creator clicks "Done" on current card.
2. `POST /{id}/cards/{cardId}/mark-discussed`.
3. Backend: sets `card.isDiscussed = true`, `card.discussedAt = now()`.
4. Card moves to discussed list.

**Carry forward:**

1. Creator clicks "Carry Forward" on undiscussed cards before completing.
2. `POST /{id}/carry-forward` with `{ cardIds: [...] }`.
3. Backend: creates action items with `isCarriedForward = true`, links them to the current retro.
4. Carried-forward items appear as amber collapsible section in the next retro's discussion phase.

### 5.5 Complete Retro + Report

1. Creator clicks "Complete Retro".
2. `POST /{id}/complete`.
3. Backend: sets `status = 'completed'`, locks all mutations.
4. Frontend renders `RetroReport` component below the board — collapsible, shows stats, discussed/undiscussed by column, action items.
5. Report can be emailed: `POST /{id}/send-report` with `{ recipients }`.

---

## 6. Story Estimate Flows

### 6.1 Create Session

1. User clicks "New Estimate Session".
2. Fills name, optionally selects team.
3. `POST /api/estimates` with `{ name, teamId? }`.
4. Backend: creates session with `status = 'waiting'`, caller is facilitator.
5. Redirect to session page.

### 6.2 Join Session

1. User navigates to an active session, clicks "Join".
2. `POST /api/estimates/{sessionId}/join`.
3. Backend: adds user to `story_estimate_participant`. WebSocket broadcasts `session-changed` to all connected clients.

### 6.3 Vote / Unvote

**Vote:**

1. User clicks a point card (1, 2, 3, 5, 8, 13, 21, ☕, ?).
2. `POST /api/estimates/{sessionId}/votes` with `{ points }`.
3. Backend: creates or updates `story_estimate_vote` for user.
4. WebSocket: broadcasts `session-changed` — others see a dot indicating this user has voted (not the value, until revealed).

**Unvote (toggle):**

- Clicking the same card again calls `DELETE /api/estimates/{sessionId}/votes`.
- Or explicit "Clear" button.

### 6.4 Reveal Votes

1. Facilitator clicks "Reveal Votes".
2. `POST /api/estimates/{sessionId}/reveal`.
3. Backend: sets `votesRevealed = true`, calculates average / median / consensus.
4. All vote values become visible. Vote distribution shown.

### 6.5 Reset Round

1. Facilitator clicks "New Round" or "Next Story".
2. Selects / enters new ticket (e.g. `JIRA-123`).
3. `POST /api/estimates/{sessionId}/rounds/start` with `{ ticketNumber? }`.
4. Backend: increments round counter, clears all votes, resets `votesRevealed = false`.
5. All participants can vote again. Previous round saved in history.

---

## 7. Icebreaker Flows

Icebreaker sessions are **ephemeral** — they exist only while active. Ending a
session (via `DELETE /api/icebreakers/:id`) or finishing it (advancing past the
last prompt) hard-deletes the row and cascades to prompts and participants. There
is no completed-session list or history archive.

### 7.1 Create Session

1. Facilitator navigates to `/icebreakers`, clicks "New Icebreaker".
2. Selects team, template (optional), flavour filter (optional), selection mode.
3. `POST /api/icebreakers` with `{ teamId, templateId?, selectionMode, flavourFilter? }`.
4. Backend: creates session with `status = 'waiting'`, materialises the seed-ordered prompt deck in `icebreaker_session_prompt`. Enqueues Convex projection sync.
5. Redirect to session page.

### 7.2 Join Session

1. Participant navigates to the session URL.
2. `POST /api/icebreakers/:id/join`.
3. Backend: upserts a `icebreaker_participant` row (`isOnline = true`). Enqueues Convex projection sync.
4. All viewers see the updated participant list via Convex subscription.

### 7.3 Curate Deck (Facilitator)

During the `curating` phase the facilitator reviews each prompt card:

1. Facilitator decides on a card — clicks "Keep" or "Skip".
2. `POST /api/icebreakers/:id/swipe` with `{ sessionPromptId, decision: 'kept' | 'skipped' }`.
3. **Keep** → prompt is marked `kept`, session moves to `presenting`, `currentPromptId` set.
4. **Skip** → prompt is marked `skipped`, session stays in `curating`, next pending card shown.

### 7.4 Present Prompt

While `status = 'presenting'` the current prompt is visible to all participants:

- Facilitator (or anyone) can start a countdown timer: `POST /api/icebreakers/:id/timer` with `{ duration }` (seconds).
- Anyone can react with "great answer" reactions.

### 7.5 Live Reactions (Great Answer)

During the `presenting` phase any participant can react:

1. Client calls the Convex public mutation `liveIcebreakers:sendReaction` with `{ sessionId, kind }` where `kind` is `celebrate`, `applause`, or `fire`.
2. Rate-limited by the `liveInteraction` rate limiter on the caller's identity.
3. A row is inserted into `liveIcebreakerReactions`. Every participant's `getRecentReactions` subscription fires and triggers a confetti burst.
4. Rows self-expire after 15 seconds (`REACTION_TTL_MS`); `sendReaction` opportunistically prunes stale rows on each write. Nothing is written to PostgreSQL.

### 7.6 Advance to Next Prompt

After a presented prompt has been answered:

1. Facilitator clicks "Next".
2. `POST /api/icebreakers/:id/advance`.
3. Backend checks for the next pending prompt.
   - **Pending prompt found** → session moves back to `curating`, `currentPromptId` cleared. Convex projection synced.
   - **Deck exhausted** → session is **hard-deleted** (cascade to prompts + participants). Convex projection removed. Returns `{ ended: true }`.

### 7.7 End Session Early

1. Facilitator clicks "End Session".
2. `DELETE /api/icebreakers/:id`.
3. Backend: verifies `canManage`, hard-deletes the session row (cascading to prompts + participants). Enqueues Convex projection delete.
4. Session disappears from all participants' views immediately.

### 7.8 Session Lifecycle

```text
waiting → curating ⇄ presenting → [hard-deleted when deck exhausted]
                                           ↑
                    DELETE /api/icebreakers/:id (end early) ──────────┘
```

Status values: `waiting` (created, not started), `curating` (facilitator browsing deck), `presenting` (current prompt on screen). The `completed` status exists in the enum but is never written in the current implementation — sessions go directly from `presenting` to deletion.

---

## 8. Notifications

### 7.1 In-App Notifications

**Fetching:**

- `GET /api/notifications` — returns up to 50 newest notifications.
- `GET /api/notifications/unread-count` — returns `{ count }` for the badge.

**Marking read:**

- `PATCH /api/notifications/{id}/read` — single notification.
- `PATCH /api/notifications/read-all` — all unread.

**Real-time delivery:**

- WebSocket room `user:{userId}` — server pushes `notification` events.
- `NotificationBell` component listens and refetches on event.
- Certain notification types also trigger React Query cache invalidation (e.g. `team_join_approved` invalidates `['teams']` so membership reflects immediately).

**Notification types generated by the backend:**

| Type | Triggered by |
|---|---|
| `team_join_request` | User sends a join request |
| `team_join_approved` | Lead approves a join request |
| `team_join_rejected` | Lead rejects a join request |
| `org_invite` | User invited to an org |

### 7.2 Push Notifications

**Subscribe:**

1. User enables push in notification settings.
2. Browser prompts for permission.
3. Frontend fetches VAPID public key: `GET /api/notifications/push-vapid-key`.
4. Creates browser `PushSubscription` via service worker.
5. `POST /api/notifications/push-subscribe` with `{ endpoint, keys }`.
6. Backend stores `pushSubscription` row for this user.

**Receive:**

- Server sends Web Push message to stored endpoint.
- `public/sw.js` service worker receives `push` event, calls `showNotification()`.
- Notification visible even when app is closed.
- Clicking notification opens the app.

**Unsubscribe:**

- `DELETE /api/notifications/push-subscribe`.
- Backend deletes subscription row. Push messages stop.

---

## Realtime Architecture

The app uses a **hybrid realtime approach**:

| Feature | Transport | Direction |
|---|---|---|
| Retro board updates | Socket.IO WebSocket | Server → all participants |
| Estimates session updates | Socket.IO WebSocket | Server → all participants |
| In-app notifications | Socket.IO WebSocket | Server → single user room |
| Icebreaker session/board updates | Convex subscription | Convex → all participants |
| Icebreaker reactions (presenting phase) | Convex public mutation + subscription | Client → Convex → all participants |
| Standup updates | Convex subscription | Convex → all participants |
| Push notifications | Web Push (service worker) | Server → browser (even when closed) |
| Data fetching / cache | React Query | Client polls / invalidates on mutation |

**Socket.IO rooms:**

- `user:{userId}` — personal notifications
- `session:{sessionId}` — estimate session updates

**WebSocket events:**

| Event | Payload | Used by |
|---|---|---|
| `retro-changed` | Full retro object | Retro board |
| `retro-status-changed` | `{ status }` | Retro board phase transitions |
| `retro-list-changed` | none | Retro list page refetch |
| `discussion-card-changed` | `{ cardId }` | Discussion phase |
| `session-changed` | Full session object | Estimates session |
| `notification` | Notification object | Notification bell |
