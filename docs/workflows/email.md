# Email — frontend flows

> UI components, hooks, and user-facing flows for every email trigger in the app (verification, password reset, invitations, join requests, retro reports).

## Email-Triggered User Flows

### 1. Registration & Email Verification

**Route**: `/auth/sign-up`

```
User fills form (name, email, password)
    ↓
Clicks "Create Admin Account" or "Request Access"
    ↓
POST /api/auth/sign-up/email
    ↓
Backend: Better Auth sends verification email
    ↓
User sees success page with instructions
    ↓
User clicks link in email → /auth/verify-email?token=abc123
    ↓
Frontend: Calls authClient.verifyEmail({ query: { token } })
    ↓
Backend: Validates token, marks user emailVerified: true
    ↓
Frontend shows success screen → "Go to Dashboard"
```

**File**: `retro-tool-ui/src/routes/auth/sign-up.tsx`

- Form validation with Zod
- Success state: "Welcome, Admin!" (if first user) or pending approval notice
- Error handling: Shows error toasts for failed sign-ups

### 2. Password Reset

**Route**: `/auth/forgot-password`

```
User clicks "Forgot password?" on sign-in page
    ↓
Enters email → Clicks "Send Reset Link"
    ↓
POST /api/auth/forgot-password
    ↓
Backend: Sends password reset email
    ↓
Frontend shows success: "Check your email"
    ↓
User clicks reset link in email → /auth/reset-password?token=xyz
    ↓
User enters new password → submits
    ↓
POST /api/auth/reset-password
    ↓
Backend: Validates token, updates password
    ↓
Frontend redirects to sign-in on success
```

**File**: `retro-tool-ui/src/routes/auth/forgot-password.tsx`

- Email input validation
- Success state: Displays submitted email with instructions
- Error handling: Toast errors

**File**: `retro-tool-ui/src/routes/auth/reset-password.tsx`

- Password requirements checklist
- Passwords-match validation
- Success: Auto-redirect to sign-in

### 3. Email Verification Resend

**Route**: `/auth/verify-email`

**Scenario**: User's verification email expired or didn't arrive

```
Frontend: GET session data
    ↓
User is signed in (has session)?
    ↓
Show "Resend Verification Email" button
    ↓
User clicks button
    ↓
authClient.sendVerificationEmail({ email, callbackURL })
    ↓
Backend: Sends verification email
    ↓
Toast: "Verification email sent — check your inbox"
    ↓
User clicks new link in email
    ↓
Verification flow completes → Dashboard
```

**File**: `retro-tool-ui/src/routes/auth/verify-email.tsx`

- States: `loading`, `success`, `error`, `no-token`
- Resend button: Hidden if user not signed in
- Error state: Shows error message + resend button

**Key Implementation**:

```typescript
const [session, setSession] = useState<{ user: { email: string } } | null>(null)
const [resendPending, setResendPending] = useState(false)

useEffect(() => {
  const getSession = async () => {
    const { data } = await authClient.getSession()
    if (data) setSession(data)
  }
  getSession()
}, [])

const handleResendVerification = async () => {
  if (!session?.user?.email) {
    toast.error('Please sign in to resend verification email')
    return
  }
  setResendPending(true)
  try {
    await authClient.sendVerificationEmail({
      email: session.user.email,
      callbackURL: '/auth/verify-email',
    })
    toast.success('Verification email sent — check your inbox')
  } catch (err) {
    toast.error(err.message || 'Could not send verification email')
  } finally {
    setResendPending(false)
  }
}
```

### 4. Organization Invitation

**Route**: `/organizations/:orgId`

```
Org admin clicks "Invite Member" button
    ↓
Dialog opens with email + role selector
    ↓
Admin enters email address
    ↓
Selects role: member | org-admin | org-owner
    ↓
Clicks "Send Invite"
    ↓
POST /api/organizations/:orgId/invite
    ↓
Backend: Finds user by email, sends invite email
    ↓
Toast: Success notification
    ↓
User receives "You've been invited to join {org}" email
    ↓
User clicks link → redirected to organizations page
    ↓
User is now org member with assigned role
```

**File**: `retro-tool-ui/src/routes/organizations/$orgId.tsx`

- "Invite Member" button (visible to org admins only)
- Dialog with email input + role dropdown
- Error handling: Toast on API failure

**File**: `retro-tool-ui/src/routes/organizations/hooks/use-organization-mutations.ts`

```typescript
export function useInviteOrgMemberMutation(orgId: string) {
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) =>
      api.post(ORGANIZATIONS_ENDPOINTS.INVITE(orgId), body),
    onSuccess: () => {
      toast.success('Member invited successfully')
      // Invalidate members list to refresh
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to invite member')
    },
  })
}
```

### 5. Team Join Request & Approval Emails

**Route**: `/teams/:teamId` → Team detail page

```
User clicks "Request to Join"
    ↓
POST /api/teams/:teamId/join-requests
    ↓
Backend: Creates request, sends email to team leads
    ↓
Toast: "Join request sent"
    ↓
User sees "Request Pending" status
```

**Approval Flow (Team Lead)**:

```
Team lead sees pending join request
    ↓
Clicks "Approve"
    ↓
POST /api/teams/:teamId/join-requests/:requestId/approve
    ↓
Backend: Approves, sends approval email to requester
    ↓
Requester receives email: "Your request to join {team} approved"
    ↓
Requester is now team member
```

**Rejection Flow**:

```
Team lead clicks "Reject"
    ↓
POST /api/teams/:teamId/join-requests/:requestId/reject
    ↓
Backend: Rejects, sends rejection email
    ↓
Requester receives email: "Your request was not approved"
    ↓
Request shows as rejected
```

### 6. Retrospective Report Email

**Route**: Retro board (completed status) → `src/components/retro-report.tsx`

```
Retro completed
    ↓
"Retro Report" section visible on board
    ↓
Stats shown: participants, cards, votes, action items
    ↓
Admin clicks "Email Report" button
    ↓
Loading state: "Sending..."
    ↓
POST /api/retros/:id/send-report { recipients?: [...] }
    ↓
Backend: Builds HTML report, sends to all team members
    ↓
Returns { sent: N }
    ↓
Toast: "Report sent to N recipient(s)"
    ↓
Button returns to normal state
```

**File**: `retro-tool-ui/src/components/retro-report.tsx`

- Location: Bottom of retro board when status === 'completed'
- Button: "Email Report" with Mail icon, next to expand/collapse toggle
- Disabled while sending: Shows "Sending..." text
- On error: Toast with error message

**Hook**: `retro-tool-ui/src/routes/retros/hooks/use-send-retro-report.ts`

```typescript
export function useSendRetroReport(retroId: string) {
  return useMutation({
    mutationFn: (body: { recipients?: string[] }) =>
      api.post<{ sent: number }>(RETROS_ENDPOINTS.SEND_REPORT(retroId), body),
    onSuccess: (data) => {
      toast.success(`Report sent to ${data.sent} recipient(s)`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send report')
    },
  })
}
```

## API Endpoints

All email-related endpoints are defined in `retro-tool-ui/src/lib/api-endpoints.ts`:

```typescript
// Authentication
POST /api/auth/sign-up/email
POST /api/auth/forgot-password
POST /api/auth/reset-password?token=...
POST /api/auth/verify-email?token=...

// Organizations
POST /api/organizations/:id/invite

// Teams
POST /api/teams/:id/join-requests
POST /api/teams/:id/join-requests/:requestId/approve
POST /api/teams/:id/join-requests/:requestId/reject

// Retros
POST /api/retros/:id/send-report
```

## UI Components & Hooks

### Authentication Hooks

**File**: `retro-tool-ui/src/routes/auth/hooks/use-sign-up.ts`

- Sign-up form submission
- Triggers verification email via Better Auth

**File**: `retro-tool-ui/src/routes/auth/hooks/use-forgot-password.ts`

- Forgot password form → triggers reset email

**File**: `retro-tool-ui/src/routes/auth/hooks/use-reset-password.ts`

- Validates reset token, submits new password

**File**: `retro-tool-ui/src/routes/auth/hooks/use-admin-check.ts`

- Checks if first user (admin) exists

### Organization Hooks

**File**: `retro-tool-ui/src/routes/organizations/hooks/use-organization-mutations.ts`

- `useInviteOrgMemberMutation(orgId)` → sends invite email

### Team Hooks

**File**: `retro-tool-ui/src/routes/teams/`

- Join request mutations
- Approve/reject join request mutations

### Retro Hooks

**File**: `retro-tool-ui/src/routes/retros/hooks/use-send-retro-report.ts`

- Sends retro report email to team members

## UI States & Error Handling

### Loading States

- Buttons show `disabled` state while `isPending`
- Text changes: "Send" → "Sending..."
- Spinners displayed (using `Loader2` icon)

### Success States

- Green checkmark (✓) icons
- Success toasts with TanStack Query invalidation
- Automatic redirects or state updates

### Error States

- Red error toasts with message
- Buttons remain clickable for retry
- Error messages from backend displayed directly

### Toast Implementation

Uses `sonner` toast library:

```typescript
import { toast } from 'sonner'

toast.success('Email sent successfully')
toast.error('Failed to send email: ' + error.message)
```

## Error Messages

Common error scenarios:

| Scenario                        | Error                                   | User Sees                       |
| ------------------------------- | --------------------------------------- | ------------------------------- |
| User email not found for invite | `No user found with that email address` | "No user found..."              |
| User already org member         | `User is already a member`              | "User is already..."            |
| No Resend API key               | Service returns false                   | Sign-up proceeds, email skipped |
| Resend API timeout              | `Resend API error: ...`                 | "Failed to send email"          |
| Invalid reset token             | `Invalid or expired token`              | "Verification Failed" page      |
| Verification already done       | `Email already verified`                | Redirects to dashboard          |

## Frontend Architecture

### API Layer

**File**: `retro-tool-ui/src/lib/api.ts`

- Wrapper around fetch
- Methods: `api.get()`, `api.post()`, `api.patch()`, `api.put()`, `api.delete()`
- Base URL: `VITE_API_URL` (from .env)
- Returns parsed JSON or throws error

### Auth Client

**File**: `retro-tool-ui/src/lib/auth-client.ts`

- Better Auth client configured for API at `{VITE_API_URL}/api/auth`
- Cookie-based sessions (sent with `credentials: 'include'`)
- Methods:
  - `authClient.signUp.email({ email, password, name })`
  - `authClient.signIn.email({ email, password })`
  - `authClient.forgotPassword({ email })`
  - `authClient.resetPassword({ newPassword, token })`
  - `authClient.verifyEmail({ query: { token } })`
  - `authClient.sendVerificationEmail({ email, callbackURL })`
  - `authClient.getSession()`
  - `authClient.signOut()`

### TanStack Query (React Query)

Used for API calls and state management:

```typescript
// Mutations (POST/PUT/PATCH/DELETE)
const mutation = useMutation({
  mutationFn: (data) => api.post(endpoint, data),
  onSuccess: (data) => {
    /* handle success */
  },
  onError: (error) => {
    /* handle error */
  },
})

mutation.mutate(data)
mutation.isPending // true while loading
mutation.isError // true if failed
```

## Testing Email Features

### Manual Testing

1. **Email Verification**:
   - Sign up with test email
   - Check verification email received
   - Click link → verify email
   - Should redirect to dashboard

2. **Password Reset**:
   - Click "Forgot Password"
   - Enter email → submit
   - Should see success page with submitted email
   - Check email for reset link
   - Click link → /auth/reset-password?token=...
   - Enter new password → submit
   - Should redirect to sign-in, then sign in with new password

3. **Org Invite**:
   - As org admin, click "Invite Member"
   - Enter email of registered user
   - Select role → submit
   - Should see success toast
   - Invited user should receive email

4. **Team Join Request**:
   - As team member, request to join team
   - Team lead should receive email notification
   - Team lead approves → requester receives approval email
   - Team lead rejects → requester receives rejection email

5. **Retro Report**:
   - Complete a retrospective
   - Click "Email Report" button
   - Should see "Sending..." then success toast
   - Team members receive report email with stats

### Environment Setup for Testing

```env
# retro-tool-ui/.env
VITE_API_URL=http://localhost:8000

# retro-tool-api/.env
RESEND_API_KEY=re_test_...  # Or leave blank for console logging
```

## Future Frontend Enhancements

- [ ] Email preference center (mute notifications, digest settings)
- [ ] Email template preview in admin dashboard
- [ ] Bulk email sending UI (retro reports to multiple recipients)
- [ ] Email delivery status indicators in UI
- [ ] Unsubscribe link handling
- [ ] Email scheduling (send report at specific time)
