# Auth Workflows — which files get hit

A file-level map of every authentication flow in the app: for each flow, the
exact UI → API → DB (→ Convex) path and the files touched, in order. This is the
**technical companion** to [app-flows.md](app-flows.md) §1 (which describes the
same flows at a product/behaviour level) and [RBAC.md](RBAC.md) (roles &
permissions). When the two disagree, trust the code references here.

## Stack

- **API:** NestJS + Better Auth via `@thallesp/nestjs-better-auth`, plugins:
  `bearer`, `admin`, `multiSession`, `emailOTP`, `passkey`, `jwt`. PostgreSQL via
  Drizzle. Microsoft OAuth.
- **UI:** React 19 + TanStack Router; Better Auth React client.
- **Realtime:** Socket.IO + Convex (Convex auth detailed in
  [convex-architecture.md](convex-architecture.md)).

## Key files that recur across flows

| File | Role |
| --- | --- |
| [auth.config.ts](../retro-tool-api/src/auth/auth.config.ts) | The Better Auth instance: all plugins, email/OTP/reset hooks, social providers, session & cookie config, rate limits. The heart of every flow. |
| [auth.module.ts](../retro-tool-api/src/auth/auth.module.ts) | Registers Better Auth (`forRootAsync`) → **global `AuthGuard` is active** (fail-closed); mounts `SignupCleanupMiddleware`. |
| [auth.controller.ts](../retro-tool-api/src/auth/auth.controller.ts) | Thin stubs; Better Auth middleware handles `/api/auth/*` before NestJS routing. |
| [otp/otp.controller.ts](../retro-tool-api/src/auth/otp/otp.controller.ts) + [otp.service.ts](../retro-tool-api/src/auth/otp/otp.service.ts) | Our `/api/otp/*` endpoints that proxy to `auth.api.*` (all `@AllowAnonymous`). |
| [auth/schema/index.ts](../retro-tool-api/src/auth/schema/index.ts) | Drizzle tables: `user`, `session`, `account`, `verification`, `passkey`, `jwks`, `adminActionLog`. |
| [configuration.ts](../retro-tool-api/src/config/configuration.ts) | Env parsing: auth secret/url, JWT issuer/audience, rpId/rpName, Microsoft, Convex. |
| [main.ts](../retro-tool-api/src/main.ts) | Global `api` prefix (health excluded), CORS, Helmet/CSP, cookie parser, OAuth state-cookie-lost fallback, `x-forwarded-for` backfill. |
| [lib/auth-client.ts](../retro-tool-ui/src/lib/auth-client.ts) | Better Auth React client; bearer-token capture/storage (private-window fallback); `passkeyClient()`, `jwtClient()`; `signOutWithCleanup`. |
| [lib/api.ts](../retro-tool-ui/src/lib/api.ts) | `apiFetch` — sends `credentials:'include'` + `Authorization: Bearer` (fallback). |
| [lib/api-endpoints.ts](../retro-tool-ui/src/lib/api-endpoints.ts) | Endpoint constants (`OTP_ENDPOINTS`, `USERS_ENDPOINTS`, …). |
| [routes/auth/hooks/](../retro-tool-ui/src/routes/auth/hooks/) | `use-sign-in`, `use-sign-up`, `use-forgot-password`, `use-reset-password`. |

**Auth route data flow (shared):** every browser auth call goes
`route component → hook → authClient.* or api.post(OTP_ENDPOINTS.*) → /api/auth/*
or /api/otp/* → Better Auth → Postgres`. Successful auth returns a session cookie
(+ `set-auth-token` header captured for the private-window bearer fallback).

---

## 1. Email / password sign-up

1. [sign-up.tsx](../retro-tool-ui/src/routes/auth/sign-up.tsx) → [hooks/use-sign-up.ts](../retro-tool-ui/src/routes/auth/hooks/use-sign-up.ts) → `authClient.signUp.email()`
2. `POST /api/auth/sign-up/email` — **`SignupCleanupMiddleware`** ([auth-signup.middleware.ts](../retro-tool-api/src/auth/auth-signup.middleware.ts)) first clears any stale `pending` user for a retry.
3. Better Auth creates rows in `user` (`status='pending'`, `role='member'`, `emailVerified=false`), `account`, `session`.
4. **Verification email**: `emailVerification.sendVerificationEmail` / `emailOTP.sendVerificationOTP` in [auth.config.ts](../retro-tool-api/src/auth/auth.config.ts) → [lib/email.ts](../retro-tool-api/src/lib/email.ts) (Resend). Suppressed if an active org/team invitation exists (`hasActiveInvitation`).
5. **First-user bootstrap**: use-sign-up.ts calls `POST /api/users/admin/bootstrap`; if no admin exists yet, the first user becomes `super-admin` + `approved` + `emailVerified`.

Tables: `user`, `account`, `session`, `verification`. Outcome: `pending` (awaits approval) unless first user.

---

## 2. Email / password sign-in

1. [sign-in.tsx](../retro-tool-ui/src/routes/auth/sign-in.tsx) → [hooks/use-sign-in.ts](../retro-tool-ui/src/routes/auth/hooks/use-sign-in.ts) `useSignIn` → `authClient.signIn.email()`
2. `POST /api/auth/sign-in/email` → Better Auth verifies password, creates `session`, sets cookie + `set-auth-token`.
3. **`resolveSignInOutcome()`** (use-sign-in.ts): waits for cookie, decides cookie vs bearer fallback (`testCookiesWorking`/`detectPrivateWindow`), then `GET /api/users/me`.
4. Status routing: `pending`/`rejected`/`suspended` → sign out + show status screen; `approved` → invalidate query cache → `/dashboard` (or `redirect`).

Tables: `session`, `user`. The shared success handler is reused by OTP and passkey sign-in.

---

## 3. Email-OTP passwordless sign-in ("Email me a sign-in code")

1. sign-in.tsx (`mode: 'request' → 'code'`) → use-sign-in.ts `useSendSignInOtp` / `useSignInOtp`.
2. `POST /api/otp/send` `{ email, type:'sign-in' }` → [otp.controller.ts](../retro-tool-api/src/auth/otp/otp.controller.ts) → [otp.service.ts](../retro-tool-api/src/auth/otp/otp.service.ts) `auth.api.sendVerificationOTP()` → `sendVerificationOTP` hook → email (6-digit, 5-min, 3 tries).
3. `POST /api/otp/sign-in` `{ email, otp }` → `auth.api.signInEmailOTP()`. The controller propagates `set-cookie` + `set-auth-token` to the response; the UI captures the bearer token, then runs the same `resolveSignInOutcome()` status flow as §2.

Tables: `verification` (OTP), `session`, `user`. Config: `emailOTP` plugin in auth.config.ts.

---

## 4. Passkey (WebAuthn)

**Sign-in:** sign-in.tsx passkey button (gated on `window.PublicKeyCredential`) → use-sign-in.ts `useSignInPasskey` → `authClient.signIn.passkey()` → `POST /api/auth/sign-in/passkey` (+ browser WebAuthn ceremony) → same status flow as §2. Conditional-UI autofill calls `authClient.signIn.passkey({ autoFill:true })` on mount.

**Management:** [profile/security.tsx](../retro-tool-ui/src/routes/profile/security.tsx) → [hooks/use-passkeys.ts](../retro-tool-ui/src/routes/profile/hooks/use-passkeys.ts) → `authClient.passkey.{listUserPasskeys,addPasskey,updatePasskey,deletePasskey}` → `/api/auth/passkey/*`.

Config: `passkey()` plugin in auth.config.ts (`rpID`/`rpName`/`origin` from [configuration.ts](../retro-tool-api/src/config/configuration.ts)). Table: `passkey`. Full design: [PASSKEY-PLAN.md](../PASSKEY-PLAN.md).

---

## 5. Microsoft OAuth

1. sign-in.tsx / sign-up.tsx → `authClient.signIn.social({ provider:'microsoft', callbackURL })` → `GET /api/auth/sign-in/microsoft` → Microsoft.
2. `GET /api/auth/callback/microsoft` → Better Auth exchanges the code, creates/links `account` + `user` + `session`. `accountLinking.trustedProviders:['microsoft']` auto-links by verified email (sets `emailVerified`).
3. [social-callback.tsx](../retro-tool-ui/src/routes/auth/social-callback.tsx): `GET /api/users/me` → bootstrap attempt → invitation redirect (`/auth/accept-invite`) or status routing as §2.
4. **State-cookie-lost fallback**: [main.ts](../retro-tool-api/src/main.ts) redirects API-root OAuth errors back to `/auth/sign-in?error=…`.

Tables: `account`, `user`, `session`, `verification`. OAuth stays **cookie-based** (redirects can't carry a bearer); the UI mints a bearer post-landing.

---

## 6. Email verification

[verify-email.tsx](../retro-tool-ui/src/routes/auth/verify-email.tsx) → `POST /api/otp/verify-email` `{ email, otp }` → otp.service.ts `auth.api.verifyEmailOTP()` → sets `user.emailVerified=true`. Resend via `POST /api/otp/send` `{ type:'email-verification' }`. Config: `emailVerification` + `emailOTP.overrideDefaultEmailVerification` in auth.config.ts. Suppressed when an active invitation exists (accepting it verifies the email).

Tables: `verification`, `user`.

---

## 7. Password reset

1. [forgot-password.tsx](../retro-tool-ui/src/routes/auth/forgot-password.tsx) → [hooks/use-forgot-password.ts](../retro-tool-ui/src/routes/auth/hooks/use-forgot-password.ts) → `POST /api/otp/reset-password/send` `{ email }`.
2. [reset-password.tsx](../retro-tool-ui/src/routes/auth/reset-password.tsx) → [hooks/use-reset-password.ts](../retro-tool-ui/src/routes/auth/hooks/use-reset-password.ts) → `POST /api/otp/reset-password` `{ email, otp, password }`.
3. otp.service.ts proxies to `auth.api.*`; Better Auth updates the password hash and **invalidates all existing sessions**. (Link-based reset via `sendResetPassword` → `/auth/reset-password?token=…`, 20-min expiry, also exists in auth.config.ts.)

Tables: `verification`, `user`, `session` (all revoked).

---

## 8. Session validation on every authenticated request

- **API:** the global `AuthGuard` (registered by `@thallesp/nestjs-better-auth` in [auth.module.ts](../retro-tool-api/src/auth/auth.module.ts), **not disabled**) is **fail-closed** — every route requires a valid session/bearer **unless** marked `@AllowAnonymous`. `/api/auth/*` is handled by Better Auth middleware before the guard.
- **Public routes** (`@AllowAnonymous`): `GET /health*`, `GET /users/admin/exists`, `GET /invitations/preview/:token`, and all `/api/otp/*`.
- **UI:** [lib/api.ts](../retro-tool-ui/src/lib/api.ts) `apiFetch` sends `credentials:'include'` and adds `Authorization: Bearer` when `shouldUseBearerToken()` (private-window fallback). Token comes from the `set-auth-token` header captured by [lib/auth-client.ts](../retro-tool-ui/src/lib/auth-client.ts).
- **Validation:** session cookie `better-auth.session_token` → row in `session` (unique `token`, `expiresAt` check). 7-day expiry, 1-day update age, 5-min cookie cache.

---

## 9. WebSocket auth

The three gateways —
[retros.gateway.ts](../retro-tool-api/src/retros/retros.gateway.ts),
[estimates.gateway.ts](../retro-tool-api/src/estimates/estimates.gateway.ts),
[notifications.gateway.ts](../retro-tool-api/src/notifications/notifications.gateway.ts)
— share an identical `handleConnection`: parse `better-auth.session_token` from
the handshake cookie, look it up in the `session` table, reject on missing/expired,
else stash `userId` on `client.data`. The notifications gateway also joins a
`user:{userId}` room. Client: [lib/socket.ts](../retro-tool-ui/src/lib/socket.ts)
connects with `withCredentials:true` (cookie-based; **no** bearer fallback yet —
see the deferred bearer migration in [AUTH-SECURITY-PLAN.md](../AUTH-SECURITY-PLAN.md)).

---

## 10. Sign-out

`signOutWithCleanup()` in [lib/auth-client.ts](../retro-tool-ui/src/lib/auth-client.ts):
clears the sessionStorage bearer token → `authClient.signOut()` → `POST
/api/auth/sign-out` revokes the `session` row + expires the cookie. UI clears the
query cache and returns to `/auth/sign-in`.

---

## 11. RBAC & approval lifecycle

User status: `pending → approved | rejected | suspended`. Sign-in (§2) checks it
on every login via `GET /api/users/me`. Admins approve/reject/suspend through the
users module (`PATCH /api/users/{id}/status`, suspend/reactivate endpoints),
writing `approvedAt`/`approvedById`/`suspendedReason` on `user` and an audit row
in `adminActionLog`. Roles (`super-admin → system-admin → member`, plus org/team
roles) and the full permission matrices live in [RBAC.md](RBAC.md).

---

## Cross-references

- **Behaviour-level walkthroughs:** [app-flows.md](app-flows.md) §1–2.
- **Roles & permissions:** [RBAC.md](RBAC.md).
- **API hardening (Helmet, rate limits, CSRF posture):** [api-security.md](api-security.md).
- **Convex JWT auth:** [convex-architecture.md](convex-architecture.md) §7, [AUTH-SECURITY-PLAN.md](../AUTH-SECURITY-PLAN.md).
- **Passkeys:** [PASSKEY-PLAN.md](../PASSKEY-PLAN.md). **Email-OTP:** [EMAIL-OTP-PLAN.md](../EMAIL-OTP-PLAN.md).
