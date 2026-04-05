# Email System Documentation

## Overview

The Retro Tool application uses **Resend** as the email service provider for transactional emails. Emails are sent in two modes:

1. **Critical emails**: Failures propagate to users (sign-up verification)
2. **Non-critical emails**: Fire-and-forget; failures are logged to the database without disrupting the user flow

All sent/failed emails are logged to the `email_log` table for auditing and debugging.

## Configuration

### Environment Variables

```env
RESEND_API_KEY=re_your_api_key_here
```

The `EmailService` checks for this key on startup:

- If **not set**: Email sending is disabled, calls log to console and return `false` silently
- If **set**: Emails are sent via Resend; failures are logged to the database

### From Email Address

Default (set in `auth.config.ts`):

```
Retro-Tool <onboarding@resend.dev>
```

To customize, update `emailConfig?.fromEmail` in `src/auth/auth.config.ts`.

## Architecture

### Service Layer: `src/email/email.service.ts`

The `EmailService` is a NestJS injectable that:

- Wraps the Resend SDK
- Generates HTML email templates
- Logs all email attempts to the database

**Key Methods:**

- `send(params)` — Sends an email and logs the result (returns `boolean`)
- `buildAccountApprovedHtml(...)` — Account approval email template
- `buildOrgInviteHtml(...)` — Organization invitation template
- `buildTeamJoinRequestHtml(...)` — Team join request notification to admins
- `buildTeamJoinApprovedHtml(...)` — Team join approval notification
- `buildTeamJoinRejectedHtml(...)` — Team join rejection notification
- `buildRetroReportHtml(...)` — Retrospective report with stats and action items

### Standalone Service: `src/lib/email.ts`

Used by Better Auth (outside NestJS dependency injection):

- `sendVerificationEmail(...)` — Email verification on sign-up
- `sendPasswordResetEmail(...)` — Password reset link

## Email Types & When They're Sent

| Email Type             | When Sent                                      | Recipient                            | Critical? | Log Type                       |
| ---------------------- | ---------------------------------------------- | ------------------------------------ | --------- | ------------------------------ |
| **Verification**       | User signs up → email verification requested   | New user                             | ✅ Yes    | `verification`                 |
| **Password Reset**     | User clicks "Forgot Password"                  | User                                 | ✅ Yes    | (not logged by NestJS service) |
| **Account Approved**   | Admin approves pending user                    | User                                 | ❌ No     | `account_approved`             |
| **Org Invite**         | Admin adds user to organization                | Invited user                         | ❌ No     | `org_invite`                   |
| **Team Join Request**  | User requests to join a team                   | Team leads                           | ❌ No     | `team_activity`                |
| **Team Join Approved** | Team lead approves join request                | Requester                            | ❌ No     | `team_activity`                |
| **Team Join Rejected** | Team lead rejects join request                 | Requester                            | ❌ No     | `team_activity`                |
| **Retro Report**       | Admin sends completed retro report (on-demand) | Team members or specified recipients | ❌ No     | `retro_report`                 |
| **Retro Reminder**     | Scheduled 1 hour before retro starts           | Team members with reminders enabled  | ❌ No     | `retro_reminder`               |
| **Weekly Digest**      | Cron job runs at 6am on user's digest day      | User                                 | ❌ No     | `weekly_digest`                |

## Flow Diagrams

### Registration & Email Verification

```
User Sign-Up
    ↓
POST /auth/sign-up/email
    ↓
Better Auth emailVerification hook triggered
    ↓
emailService.sendVerificationEmail() called
    ↓
Resend API sends verification email
    ↓
User clicks link → /auth/verify-email?token=...
    ↓
authClient.verifyEmail() → marks user emailVerified: true
```

### Account Approval Flow

```
User Status: pending
    ↓
Admin: PATCH /api/users/:id/status { status: "approved" }
    ↓
UsersService.updateStatus() updates DB
    ↓
emailService.send() → Account Approved email (fire-and-forget)
    ↓
Email logged to email_log table
```

### Team Join Request & Approval

```
User requests to join team
    ↓
POST /api/teams/:id/join-requests
    ↓
TeamsService.createJoinRequest()
    ↓
Emails sent to all team leads (fire-and-forget)
    ↓
---
Admin approves request
    ↓
POST /api/teams/:teamId/join-requests/:requestId/approve
    ↓
TeamsService.approveJoinRequest()
    ↓
emailService.send() → Approval email to requester (fire-and-forget)
    ↓
User is added as team member, account auto-approved
```

### Retro Report Email

```
Retro Status: completed
    ↓
Admin clicks "Email Report" button (UI)
    ↓
POST /api/retros/:id/send-report { recipients?: [...] }
    ↓
RetrosService.sendRetroReport()
    ↓
Fetches retro data: cards, votes, columns, action items
    ↓
Builds comprehensive HTML report
    ↓
Sends to all team members (or specified emails) (fire-and-forget)
    ↓
Returns { sent: N }
```

## Email Templates

All HTML templates use inline CSS and a consistent visual design (dark header, centered content, responsive layout).

### Template Pattern

```html
<!DOCTYPE html>
<html>
  <body
    style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"
  >
    <h2 style="color:#1e40af">Heading</h2>
    <p>Body content...</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
    <p style="color:#6b7280;font-size:12px">
      Retro Tool — Team Retrospectives Made Simple
    </p>
  </body>
</html>
```

### Account Approved Template

- **Subject**: "Your account has been approved"
- **CTA**: "Sign In" → `{appUrl}/auth/sign-in`

### Org Invite Template

- **Subject**: "You've been invited to join {orgName}"
- **Content**: Shows org name and member role
- **CTA**: "View Organisation" → `{appUrl}/organizations`

### Team Join Request Template (to admins)

- **Subject**: "{requesterName} wants to join {teamName}"
- **Content**: Admin notification
- **CTA**: "Review Request" → `{appUrl}`

### Team Join Approved Template

- **Subject**: "Your request to join {teamName} has been approved"
- **Content**: Success notification
- **CTA**: "View Team" → `{appUrl}`

### Team Join Rejected Template

- **Subject**: "Your request to join {teamName} was not approved"
- **Content**: Rejection notice (no CTA)

### Retro Report Template

- **Subject**: "Retrospective Report: {retroName}"
- **Sections**:
  1. Stats row: Participants, total cards, votes, action items
  2. Per-column summaries: Discussed/undiscussed counts, top 3 voted cards
  3. Action items list with assignee names

## Error Handling

### Critical Emails (Verification, Password Reset)

These emails are sent during user-facing actions (sign-up, password reset). If sending fails:

- **Behavior**: Exception is thrown to the caller
- **User sees**: Error message on the sign-up or forgot-password page
- **Recovery**: User can retry the action

### Non-Critical Emails (All others)

These emails are notifications and are not essential to the operation:

- **Behavior**: `void promise.catch(() => undefined)` — failures are swallowed
- **Logging**: Failure is logged to `email_log` with `status: 'failed'` and reason
- **User impact**: None — the HTTP response always succeeds
- **Debugging**: Check `email_log` table for failed sends

### Database Logging

All send attempts (success or failure) are logged:

```sql
SELECT * FROM email_log WHERE status = 'failed' ORDER BY created_at DESC;
```

Useful columns:

- `type`: Email type (verification, account_approved, etc.)
- `recipient_email`: Who it was sent to
- `status`: 'sent' or 'failed'
- `failure_reason`: Error message if failed
- `created_at`: When the attempt was made

## Implementation Details

### Module Wiring

Each service that sends emails imports `EmailModule`:

```typescript
// users.module.ts
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, CommonModule, EmailModule],
  ...
})
```

### Injecting EmailService

```typescript
constructor(
  private readonly emailService: EmailService,
  private readonly configService: ConfigService<Config>,
) {}
```

### Sending an Email

```typescript
void this.emailService
  .send({
    to: 'user@example.com',
    subject: 'Your account has been approved',
    html: this.emailService.buildAccountApprovedHtml({
      userName: 'John Doe',
      appUrl: 'https://retro-tool.example.com',
    }),
    userId: user.id,
    type: EMAIL_LOG_TYPES.AccountApproved,
  })
  .catch(() => undefined); // Fire-and-forget
```

## Configuration in Production

### Resend Setup

1. Create account at https://resend.com
2. Generate API key
3. Set environment variable: `RESEND_API_KEY=re_...`
4. Verify sender email domain (or use `onboarding@resend.dev` for testing)

### Email Domain

For production, configure a verified domain:

- DKIM, SPF, and DMARC records must be set up
- Update `fromEmail` in `auth.config.ts` to your domain (e.g., `Retro-Tool <noreply@your-domain.com>`)

### Monitoring

- Check Resend dashboard for bounce/complaint rates
- Monitor `email_log` table for failed sends
- Set up alerts for high failure rates

## Testing

### Without Resend API Key

If `RESEND_API_KEY` is not set:

- All emails log to console (development mode)
- No actual emails are sent
- `send()` returns `false` silently
- Sign-up still succeeds (non-critical emails are skipped)

### With Resend API Key

- Emails are sent to real addresses
- Resend sandbox: send to `delivered@resend.dev` to test without real email
- Check `email_log` table to verify sends

### Manual Testing Checklist

- [ ] Register new user → verify email received
- [ ] Reset password → check reset link works
- [ ] Admin approves user → verify approval email sent
- [ ] Add user to org → verify org invite email sent
- [ ] Request team join → verify team leads get notification email
- [ ] Approve join request → verify requester gets approval email
- [ ] Send retro report → verify all team members receive report

## Future Enhancements

- [ ] Email templates with branding/theming
- [ ] Unsubscribe links and preference management
- [ ] Email delivery webhooks from Resend
- [ ] Scheduled email sending (delay, batch)
- [ ] HTML email preview in admin panel
- [ ] Retry logic for failed sends
- [ ] A/B testing email templates
