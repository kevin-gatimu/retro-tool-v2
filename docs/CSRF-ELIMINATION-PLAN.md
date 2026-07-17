# F6 — Eliminating the Residual CSRF Surface (Cookie Fallback)

How to finish what AUTH-SECURITY-PLAN.md deferred: bearer tokens are already the
**primary** credential for REST and sockets, but cookies are still **accepted as a
fallback**, so a `SameSite=None` session cookie can still ride along on a forged
cross-site request. This plan removes that surface without breaking OAuth or
active sessions. Work is UI + API only — no Azure changes.

## Current state (verified in code)

- `lib/auth-client.ts` attaches a dynamic bearer getter; token lives in `sessionStorage`.
- `lib/socket.ts` sends `auth: { token }` with `withCredentials` kept as rollout fallback.
- API/`WsAuthService` accept token **or** cookie via `auth.api.getSession`.
- Microsoft OAuth is inherently cookie-based during the redirect handshake; after
  `social-callback` the app continues on the session cookie (no bearer capture).
- Strict CSP is live (mitigates F10 token-theft-via-XSS in the meantime).

## Why "just disable cookies" is wrong

Three flows legitimately need cookies today: the OAuth redirect handshake
(Better Auth sets the session cookie on callback), the very first
`getSession` after OAuth (no bearer exists yet), and pre-auth endpoints
(sign-in/up/forgot-password have no credential at all). The fix is to make
every **authenticated** call bearer-only while leaving the pre-auth/OAuth
handshake endpoints cookie-capable but CSRF-safe by construction (they either
create sessions rather than use them, or are GETs).

## Phased rollout (each step independently deployable)

### Phase 0 — Instrument (API, 0.5 day)
Add a lightweight interceptor/log where `getSession` resolves from a cookie
with no bearer present, tagging route + user-agent. Deploy, watch for a few
days. This tells you exactly which clients/flows still depend on the fallback
and proves when it's safe to flip. Exit criterion: only OAuth-callback-adjacent
traffic remains.

### Phase 1 — OAuth post-redirect bearer capture (UI, 1 day)
In `routes/auth/social-callback.tsx`, after the redirect lands: call
`authClient.getSession()` once; the Better Auth `bearer()` plugin returns the
token in the `set-auth-token` response header — store it via the existing
`setBearerToken()` helper, then navigate. From that moment the OAuth user is on
bearer like password users. Also do the capture defensively in
`use-sign-in.ts`'s session bootstrap for any path that acquires a session
cookie without a stored bearer. Exit criterion: Phase 0 metric drops to ~zero.

### Phase 2 — Enforce bearer-only on authenticated REST (API, 1 day)
In the global auth guard path, when a request carries **only** a cookie:
- allow it for an explicit allowlist: `/api/auth/*` pre-auth + OAuth handshake
  endpoints (they must keep working cookie-based), and `GET /api/auth/token`
  + `GET /api/auth/get-session` (needed once, right after OAuth, from our own
  origin — enforce `Origin`/`Sec-Fetch-Site: same-origin` on these),
- reject everything else with 401 + a distinct error code the UI can react to
  (re-fetch token or force re-login).
Because deploys are additive (UI captured bearers in Phase 1 first), no active
user is logged out — their next request already carries a bearer.

### Phase 3 — Sockets drop cookie auth (API + UI, 0.5 day)
`WsAuthService`: stop falling back to the cookie header; require
`handshake.auth.token`. UI `lib/socket.ts`: remove `withCredentials`. Deploy
API after confirming socket handshakes carry tokens (they already do — the
fallback exists for rollout only).

### Phase 4 — Shrink the remaining cookies (API, 0.5 day)
For the session cookie that still backs the OAuth handshake window:
`SameSite=Lax` (the OAuth code/state flow tolerates Lax; only the cross-site
POST case dies, which is the point), `__Host-` prefix, and the shortest
workable TTL. If Better Auth's Microsoft flow proves Lax-incompatible in
staging, keep `None` but the Phase 2 allowlist already confines what a forged
request can reach: endpoints that only *create* sessions.

### Phase 5 — Delete the fallback code + regression tests
Remove the cookie branches in `WsAuthService` and any `credentials: 'include'`
left in `lib/api.ts`; add Jest tests asserting cookie-only requests to
protected routes return 401 and an e2e private-window sign-in test. Update
AUTH-SECURITY-PLAN.md (T1 → done) and SECURITY-ASSESSMENT.md (F6 → closed).

## Follow-on it unlocks (F10)

Once nothing needs the cookie fallback, the bearer can move from
`sessionStorage` to in-memory with a refresh-on-focus via `getSession` —
eliminating the XSS-readable storage location. Do this only after Phase 5, or
private-window multi-tab UX regresses.

## Effort & order

~4 dev-days spread over 2–3 weeks (Phase 0's observation window dominates).
Deploy order is fixed: 0 → 1 (UI) → 2 (API) → 3 → 4 → 5. Each phase is
independently revertible; nothing requires simultaneous UI+API deploys.
