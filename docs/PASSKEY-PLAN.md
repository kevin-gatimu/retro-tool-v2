# Passkey (WebAuthn) Passwordless Authentication Plan

> Add Better Auth's `passkey` plugin so users can sign in **passwordlessly with a passkey** (biometric /
> security key / platform authenticator) on the sign-in page, and **manage their passkeys**
> (list / add / rename / delete) on `/profile/security`. Ref: https://better-auth.com/docs/plugins/passkey

## Context

Passkeys become a third passwordless option that coexists with password sign-in, Microsoft OAuth, and the
planned email-OTP. `/profile/security` is the hub where users enable/disable passwordless methods.

Verified facts:

- `better-auth ^1.5.3` (UI) supports the plugin; `@thallesp/nestjs-better-auth` auto-mounts plugin
  endpoints under `/api/auth/*`.
- `/profile/security` **already has a "Passkeys" placeholder card** ("Set Up", no handler) in the
  `securityFeatures` array (`routes/profile/security.tsx`) — we replace it with a real section.
- `lib/auth-client.ts` has **no `plugins` array yet** — add `passkeyClient()`.
- No `passkey` table exists; one must be added + migrated (Drizzle `db:generate` / `db:migrate`).
- WebAuthn ceremonies **must** run in the browser (`navigator.credentials`), so registration/sign-in use
  the **client** plugin; the **server** (`passkey()` plugin) issues challenges, verifies attestation/
  assertion, and owns the `passkey` table. Unlike email-OTP, there is no server-only ceremony path.

Decisions: client-plugin ceremony + server validation; sign-in **button + Conditional-UI autofill**;
**full management** (list/add/rename/delete); deliver this doc **and** update `AUTH-SECURITY-PLAN.md` /
`EMAIL-OTP-PLAN.md`.

## API changes (`retro-tool-api`)

**1. Passkey plugin** — `src/auth/auth.config.ts`: add `passkey` from `better-auth/plugins` to `plugins`
(after `bearer()` / `admin()` / `multiSession()`):

```ts
passkey({
  rpID,                 // the UI domain, e.g. 'app.example.com' ('localhost' in dev)
  rpName: 'Retro-Tool',
  origin,               // the full UI origin, e.g. 'https://app.example.com'
})
```

- **rpID / origin must match the UI domain, not the API domain** (they deploy separately). Derive from
  `frontend.url`: `origin = frontend.url`, `rpID = new URL(frontend.url).hostname`. Add `auth.rpId` /
  `auth.rpName` to `config/configuration.ts` (rpId defaults from `FRONTEND_URL`, rpName defaults
  `'Retro-Tool'`).
- rpID is the **registrable domain** — no scheme/port. Passkeys are bound to rpID, so it must be stable
  across environments. If UI/API share a parent domain in prod (`app.` / `api.example.com`), rpID = the
  UI host.

**2. Passkey table** — `src/auth/schema/index.ts`: add the `passkey` pgTable per Better Auth's schema
(`id` PK, `name?`, `publicKey`, `userId` FK → `user.id`, `credentialID`, `counter` int, `deviceType`,
`backedUp` bool, `transports?`, `createdAt?`, `aaguid?`), matching the file's Drizzle style + an index on
`userId`. Then `pnpm --filter retro-tool-api db:generate` → new migration → `db:migrate`.

**3. Origins** — passkey endpoints sit under `/api/auth/*` (handled by BA middleware +
`trustedOrigins: allowedOrigins`); confirm the UI origin is in `allowedOrigins` (it is). The plugin
auto-mounts `/sign-in/passkey` and `/passkey/*` — no custom controllers/guards to add.

## UI changes (`retro-tool-ui`)

**1. Client plugin** — `lib/auth-client.ts`: add `plugins: [passkeyClient()]` (from
`better-auth/client/plugins`). Exposes `authClient.signIn.passkey(...)`, `authClient.passkey.addPasskey`,
`authClient.passkey.listUserPasskeys`, `authClient.passkey.deletePasskey`, `authClient.passkey.updatePasskey`.

**2. Sign-in page** (`routes/auth/sign-in.tsx`): add a **"Sign in with a passkey"** button beside the
Microsoft button (after the "Or continue with" divider) → `authClient.signIn.passkey()` then the existing
post-sign-in status handling (`/users/me`, pending/rejected/suspended) + bearer-token capture from
`use-sign-in.ts`. **Conditional-UI autofill**: add `autoComplete="webauthn"` to the email input and, on
mount, if `PublicKeyCredential.isConditionalMediationAvailable?.()` is true, call
`authClient.signIn.passkey({ autoFill: true })` so saved passkeys surface in the browser's autofill
dropdown. Factor the status/navigation logic in `use-sign-in.ts` so password and passkey reuse one success
path.

**3. Profile security page** (`routes/profile/security.tsx`): replace the static "Passkeys" entry with a
real **Passkeys management section** (own card, change-password-card style):

- On load `authClient.passkey.listUserPasskeys()` → list each (name, created date); badge **Enabled** when
  ≥1 exists, else **Disabled**.
- **Add**: dialog to name it → `authClient.passkey.addPasskey({ name })` (browser registration ceremony) →
  refresh + toast.
- **Rename**: dialog → `authClient.passkey.updatePasskey({ id, name })`.
- **Delete**: `alert-dialog` confirm → `authClient.passkey.deletePasskey({ id })` → refresh + toast.
- New hook `routes/profile/hooks/use-passkeys.ts` (TanStack Query list + mutations, mirroring
  `use-change-password.ts`). Reuse `dialog` / `alert-dialog` / `button` / `input`.
- Graceful "passkeys not supported" state when `window.PublicKeyCredential` is undefined.

## Cross-updates to existing plans

- **`AUTH-SECURITY-PLAN.md`** — Phase 5 currently marks the `passkey` table **N/A**. Update: passkeys are
  now in scope → add `passkey(userId)` to the Phase-5 index list and repoint the "passkey … N/A" line to
  this plan. (twoFactor stays N/A.)
- **`EMAIL-OTP-PLAN.md`** — add a one-line note that the sign-in page hosts **multiple** passwordless
  options (email-OTP code **and** passkey) and that `/profile/security` is where users manage them. No
  functional change to the OTP plan.
- **`/profile/security` = passwordless hub** — the single place users enable/disable passwordless methods
  (passkeys now; OTP / 2FA later).

## Critical files

- **API:** `src/auth/auth.config.ts` (plugin + rpID/origin), `src/auth/schema/index.ts` (passkey table) +
  new migration, `src/config/configuration.ts` (rpId/rpName).
- **UI:** `lib/auth-client.ts` (passkeyClient), `routes/auth/sign-in.tsx` (+ `hooks/use-sign-in.ts`
  refactor for a shared success path), `routes/profile/security.tsx`, new
  `routes/profile/hooks/use-passkeys.ts`.
- **Docs:** this `PASSKEY-PLAN.md`; edits to `AUTH-SECURITY-PLAN.md` + `EMAIL-OTP-PLAN.md`.

## Verification

- **Register (security page):** Add passkey → browser prompts (Touch ID / security key) → appears in the
  list; badge → Enabled; row persists after reload. Rename + delete work; deleting the last flips badge to
  Disabled.
- **Sign-in:** "Sign in with a passkey" → authenticator prompt → authenticated → dashboard, with the same
  status handling as password; bearer token captured. Conditional-UI: focusing the email field on a
  supporting browser offers the saved passkey.
- **rpID correctness:** registration/sign-in succeed on the deployed UI domain (not just localhost);
  document the per-domain binding so testers aren't surprised that a localhost-registered passkey won't
  work on the prod domain.
- **Cross-account isolation:** a passkey registered by user A cannot authenticate user B.
- **DB:** `db:generate` adds only the `passkey` table + index; migration applies cleanly.
- `pnpm --filter retro-tool-api type-check`/`lint`/`build`; `pnpm --filter retro-tool-ui
  type-check`/`lint`/`build`.
- **No-support fallback:** on a browser without WebAuthn, the sign-in button and security section show a
  graceful unsupported state rather than throwing.
