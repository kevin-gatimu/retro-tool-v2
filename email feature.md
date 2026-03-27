**Ready for review**Select text to add comments on the plan

# Email Features — Comprehensive Implementation Plan

## Context

The app has a working `EmailService` (Resend-backed, logs to `email_log`) and password reset emails. We need to wire email into six more flows: registration verification, account approval, org invites, team join events, retro report sending, and exposing errors when email fails. The `verify-email.tsx` route already exists on the frontend; the backend infrastructure (Resend, templates, DB logging) is already in place.

---

## Execution Order

### 1. Extend Email Enum + Schema Enum (DB migration needed)

**`src/common/enums/email.enums.ts`** Add three new constants:

```ts
AccountApproved: 'account_approved',
OrgInvite: 'org_invite',
RetroReport: 'retro_report',
// TeamActivity already exists — reuse for all team-join emails
```

**`src/common/schema-enums/index.ts`** (line 125–130) Add the three new strings to `emailLogTypeEnum` pgEnum array.

> **Run `npx drizzle-kit push` after this step** — alters the Postgres enum before any new values are written.

---

### 2. Email Verification on Registration

**`src/lib/email.ts`**

* Add `sendVerificationEmail(params: { to, name, verificationUrl })` to the `EmailService` interface.
* Implement in both the no-API-key fallback (console log) and the live Resend path.
* HTML template follows the same styled table layout as `passwordResetHtml` (dark header, CTA button, footer).

**`src/auth/auth.config.ts`** Add `emailVerification` block inside `betterAuth({...})` at the same level as `emailAndPassword`:

```ts
emailVerification: {
  sendOnSignUp: true,
  sendVerificationEmail: async ({ user, token }) => {
    const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`;
    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
    });
  },
},
```

`frontendUrl` and `emailService` are already in scope from the factory function. No new imports needed.

**Frontend: `src/routes/auth/verify-email.tsx`** Wire the "Resend Verification Email" button (already rendered, no `onClick`):

* Call `authClient.useSession()` to get the user's email.
* On click: call `authClient.sendVerificationEmail({ email, callbackURL: '/auth/verify-email' })`.
* Show loading state; `toast.success` on success, `toast.error` on failure.
* Hide resend button if no session (not signed in).

---

### 3. Account Approval Email

**`src/email/email.service.ts`** Add `buildAccountApprovedHtml(params: { userName, appUrl }): string`

* Subject: `"Your account has been approved"`
* Heading: `"You're in!"`
* Body: account approved, click to sign in
* CTA: `"Sign in"` → `appUrl/auth/sign-in`

**`src/users/users.service.ts`**

* Inject `EmailService` in constructor.
* In `updateStatus()`: after the `.returning()` call, if `data.status === 'approved'`, fire-and-forget:
  ```ts
  void this.emailService.send({ to, subject, html, userId, type: EMAIL_LOG_TYPES.AccountApproved }).catch(() => undefined);
  ```
* In `bulkUpdateStatus()`: same pattern inside the loop for each approved target (user data already in scope from earlier `select`).

**`src/users/users.module.ts`** — add `EmailModule` to `imports`.

---

### 4. Org Invite Email

**`src/email/email.service.ts`** Add `buildOrgInviteHtml(params: { userName, orgName, role, appUrl }): string`

* Subject: `"You've been invited to join {orgName}"`
* CTA: `"View Organisation"` → `appUrl/organizations`

**`src/organizations/organizations.service.ts`**

* Inject `EmailService` and `ConfigService` (if not already present).
* In `inviteOrganizationMember()`: after the existing `notifyUserOfOrgInvite` call, add fire-and-forget email send using `EMAIL_LOG_TYPES.OrgInvite`.

**`src/organizations/organizations.module.ts`** — add `EmailModule` to `imports`.

---

### 5. Team Join Request / Approved / Rejected Emails

**`src/email/email.service.ts`** Add three template methods (all use `EMAIL_LOG_TYPES.TeamActivity`):

* `buildTeamJoinRequestHtml(params: { adminName, requesterName, teamName, appUrl })` — notifies team leads
* `buildTeamJoinApprovedHtml(params: { userName, teamName, teamId, appUrl })` — CTA → team page
* `buildTeamJoinRejectedHtml(params: { userName, teamName })` — no CTA needed

**`src/teams/teams.service.ts`**

* Inject `EmailService` and `ConfigService`.
* In `createJoinRequest()`: after `notifyTeamAdminsOfJoinRequest`, query team leads with their emails (join `teamMember` + `user` where `tag = 'team-lead'`), then send one fire-and-forget email per lead.
* In `approveJoinRequest()`: after `notifyUserOfJoinApproval`, fetch requester email (`user` table by `request.userId`), send fire-and-forget approved email.
* In `rejectJoinRequest()`: same pattern, send rejected email.

**`src/teams/teams.module.ts`** — add `EmailModule` to `imports`.

---

### 6. Retro Report Email Endpoint

**`src/email/email.service.ts`** Add `buildRetroReportHtml(params: { recipientName, retroName, teamName, completedAt, stats, columns, actionItems })`: string` Sections: stats summary row → per-column card highlights (top 3 voted cards per column) → action items list.

**New DTO: `src/retros/dto/send-retro-report.dto.ts`**

```ts
export const sendRetroReportSchema = z.object({
  recipients: z.array(z.string().email()).max(50).optional(),
});
export type SendRetroReportDto = z.infer<typeof sendRetroReportSchema>;
```

Export from the dto barrel.

**`src/retros/retros.service.ts`** Add `sendRetroReport(userId, retroId, data: SendRetroReportDto): Promise<{ sent: number }>`:

1. Fetch retro; throw `NotFoundException` if missing.
2. Throw `BadRequestException` if `status !== 'completed'`.
3. Verify `userId` is a team member (existing pattern in this service).
4. Fetch: team name, template columns, cards with vote counts + `isDiscussed`, retro action items.
5. Determine recipients: if `data.recipients` provided use them; else query `teamMember JOIN user` for `retro.teamId`.
6. Build HTML once, send per recipient with `EMAIL_LOG_TYPES.RetroReport`. Use calling `userId` for the log.
7. Return `{ sent: successCount }`.

* Inject `EmailService` in constructor.

**`src/retros/retros.controller.ts`**

```ts
@Post(':id/send-report')
@HttpCode(HttpStatus.OK)
async sendReport(@Session() session, @Param('id') retroId, @Body() body: SendRetroReportDto) {
  return this.retrosService.sendRetroReport(session.user.id, retroId, body);
}
```

**`src/retros/retros.module.ts`** — add `EmailModule` to `imports`.

**Frontend: `src/lib/api-endpoints.ts`** Add to `RETROS_ENDPOINTS`: `SEND_REPORT: (id: string) => \`/api/retros/${id}/send-report``

**New hook: `src/routes/retros/hooks/useSendRetroReport.ts`** `useMutation` calling `api.post(RETROS_ENDPOINTS.SEND_REPORT(retroId), body)`. `onSuccess`: `toast.success(\`Report sent to ${data.sent} recipient(s)`)<span>` `onError`:`<span>` `toast.error(e.message || 'Failed to send report')`

**`src/components/retro-report.tsx`** Add "Email Report" button in the report header (next to expand/collapse toggle):

* `<Button size="sm" variant="outline">` with `Mail` icon from lucide-react.
* Calls `sendRetroReportMutation.mutate({})` (sends to all team members).
* Disabled + shows "Sending..." while `isPending`.
* `e.stopPropagation()` to prevent toggling collapse.

---

## Error Handling Strategy

| Email type             | On failure                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Verification (sign-up) | Better Auth propagates the exception — user sees sign-up error, can retry                                                        |
| All others             | Fire-and-forget `.catch(() => undefined)` — request always succeeds; failure logged to `email_log` with `status: 'failed'` |
| Retro report endpoint  | Returns `{ sent: N }` — frontend shows toast with count; 0 means all failed                                                    |
| Frontend mutations     | `onError` toast with server error message                                                                                       |

---

## Critical Files

| File                                                            | Change                                            |
| --------------------------------------------------------------- | ------------------------------------------------- |
| `src/common/enums/email.enums.ts`                             | Add 3 new type constants                          |
| `src/common/schema-enums/index.ts`                            | Add 3 new values to pgEnum                        |
| `src/lib/email.ts`                                            | Add `sendVerificationEmail` to interface + impl |
| `src/auth/auth.config.ts`                                     | Add `emailVerification` block                   |
| `src/email/email.service.ts`                                  | Add 5 new HTML template methods                   |
| `src/users/users.service.ts` + module                         | Inject EmailService, send on approval             |
| `src/organizations/organizations.service.ts` + module         | Inject EmailService, send on invite               |
| `src/teams/teams.service.ts` + module                         | Inject EmailService, send join emails             |
| `src/retros/dto/send-retro-report.dto.ts`                     | New DTO                                           |
| `src/retros/retros.service.ts` + module                       | `sendRetroReport` method, inject EmailService   |
| `src/retros/retros.controller.ts`                             | `POST :id/send-report` route                    |
| `retro-tool-ui/src/lib/api-endpoints.ts`                      | Add `SEND_REPORT`                               |
| `retro-tool-ui/src/routes/retros/hooks/useSendRetroReport.ts` | New mutation hook                                 |
| `retro-tool-ui/src/components/retro-report.tsx`               | Email Report button                               |
| `retro-tool-ui/src/routes/auth/verify-email.tsx`              | Wire resend button                                |

---

## Verification

1. **Email verification** : Register a new user → check inbox for verification email → click link → `/auth/verify-email?token=...` shows success.
2. **Resend verification** : On error state of verify-email page, click "Resend" → toast success → check inbox.
3. **Account approval** : Admin approves a pending user → user receives "Your account has been approved" email.
4. **Org invite** : Org admin invites by email → invited user receives email with org name and role.
5. **Team join request** : User requests to join team → team leads receive email notification.
6. **Team join approved/rejected** : Admin approves/rejects → requester receives corresponding email.
7. **Retro report** : Open a completed retro → click "Email Report" → toast shows sent count → team members receive formatted report.
8. **No Resend key** : Set `RESEND_API_KEY=` blank → all emails skip silently (console log), no errors thrown for non-critical paths; sign-up still succeeds.
9. **DB** : After step 1 changes, run `npx drizzle-kit push` and verify `email_log_type` enum has the new values.

Add Comment
