# Invitations

## Overview

Two distinct flows let administrators bring users into the platform:

| Action | What it does | Who receives |
|---|---|---|
| **Invite** | Sends an email with a tokenised accept link | Anyone — registered or not |
| **Add Member** | Directly adds an existing user (no email) | Registered users only |

Both actions send an **in-app notification** to the target user when they result in a new membership.

---

## Invite flow (email-based)

### Organisation invite

**Trigger:** Admin clicks **Invite** in the Members section of an organisation page.

1. Admin enters an email address and selects a role.
2. The UI calls `GET /api/organizations/:id/check-invite-email?email=` and displays:
   - *"Account found — invitation email will be sent"* — email belongs to a registered user.
   - *"No account — invitation email will be sent to register"* — email is not yet registered.
3. On submit, `POST /api/organizations/:id/invite` creates an `orgInvitation` record (3-day expiry) and sends an email with an accept link:
   ```
   {appUrl}/auth/accept-invite?token={token}&email={invitedEmail}
   ```

### Team invite

**Trigger:** Admin/team-lead clicks **Invite** in the Members section of a team page.

1. Admin enters an email address and selects a tag (member / team-lead).
2. The UI calls the org's `check-invite-email` endpoint for the pre-check display.
3. On submit, `POST /api/teams/:id/invite` creates a `teamInvitation` record (3-day expiry) and sends an email:
   ```
   {appUrl}/auth/accept-invite?token={token}&email={invitedEmail}
   ```
4. If a pending (unaccepted) invite for the same email already exists on that team, it is deleted and replaced with a fresh one (re-invite).
5. Accepting a team invite **also enrols the user in the parent organisation** if they are not already a member.

---

## Accept-invite page (`/auth/accept-invite`)

The page reads `token` from the query string. The API resolves whether it belongs to an org or a team — the URL no longer carries a `type` parameter. The optional `email` query string is forwarded to sign-in / sign-up so the email field can be pre-filled.

### Not logged in

The preview response includes `isExistingUser: boolean` so the page can steer the invitee down the correct path and avoid the "wrong password" dead-end:

| Server says | Primary CTA | Secondary CTA | Banner copy |
|---|---|---|---|
| `isExistingUser: false` (no account yet) | **Create Account & Accept** → `/auth/sign-up?inviteToken={token}&email={invitedEmail}` | **I already have an account** → `/auth/sign-in?...` | *"You're new here — no account exists yet for `email`. Create your account using this email — it will be pre-filled and locked so the invite can be matched."* |
| `isExistingUser: true` (account exists) | **Sign In & Accept** → `/auth/sign-in?inviteToken={token}&email={invitedEmail}` | **Create a new account** → `/auth/sign-up?...` | *"We found your account — sign in to accept this invitation."* |

In both cases the email is pre-filled, and on sign-up it is read-only so the registered email always matches the invitation.

### Logged in (correct email)

The page shows the same details and a single **Accept Invitation** button (fixed width, not full-width).

### Logged in (wrong email)

If the signed-in user's email doesn't match the invited email, an **Email Mismatch** card is shown with both addresses, plus:
- **Sign Out & Continue** — signs the user out and navigates to `/auth/sign-in?inviteToken=&email=` with the invited email pre-filled.
- **Cancel** — returns to the dashboard.

On acceptance:
- The user's account is auto-approved if it was in *pending* status.
- **The user's email is marked as verified** (`email_verified = true`). Receiving and clicking the invite link proves the user controls that mailbox, so a separate verification step is unnecessary.

> **Verification email suppression** — Better Auth normally sends a "Verify your email" message on every sign-up. The `sendVerificationEmail` callback in `auth/auth.config.ts` checks whether an active (unaccepted, unexpired) `org_invitation` or `team_invitation` exists for the new user's email and **skips sending** if one is found. The accept-invite flow then verifies the email when the invitation is consumed, so invited users only receive the single invitation email.
- For org invites: the user is added as an organisation member at the invited role.
- For team invites: the user is added to the organisation (if not already a member) then to the team with the invited tag.
- The user is redirected to `/organizations/:orgId` or `/teams/:teamId` respectively.

### Edge cases

| State | Behaviour |
|---|---|
| Already accepted | Page shows "Already Accepted" with a link to the destination. |
| Expired (> 3 days) | Page shows "Invitation Expired" with a message to request a new invite. |
| Invalid / missing token | Page shows "Invalid Link" or "Invitation Not Found". |

## Sign-in page — invite mode

When `/auth/sign-in` is opened with `?inviteToken=...&email=...` (the invite-aware redirect from `accept-invite`), the page enters **invite mode**:

- The email field is pre-filled from the URL.
- After successful sign-in the user is redirected to `/auth/accept-invite?token={token}` instead of the dashboard.
- An emerald banner above the form repeats which email to use and offers a *"New to Retro-Tool? Create an account with this email instead"* link that forwards both `inviteToken` and `email` to sign-up.
- If credential sign-in fails while in invite mode, the red error block appends a recovery hint:
  > *Don't have an account yet? **Create one with `email`** or **reset your password**.*
  Both links preserve the invite context so the user lands back on the accept page after either path.
- The footer "Sign up" link also forwards `inviteToken` + `email` so navigating between sign-in / sign-up never drops the invitation.

This eliminates the previous dead-end where an invited user with no account would receive `Invalid email or password` with no clear way forward.

---

## Add Member flow (direct, no email)

### Organisation

**Trigger:** Admin clicks **Add Member** in the Members section of an organisation page.

1. Admin searches by name or email (all system users, excluding current members).
2. Selects a user and a role.
3. `POST /api/organizations/:id/members` with `{ userId, role }` directly inserts the membership and approves the account if pending.
4. An in-app notification *"You have been added to the organisation"* is sent to the user.

### Team

Existing **Add Member** on the team page — picks from existing organisation members by name. No email is sent; an in-app notification is sent.

---

## API reference

### Unified invitation endpoints (preferred)

A single token-only API works for both org and team invites. The token alone is enough — the server resolves the type by looking up the token in either the `org_invitation` or `team_invitation` table.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/invitations/preview/:token` | Public | Preview an invitation (returns `{ type, orgName, teamName?, role, invitedEmail, expired, accepted, isExistingUser, orgId, teamId? }`) |
| `POST` | `/api/invitations/:token/accept` | Auth | Accept an invitation (returns `{ type, organizationId, teamId? }`) |

### Organisation endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/organizations/:id/invite` | Org admin | Send invitation email |
| `POST` | `/api/organizations/:id/members` | Org admin | Directly add existing user |
| `GET` | `/api/organizations/:id/check-invite-email` | Org admin | Check if email is registered |
| `GET` | `/api/organizations/invitations/preview/:token` | Public | *(legacy)* Preview org invitation |
| `POST` | `/api/organizations/invitations/:token/accept` | Auth | *(legacy)* Accept org invitation |

### Team endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/teams/:id/invite` | Team manager | Send invitation email |
| `GET` | `/api/teams/invitations/:token` | Public | *(legacy)* Preview team invitation |
| `POST` | `/api/teams/invitations/:token/accept` | Auth | *(legacy)* Accept team invitation |

---

## Data model

### `org_invitation`

| Column | Type | Notes |
|---|---|---|
| `id` | `varchar(255)` | PK |
| `token` | `varchar(255)` | Unique, sent in email link |
| `email` | `varchar(255)` | Invitee email |
| `organization_id` | `varchar(255)` | FK → `organization` |
| `role` | `org_member_role` | Invited role |
| `created_by_id` | `varchar(255)` | FK → `user` |
| `expires_at` | `timestamp` | 3 days from creation |
| `accepted_at` | `timestamp` | Null until accepted |
| `created_at` | `timestamp` | Auto |

### `team_invitation`

| Column | Type | Notes |
|---|---|---|
| `id` | `varchar(255)` | PK |
| `token` | `varchar(255)` | Unique, sent in email link |
| `email` | `varchar(255)` | Invitee email |
| `team_id` | `varchar(255)` | FK → `team` |
| `tag` | `team_member_tag` | `member` or `team-lead` |
| `created_by_id` | `varchar(255)` | FK → `user` |
| `expires_at` | `timestamp` | 3 days from creation |
| `accepted_at` | `timestamp` | Null until accepted |
| `created_at` | `timestamp` | Auto |

---

## Password & account requirements

These rules are enforced in both **sign-up** and **reset-password** pages (UI helper: `getPasswordRequirements` in `retro-tool-ui/src/routes/auth/helpers/index.ts`) and validated server-side by Better Auth (`minPasswordLength: 6` in `retro-tool-api/src/auth/auth.config.ts`).

| Requirement | Pattern |
|---|---|
| At least 6 characters | `password.length >= 6` |
| Contains a number | `/\d/` |
| Contains a special character (e.g. `@ ! # $`) | `/[^a-zA-Z0-9]/` |
| Contains uppercase letter | `/[A-Z]/` |
| Contains lowercase letter | `/[a-z]/` |

Live checklist items render in emerald/grey under the password input. The submit button is disabled until **all** requirements pass.

### Reset-password flow

| Step | Endpoint / Page | Notes |
|---|---|---|
| 1. Request | `/auth/forgot-password` → `authClient.requestPasswordReset({ email, redirectTo })` | Hits Better Auth `POST /api/auth/request-password-reset`. Always returns `{ status: true, message }` regardless of whether the email exists (prevents enumeration). |
| 2. Email | `sendResetPassword` callback in `auth.config.ts` | Builds `${FRONTEND_URL}/auth/reset-password?token={token}`. Token expires in **20 minutes** (`resetPasswordTokenExpiresIn: 60 * 20`). |
| 3. Reset | `/auth/reset-password?token=...` → `authClient.resetPassword({ newPassword, token })` | Same password checklist enforced; submit disabled until satisfied + passwords match. |

The forgot-password success view surfaces the API's `message` field directly ("If this email exists in our system, check your email for the reset link") so users get the intended security-vague response instead of a hard-coded UI string.

> **Verification not required for invitees** — invited users are auto-verified when they accept (see *Accept-invite page* above). Self-signup users still receive the standard Better Auth verification email and must verify before signing in.

---

## Email branding

All transactional emails (password reset, verification, account approved, org/team invitations, retro reports) share the same Retro-Tool logo header.

The logo URL is built dynamically from `FRONTEND_URL` at boot:

```
${FRONTEND_URL}/Retro-Tool-Logo.jpg
```

- In production: `https://retro-tool.com/Retro-Tool-Logo.jpg`
- Locally: `http://localhost:3000/Retro-Tool-Logo.jpg`

Wired in two places:

| File | Templates |
|---|---|
| `retro-tool-api/src/lib/email.ts` | Password reset, email verification (Better Auth callbacks). Logo URL passed as a third arg to `createEmailService(apiKey, fromEmail, frontendUrl)`. |
| `retro-tool-api/src/email/email.service.ts` | Account approved, all invitation variants, retro report. Logo built once in the constructor from `frontend.url` config and rendered via the private `logoHtml()` helper. |

To rebrand, drop a new `Retro-Tool-Logo.jpg` into the UI's `public/` folder (or update the suffix in both files) — no template-by-template edits required.
