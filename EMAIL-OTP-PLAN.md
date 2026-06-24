# Email OTP Authentication Plan (Server-Driven)

> Add Better Auth's `emailOTP` plugin so **sign-in**, **password reset**, and **email verification** use a
> 6-digit one-time code. OTP operations run **server-side** in NestJS via the injected Better Auth
> instance (`auth.api.*`); the UI calls our `/api/otp/*` endpoints. Ref:
> https://better-auth.com/docs/plugins/email-otp

## Context

Current flows are **email-link** based (Better Auth in NestJS via `@thallesp/nestjs-better-auth`):

- **Email verification** — link `…/auth/verify-email?token=…` (24h), auto-sent on sign-up.
- **Password reset** — link `…/auth/reset-password?token=…` (20m).
- **Sign-in** — email + password only.

Agreed direction:

1. **Replace** links with OTP for verify-email + password-reset; **add** a passwordless "email me a code"
   option to sign-in (password sign-in stays).
2. **Server-driven** — NestJS performs every OTP operation through the injected Better Auth instance
   (`auth.api.*`), exposed by the library's `AuthService` (verified: `AuthService.api` / `.instance`). The
   UI calls **our** NestJS endpoints, never the Better Auth plugin endpoints directly. This keeps server
   control of every send/verify (rate-limit, logging, account-status checks).
3. Sign-in OTP is an **additional** option alongside password.
4. OTP params: **6 digits, 5 min expiry, 3 attempts** (`otpLength: 6, expiresIn: 300, allowedAttempts: 3`).

> **Note:** The sign-in page hosts **multiple** passwordless options — the email-OTP code (this plan) and
> **passkeys** (see [PASSKEY-PLAN.md](PASSKEY-PLAN.md)). `/profile/security` is where users manage them.
> This plan is unaffected by passkeys; they coexist as parallel choices.

## Server methods (exact, non-deprecated)

Called via the injected `AuthService.api`:

- `sendVerificationOTP({ body: { email, type } })` — `type: 'sign-in' | 'email-verification' | 'forget-password'`
- `signInEmailOTP({ body: { email, otp } })` — passwordless sign-in (auto-registers unless `disableSignUp`)
- `verifyEmailOTP({ body: { email, otp } })` — email verification
- `requestPasswordResetEmailOTP({ body: { email } })` — reset send (the non-deprecated method; **not**
  `/forget-password/email-otp`)
- `resetPasswordEmailOTP({ body: { email, otp, password } })` — reset completion
- `checkVerificationOTP({ body: { email, type, otp } })` — optional pre-check

The plugin's own endpoints remain auto-mounted by the BA middleware, but the UI won't target them — our
controller is the single front door. OTP codes reuse the existing `verification` table (no migration).

## API changes (`retro-tool-api`)

**1. Email service** — `src/lib/email.ts`: add `sendOtpEmail({ to, name, otp, type })` to the
`EmailService` interface + Resend impl + console-mock branch (mock logs the OTP for local dev), and an
`otpEmailHtml()` template mirroring the existing `passwordResetHtml`/`emailVerificationHtml` styling.
Heading/subject varies by `type` ("Your sign-in code" / "Verify your email" / "Reset your password"),
code shown prominently + "expires in 5 minutes".

**2. Auth config** — `src/auth/auth.config.ts`: add `emailOTP` from `better-auth/plugins` to `plugins`:

```ts
emailOTP({
  otpLength: 6,
  expiresIn: 300,
  allowedAttempts: 3,
  sendVerificationOnSignUp: true,          // signup sends an OTP instead of the link
  overrideDefaultEmailVerification: true,  // any email-verification uses OTP, not a link
  async sendVerificationOTP({ email, otp, type }) {
    // For 'email-verification', keep the existing invite-suppression check
    // (skip when an active org/team invitation exists for this email).
    // Then emailService.sendOtpEmail({ to: email, otp, type }).
    // Do NOT await the send (plugin guidance: avoid timing attacks) — fire-and-forget + error logging.
  },
})
```

Keep `emailAndPassword.enabled` (password sign-in stays). Keep the link-based
`emailVerification.sendVerificationEmail` / `sendResetPassword` blocks **through the transition**, then
remove. Preserve invite-suppression by moving that query into the `email-verification` branch of
`sendVerificationOTP`.

**3. New OTP module** — `src/auth/otp/` per the module convention (`otp.controller.ts`, `otp.service.ts`,
`dto/`, `types/index.ts`), injecting the library's `AuthService`. Endpoints under the `api` prefix,
`@AllowAnonymous` (pre-auth):

- `POST /api/otp/send` → `auth.api.sendVerificationOTP` (email, type)
- `POST /api/otp/sign-in` → `auth.api.signInEmailOTP` → then the same post-sign-in status handling the
  password flow uses; **propagate** the auth response's `set-auth-token` + session cookie so the existing
  UI bearer-capture keeps working.
- `POST /api/otp/verify-email` → `auth.api.verifyEmailOTP`
- `POST /api/otp/reset-password/send` → `auth.api.requestPasswordResetEmailOTP`
- `POST /api/otp/reset-password` → `auth.api.resetPasswordEmailOTP`

The service validates DTOs (existing class-validator/Zod pattern) and maps BA error codes
(`TOO_MANY_ATTEMPTS`, expired/invalid) to clean HTTP responses.

**4. Rate limiting** — add `customRules` (and/or throttler rules on our controller) for the OTP
send/verify routes mirroring the existing `/forgot-password` (3 / 5 min) and `/sign-in/email` (10 / min)
posture — defense-in-depth on top of `allowedAttempts: 3`.

## UI changes (`retro-tool-ui`)

The UI calls **our** `/api/otp/*` endpoints via the existing `api` helper (`lib/api.ts`) — no client
plugin, no direct Better Auth calls for OTP (consistent with the server-driven decision).

**1. OTP input** — add `src/components/ui/input-otp.tsx` (shadcn `input-otp` + the `input-otp` dep),
reused on all three screens.

**2. Sign-in** (`routes/auth/sign-in.tsx` + `hooks/use-sign-in.ts`): keep email+password; add "Email me a
sign-in code" → `POST /api/otp/send {type:'sign-in'}` → OTP step → `POST /api/otp/sign-in`. Preserve the
post-sign-in status handling (pending/rejected/suspended via `/users/me`) + bearer capture.

**3. Forgot/reset password** — collapse the link flow into a code flow:

- `forgot-password.tsx` / `use-forgot-password.ts`: `POST /api/otp/reset-password/send {email}` → reset
  step carrying `email` (no token).
- `reset-password.tsx` / `use-reset-password.ts`: OTP + new-password fields → `POST /api/otp/reset-password
  {email, otp, password}`. Drop the `?token=` dependency.

**4. Verify email** (`routes/auth/verify-email.tsx`): OTP entry → `POST /api/otp/verify-email {email,otp}`;
"Resend code" → `POST /api/otp/send {type:'email-verification'}`. Email from the just-signed-up
session/state.

**5. Routing** — verify-email / reset-password no longer need a `token` search param (carry `email`); keep
old token routes working during the transition.

## Phasing (no mid-deploy breakage)

1. **API additive** — add the `emailOTP` plugin + `sendOtpEmail` + the `/api/otp/*` module + rate limits,
   with override / send-on-signup ON, but **keep** the existing link callbacks. Deploy API.
2. **UI** — add the OTP component + switch the three screens to `/api/otp/*`. Deploy UI.
3. **Cleanup** — remove the dead link callbacks and token-based route handling.

## Critical files

- **API:** `src/lib/email.ts` (new `sendOtpEmail` + template), `src/auth/auth.config.ts` (plugin + rate
  limits + invite-suppression move), new `src/auth/otp/{otp.controller,otp.service}.ts` + `dto`/`types`,
  wired into `AuthModule`. No new migration (reuses `verification`).
- **UI:** new `src/components/ui/input-otp.tsx`, `routes/auth/{sign-in,forgot-password,reset-password,
  verify-email}.tsx` + their `hooks/use-*.ts`, `lib/api-endpoints.ts` (add `OTP_ENDPOINTS`).
- **Docs:** note OTP flows in `docs/api-security.md`.

## Verification

- **Sign-up → verify:** register → 6-digit code email (not a link) → enter on verify screen →
  `emailVerified` true. Invite-suppression still skips the standalone code when an org/team invite exists.
- **Sign-in OTP:** "email me a code" → `/api/otp/send` → code → `/api/otp/sign-in` → session established
  (token/cookie propagated); password sign-in unchanged.
- **Password reset:** `/api/otp/reset-password/send` → code → `/api/otp/reset-password` → sign in with the
  new password; old `?token=` link not required.
- **Server path proven:** every send/verify runs through `auth.api.*` in the NestJS service (not the
  client); confirm via server logs and that the UI only hits `/api/otp/*`.
- **Limits/expiry:** wrong code 3× → `TOO_MANY_ATTEMPTS`; >5 min expired code rejected; send routes
  rate-limited.
- `pnpm --filter retro-tool-api type-check`/`lint`/`build`; `pnpm --filter retro-tool-ui
  type-check`/`lint`/`build`. Mock email path logs the OTP when `RESEND_API_KEY` is unset (local testing).
