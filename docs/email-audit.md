# Email Features Audit

## What's Implemented (fully wired end-to-end)

### 1. Password Reset
- **Status: Complete**
- `retro-tool-api/src/lib/email.ts` — `sendPasswordResetEmail()` with polished HTML template
- `retro-tool-api/src/auth/auth.config.ts:75–88` — hooked into Better Auth's `sendResetPassword`
- UI: `/auth/forgot-password`, `/auth/reset-password` routes exist and call Better Auth client
- Reset URL: `{FRONTEND_URL}/reset-password?token=...` (1-hour expiry)

### 2. Email Verification on Sign-up
- **Status: Complete**
- `retro-tool-api/src/lib/email.ts` — `sendVerificationEmail()` with polished HTML template
- `retro-tool-api/src/auth/auth.config.ts:90–106` — `sendOnSignUp: true`
- UI: `/auth/verify-email` route exists and calls Better Auth's `verifyEmail`
- Verification URL: `{FRONTEND_URL}/auth/verify-email?token=...`

### 3. Account Approved Notification
- **Status: Complete**
- Template: `EmailService.buildAccountApprovedHtml()` (`email.service.ts`)
- Triggered: `users.service.ts` — when admin manually approves a user (single and bulk paths)
- Also triggered: `organizations.service.ts` — auto-approve when user is added to an org via invite

### 4. Organisation Invite — Existing Users

- **Status: Complete**
- Template: `EmailService.buildOrgInviteHtml()` (`email.service.ts`)
- Backend: `organizations.service.ts` — `inviteOrganizationMember()` forks on user existence
- UI: `routes/organizations/$orgId.tsx` — invite form with email + role inputs
- Notification: in-app `org_invite` notification also sent

### 5. Organisation Invite — External / Non-Registered Users

- **Status: Complete** (added)
- Template: `EmailService.buildOrgExternalInviteHtml()` (`email.service.ts`) — "Accept Invitation" button linking to tokenized URL
- Backend: `organizations.service.ts` — if email not found in DB, creates an `org_invitation` record (7-day token), sends external invite email
- New endpoints in `org-invitations.controller.ts`:

  - `GET /organizations/invitations/:token` — public, returns `{ orgName, role, expired, accepted }`
  - `POST /organizations/invitations/:token/accept` — authenticated, validates email match, adds user to org, auto-approves pending accounts

- Schema: `org_invitation` table — `id, token (uuid), email, organizationId, role, createdById, expiresAt, acceptedAt, createdAt`
- UI: `/auth/accept-invite?token=...` route — shows org + role preview; unauthenticated users get sign-up/sign-in links (both preserve `?inviteToken`); authenticated users see an Accept button
- Sign-in: `?inviteToken` param redirects back to accept-invite after successful sign-in
- Sign-up: `?inviteToken` param navigates to accept-invite instead of the pending-approval screen

### 6. Retro Report

- **Status: Complete** (enhanced)
- Template: `EmailService.buildRetroReportHtml()` (`email.service.ts`) — richest template
- Triggered: `retros.service.ts` — user manually sends report from UI
- UI: `components/retro-report.tsx` — split button with recipient dropdown; fetches team members, allows selecting specific recipients; defaults to all team members when none are selected

---

## Removed Features

The following features were removed as part of the email clean-up:

| Feature | Reason |
|---|---|
| **Retro Reminders** | Module, DB table (`retro_reminder`), scheduler, and user preference toggle removed entirely |
| **Weekly Digest** | Module, DB table (`weekly_digest`), scheduler, and user preference toggle removed entirely |
| **Team Join Request email** | Email to team leads removed; in-app notification still sent |
| **Team Join Approved/Rejected email** | Both email sends removed; in-app notifications still sent |
| **Team activity email preference** | `teamActivityEmailsEnabled` column and UI toggle removed |

---

## Email Log Types (enum in `common/enums/email.enums.ts`)

| Type | Status |
|---|---|
| `verification` | Active — sent via Better Auth / `lib/email.ts` |
| `account_approved` | Active — sent on admin approval and org invite accept |
| `org_invite` | Active — sent to existing users invited to an org |
| `org_invite_external` | Active — sent to non-registered users invited to an org |
| `retro_report` | Active — sent manually from the retro report UI |
| `weekly_digest` | Removed — value remains in DB enum but is no longer used |
| `retro_reminder` | Removed — value remains in DB enum but is no longer used |
| `team_activity` | Removed — value remains in DB enum but is no longer used |

---

## Configuration

| Variable | Purpose | Dev default |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | — |
| `EMAIL_FROM` | RFC 5322 sender address | `Retro-Tool <info@retro-tool.com>` (prod); use `Retro-Tool <onboarding@resend.dev>` locally until domain is verified |
| `EMAIL_SANDBOX_TO` | Redirect all outbound emails to this address (dev only) | `delivered@resend.dev` |

---

## Remaining Gaps

| Feature | Impact | Notes |
|---|---|---|
| New-user pending — admin alert | Medium | Admins are not emailed when a new user enters the approval queue |
| Action item assigned | Medium | Only in-app notification; no email to the assignee |
