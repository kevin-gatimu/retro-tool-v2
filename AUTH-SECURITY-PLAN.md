# Secure Authentication: Threat Model + Phased Hardening Plan

> Scope: UI (`retro-tool-ui`) · API (`retro-tool-api`) · Convex (`convex-backend`) · DB (Postgres).
> All four deploy as **separate origins**. This document is the agreed plan; implementation happens in
> later approved phases.

## Context

A code audit of the current auth wiring — Better Auth in NestJS via `@thallesp/nestjs-better-auth`;
PostgreSQL as the system of record; Convex as a read **projection** that NestJS pushes to using an admin
key — found several real vulnerabilities. The most severe: **Convex is completely unauthenticated** (every
query/mutation is public; any client with the public `VITE_CONVEX_URL` can read any user's data by passing
arbitrary IDs).

Agreed direction:

1. **Convex** → JWT via Better Auth **JWKS** + per-call authorization (`ctx.auth.getUserIdentity()`).
2. **CSRF** → full **bearer-token** auth in the UI (OAuth stays cookie-based).
3. **API guards** → confirm the **global guard / fail-closed** posture and audit public routes.
4. **DB** → add Better Auth's recommended **indexes**.

## Code-verified findings (corrections to initial assumptions)

- **The global `AuthGuard` is ALREADY active.** `@thallesp/nestjs-better-auth` v2.6.0 registers
  `APP_GUARD: AuthGuard` in `forRootAsync` unless `disableGlobalAuthGuard: true` (not set here). The
  per-controller `@UseGuards(AuthGuard)` calls are therefore **redundant**, and the app is already
  fail-closed. Decision 3 is an **audit**, not a flip. The real risk is the inverse — a public route
  missing `@AllowAnonymous` would wrongly 401.
- **`/api/auth/*` is handled by Better Auth middleware before NestJS routing** — those routes never reach
  the guard; no `@AllowAnonymous` needed on them. Genuinely public app routes to confirm carry
  `@AllowAnonymous`: `GET users/admin/exists`, `GET invitations/preview/:token`, org/team invitation
  previews, `/health*`.
- **The `jwt()` plugin does NOT expose OIDC discovery.** It serves `/api/auth/jwks`, `/token`, `/sign`,
  `/verify` — but no `/.well-known/openid-configuration`, which Convex's provider validation requires. We
  will **serve a small hand-written `/.well-known/openid-configuration`** from the API pointing at
  `/api/auth/jwks` (avoids the heavier `oidc-provider` plugin).
- **JWT `iss`/`aud` default to `baseURL`** — must be **pinned explicitly** so the API-issued `iss`, the
  discovery doc `issuer`, and Convex's `domain` match byte-for-byte (trailing slashes included); `aud`
  must equal Convex's `applicationID`. Default signing alg is **EdDSA** — **verify Convex accepts it**,
  else set `jwks.keyPairConfig.alg` to `RS256`/`ES256`. (Verification gate before the Convex phase.)
- **OAuth (Microsoft) must stay cookie-based** — it is redirect/state-cookie driven; bearer can't apply to
  top-level navigations. The bearer migration is scoped to **fetch/XHR + sockets only**. After an OAuth
  callback the UI must mint a bearer/JWT via `GET /api/auth/token` on landing (the client `onSuccess`
  capture does not fire for full-page redirects); otherwise OAuth users are silently unauthenticated once
  cookie reliance is removed.
- **Sockets** currently hand-roll cookie parsing + raw `session`-table lookups per gateway. Migrate to
  `handshake.auth.token` validated via `auth.api.getSession`/`verifyJWT`, **additively** (accept token OR
  cookie during rollout). Confirm `estimates`/`notifications` gateways match `retros.gateway.ts`.
- **JWTs are stateless** → Convex authorization lags session revocation by the JWT TTL. Keep TTL short
  (5–15 min) and use `convex.setAuth(asyncFetcher)` that re-mints from the live session.

## Threat model

| # | Threat | Attacker | Impact | Current exposure | Mitigation (→ decision) | Layer |
|---|---|---|---|---|---|---|
| T1 | CSRF on cookie-authenticated mutations | Any site the victim visits while logged in | Forged state-changing API calls (create/delete retros, change roles, delete account) | **High** — prod cookies are `SameSite=None`; `apiFetch` sends `credentials:'include'`; no CSRF token | Bearer-only API + socket auth so a cross-site request can't attach the credential (→2) | UI |
| T2 | Convex IDOR / mass data exposure | Anyone with the public `VITE_CONVEX_URL` | Read any user's board, notifications, estimate projections via arbitrary IDs | **Critical** — `providers:[]`; every query takes IDs with zero identity check | JWKS provider + `ctx.auth.getUserIdentity()` + `subject===userId` / team-membership assert in every query (→1) | Convex + API |
| T3 | Direct Convex mutation calls by clients | Anyone with the Convex URL | Forge projection writes (mark others' notifications read, inject board snapshots, fake typing/ready) | **High** — `upsert*`/`startTyping`/`setReadyStatus` are public `mutation`s | Convert server-driven projections to `internalMutation` (admin-key only); client-driven ones require identity + ownership (→1) | Convex + API |
| T4 | Convex admin-key blast radius | Anyone who exfiltrates `CONVEX_SYNC_ADMIN_KEY` | Full read/write to all Convex data | **Med-High** — single all-powerful key in API env | Keep server-only, never log, rotate; `internalMutation` shrinks callable surface (→1) | API + Convex |
| T5 | Token-in-sessionStorage XSS | XSS via stored content (card text, names, messages) | Steal bearer/JWT → account takeover for token lifetime | **Med** (rises with bearer) | Tighten app-origin CSP (`'unsafe-inline'` only needed for Swagger), short JWT TTL, sanitize rendered content, keep sessionStorage over localStorage (cross-cuts 1+2) | UI + API |
| T6 | Missing-guard regression | Internal mistake / future PR | Sensitive route becomes public, or public route 401s | **Low** — fail-closed today | e2e test: protected routes 401 without auth, public set 200 (→3) | API |
| T7 | CORS gaps | Malicious origin | Read API responses cross-origin if allowlist loose | **Low** — explicit allowlist + prod fail-fast already; `Authorization` allowed | Keep; ensure `/jwks` + discovery reachable server-to-server by Convex (→1,2) | API |
| T8 | WebSocket auth weakness | Attacker with stale/forged cookie | Connect to gateways, join rooms, receive realtime data | **Med** — gateways reimplement cookie/session parsing | Token handshake via `auth.api.getSession`/`verifyJWT`; reject on null (→2) | UI + API |
| T9 | Rate-limit gaps | Brute force / projection spam | Compromise, resource exhaustion | **Low-Med** — Convex reads unthrottled; auth routes + global throttler already limited | T2 fix rejects unauth reads outright; optionally per-identity Convex query limits (→1) | Convex |
| T10 | Session fixation / revocation lag | Token obtained pre-auth or replayed post-logout | Continued access after logout/password change | **Med** with JWT (stateless) | Short JWT TTL + `setAuth` refetch; API/socket revocation immediate once on bearer (→1,2) | API + UI |
| T11 | OAuth state / login CSRF | Attacker initiating login CSRF | Account-linking abuse, login CSRF | **Med** — relies on state cookie; `main.ts` already has a "state cookie lost" fallback | Keep OAuth cookie-based (`SameSite=None;Secure`); capture bearer after callback; note `accountLinking.trustedProviders:['microsoft']` auto-links by verified email (→2 scoping) | API + UI |

## Phased implementation plan

Guiding rule: **add new auth paths before removing old ones; deploy the producer (API) before the
consumer (Convex/UI).**

### Phase 0 — Verify & document (no deploy)

- Confirm the global guard is live (hit a protected route with no auth → expect 401).
- Read `estimates.gateway.ts` and `notifications.gateway.ts` to confirm they match `retros.gateway.ts`.
- Decide JWT signing alg (EdDSA vs RS256/ES256) against current Convex JWKS support — **gate before Phase 3**.
- Write `docs/auth-threat-model.md`; update the CSRF section of `docs/api-security.md` to reference the
  bearer direction.

### Phase 1 — API: issue JWT + JWKS + OIDC discovery (additive, deploy alone)

- `auth/auth.config.ts`: add `jwt()` to plugins; set `jwt: { issuer, audience, expiresIn: <short> }` and
  `jwks.keyPairConfig.alg` if not EdDSA. Add issuer/audience keys to `config/configuration.ts`.
- New public `well-known.controller.ts` serving `GET /.well-known/openid-configuration`
  (`@AllowAnonymous`, excluded from the `api` global prefix in `main.ts` like `health`); body points
  `jwks_uri` → `${API}/api/auth/jwks`, `issuer` === JWT `iss`.
- Add the Better Auth `jwks` table schema + Drizzle migration.
- **Verify:** `/api/auth/jwks` returns keys; `/.well-known/openid-configuration` resolves; `GET
  /api/auth/token` returns a JWT whose decoded `iss`/`aud`/`sub` are correct. No client change → zero
  breakage.

### Phase 2 — UI + API: add bearer everywhere, keep cookies (additive)

- `lib/api.ts`: always attach `Authorization: Bearer` when a token exists (keep `credentials:'include'`
  during rollout).
- `lib/auth-client.ts`: bearer-primary; capture both `set-auth-token` and `set-auth-jwt`; add a
  post-OAuth `GET /api/auth/token` fetch on load.
- `lib/socket.ts`: add `auth: { token }` (keep `withCredentials` for now).
- API gateways: accept `handshake.auth.token` **or** cookie, validated via `auth.api.getSession`/
  `verifyJWT` (stop raw DB lookups).
- **Verify:** API + sockets work with cookies disabled; OAuth still completes and yields a bearer token.

### Phase 3 — Convex: validate JWT + per-call authz (deploy after Phase 1 is live)

- `convex/auth.config.ts`: `providers: [{ domain: <API issuer>, applicationID: <aud> }]`.
- `convex-client.ts`: `convex.setAuth(async () => await fetchConvexJwt())` (short-lived, auto-refresh).
- Every query in `liveRetros`/`liveNotifications`/`liveEstimates`: reject null identity; assert
  `subject === args.userId` (per-user) or team membership (retro/session — embed team ids via
  `definePayload` or add a membership projection).
- Convert server-driven `upsert*` to `internalMutation`; client-driven (`startTyping`/`setReadyStatus`)
  require identity + ownership. **Verify** the admin-key `/api/mutation` path can still invoke internal
  functions and the NestJS sync still writes.
- **Verify:** unauthenticated query → rejected; valid JWT for user A requesting B's data → rejected;
  legit → succeeds; projection sync still writes.

### Phase 4 — Remove cookie reliance (UI last)

- Drop `credentials:'include'`/`withCredentials` from fetch + sockets (keep cookies only for OAuth
  navigations). Remove gateway cookie fallback once all clients send tokens. Optionally delete the now
  redundant `@UseGuards(AuthGuard)` decorators.
- **Verify:** with cookies cleared (except mid-OAuth), API + socket + Convex all work; a cross-site
  credentialed `fetch` is rejected (CSRF gone).

### Phase 5 — DB index hardening (independent; can land any time)

Add Better Auth's recommended indexes where missing, then generate a Drizzle migration. This codebase
enables the **passkey** plugin (see [PASSKEY-PLAN.md](PASSKEY-PLAN.md)) but not the org/twoFactor Better
Auth plugins (those are custom tables), so:

| Table | Fields to index | Source |
|---|---|---|
| `user` | `email` | core |
| `account` | `userId` | core |
| `session` | `userId`, `token` | core |
| `verification` | `identifier` | core |
| `passkey` | `userId`, `credentialID` | passkey plugin |

Mirror the spirit of the org-plugin guidance on the **custom** tables where missing:
`organizationMember(userId, organizationId)`, `orgInvitation(email, organizationId)`,
`organization(slug)`, `teamMember(userId, teamId)`. The `passkey` indexes ship with the table created in
[PASSKEY-PLAN.md](PASSKEY-PLAN.md); the upstream `twoFactor` rows remain **N/A**.
Verify each index doesn't already exist; `pnpm --filter retro-tool-api db:generate`, then apply.

## Critical files

- **API:** `auth/auth.config.ts`, `auth/auth.module.ts`, `main.ts`, new `well-known.controller.ts`,
  `config/configuration.ts`, gateways (`retros`/`estimates`/`notifications`), Better Auth schema + new
  migration.
- **Convex:** `convex/auth.config.ts`, `liveRetros.ts`, `liveNotifications.ts`, `liveEstimates.ts`.
- **UI:** `lib/auth-client.ts`, `lib/api.ts`, `lib/socket.ts`, `lib/convex-client.ts`, post-OAuth token
  capture.
- **Docs:** new `docs/auth-threat-model.md`; update `docs/api-security.md`; pointers in `CLAUDE.md` /
  `AGENTS.md`.

## Verification summary

- **CSRF eliminated:** cross-origin `fetch('<API>/api/retros',{method:'POST',credentials:'include'})` with
  no Authorization → 401; cookie-only socket connect → disconnected.
- **Convex authz:** no/forged JWT → rejected; valid JWT for user A requesting B's data → rejected; legit →
  succeeds; NestJS projection sync still writes via admin key.
- **Guards fail-closed:** e2e — every route 401 without auth except the enumerated public set.
- **OAuth:** Microsoft sign-in (normal + private window) establishes a session **and** yields a working
  bearer token for subsequent API calls.
- **Sockets:** `auth:{token}` valid → connect + join; invalid/absent → disconnect; no cookie needed.
- **JWT correctness:** decoded `iss` === Convex `domain` === discovery `issuer`; `aud` === `applicationID`;
  `sub` === Better Auth user id; `alg` matches discovery; a successful authenticated Convex query is the
  end-to-end proof.
- **DB indexes:** generated migration adds only missing indexes; `EXPLAIN` on a session-by-token lookup
  uses the index; `type-check`/`lint`/`build` clean.
