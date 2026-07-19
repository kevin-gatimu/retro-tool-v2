# Frontend security

> How the React 19 UI (`retro-tool-ui`) handles credentials, what it exposes to the browser, and where the trust boundary sits.

## Overview

The UI is a **bearer-token-primary** client. On any auth response, it captures the session token from the
`set-auth-token` header and stores it in `sessionStorage`, then attaches it as `Authorization: Bearer <token>`
on every subsequent API, Convex-token, and realtime request. The Better Auth **session cookie is kept only as
a fallback** during the cookie→bearer rollout (`credentials: 'include'` is still sent). The UI enforces **no
security decisions of its own** — route guards and RBAC gating are UX conveniences; the NestJS API is the sole
trust boundary and re-checks auth and permissions on every request (see [`./backend-api.md`](./backend-api.md)
and [`./rbac.md`](./rbac.md)).

## Credential storage & transport

The bearer token lives in **`sessionStorage`** under the key `retro_tool_bearer_token`, managed by
[`src/lib/auth-client.ts`](../../retro-tool-ui/src/lib/auth-client.ts).

| Concern | Behaviour |
| --- | --- |
| **Where** | `sessionStorage` (per-tab, cleared when the tab/window closes) |
| **Why not `localStorage`** | `localStorage` persists indefinitely across sessions; `sessionStorage` scopes the token to the tab's lifetime, shrinking the theft window |
| **Why not cookie-only** | In production the UI and API sit on different subdomains, so the session cookie must be `SameSite=None` — which offers no CSRF protection. A header-attached bearer cannot be sent by a cross-site page, so it structurally sidesteps CSRF (see [`./backend-api.md`](./backend-api.md) CSRF section) |
| **Capture** | The `authClient` `fetchOptions.onSuccess` hook reads `set-auth-token` off any auth response and calls `storeBearerToken()` |
| **Attach — REST** | [`src/lib/api.ts`](../../retro-tool-ui/src/lib/api.ts) `apiFetch` reads `getBearerToken()` and sets `Authorization: Bearer <token>` when present |
| **Attach — auth client** | `authClient.fetchOptions.auth` uses a per-request token getter (`() => getBearerToken() ?? ''`), evaluated on each call so it picks up the token captured at sign-in; Better Auth omits the header when empty |
| **Attach — Convex token fetch** | [`src/lib/realtime-providers.tsx`](../../retro-tool-ui/src/lib/realtime-providers.tsx) attaches the same bearer when calling `GET /api/auth/token` |
| **Cookie role** | Every fetch still sends `credentials: 'include'`; the cookie is a fallback, not the primary credential |
| **Sign-out** | `signOutWithCleanup()` calls `clearBearerToken()` (removes the `sessionStorage` key) then `authClient.signOut()`. The pending/rejected/suspended sign-in paths also clear the bearer explicitly |
| **Private/incognito** | Cookies are blocked in private windows, so the app runs entirely on the bearer. `detectPrivateWindow()` probes `localStorage` writability; if cookies are absent but a bearer exists, the user is shown a non-blocking toast that the session won't persist after the window closes |

## What's exposed to the browser

All `VITE_*` variables are **inlined into the client bundle at build time and are therefore public** — anyone
can read them in the shipped JavaScript. The client schema is validated in
[`src/env.ts`](../../retro-tool-ui/src/env.ts) with a `clientPrefix: 'VITE_'` guard, so nothing without the
prefix reaches the client.

| Variable | Value type | Secret? |
| --- | --- | --- |
| `VITE_APP_TITLE` | Display string | No |
| `VITE_APP_ENV` | `local`/`development`/`staging`/`production` | No |
| `VITE_API_URL` | Public API base URL | No |
| `VITE_CONVEX_URL` | Public Convex deployment URL | No |
| `VITE_ESTIMATES_REALTIME_BACKEND` | `socket-io`/`convex` flag | No |
| `VITE_RETROS_REALTIME_BACKEND` | `socket-io`/`convex` flag | No |
| `VITE_ICEBREAKERS_REALTIME_BACKEND` | `socket-io`/`convex` flag | No |
| `VITE_STANDUPS_REALTIME_BACKEND` | `socket-io`/`convex` flag | No |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND` | `socket-io`/`convex` flag | No |
| `VITE_APP_VERSION` | Build version (CI-injected via `define`) | No |

**No secret-looking variable is exposed.** All API keys and signing secrets (`CONVEX_SYNC_ADMIN_KEY`,
`BETTER_AUTH_SECRET`, `RESEND_API_KEY`, VAPID private key, OAuth client secret) live only in the API's
server-side environment, never in `VITE_*`. The VAPID **public** key is not baked into the bundle — the UI
fetches it at runtime from `GET /api/notifications/push-vapid-key`.

## XSS & content injection posture

- **`dangerouslySetInnerHTML`: none found.** A repository-wide search of `retro-tool-ui/src` returns zero uses.
- **`innerHTML`: one read-only use** — `main.tsx` guards double-mount with `if (!rootElement.innerHTML)`. This
  is a truthiness check on the root node, not an assignment, so it introduces no injection surface.
- **`eval` / `Function`: none found.**
- **React default escaping** is the primary XSS control: all user-supplied content (card text, comments, names,
  standup entries) is rendered as JSX text, which React escapes by default.
- **The theme bootstrap inline `<script>` in [`index.html`](../../retro-tool-ui/index.html)** reads only its own
  `localStorage['theme']` value against a fixed allow-list (`light`/`dark`/`auto`) — it never interpolates
  untrusted input.
- **Content-Security-Policy: ABSENT.** There is no CSP anywhere in the UI delivery path — no `<meta
  http-equiv="Content-Security-Policy">` in `index.html`, no CSP in `vite.config.ts`, and the Azure Static Web
  App config ([`public/staticwebapp.config.json`](../../retro-tool-ui/public/staticwebapp.config.json)) sets
  only a navigation fallback, **no `globalHeaders`**. This is a real gap: if an XSS vector were introduced,
  there is no CSP backstop to constrain script execution or exfiltration. (Note the API's own relaxed CSP in
  [`./backend-api.md`](./backend-api.md) covers only API responses like Swagger, not the SWA-served UI.)

## Route / auth protection

Route protection is **client-side UX only** and lives in
[`src/routes/__root.tsx`](../../retro-tool-ui/src/routes/__root.tsx):

- **Unauthenticated redirect** — `AuthenticatedLayout` reads `authClient.useSession()`. While pending it renders
  a skeleton; once resolved with no session it redirects to
  `/auth/sign-in?redirect=<encoded current path>` via `window.location.href`. Public routes (`/`,
  `/termsofservice`, `/privacy-statement`) and any `/auth/*` route bypass the guard and render bare.
- **Account-status gating** — enforced at sign-in, not by a route guard. After a session is established,
  [`use-sign-in.ts`](../../retro-tool-ui/src/routes/auth/hooks/use-sign-in.ts) `resolveSignInOutcome()` calls
  `GET /api/users/me`; if `status` is `pending`, `rejected`, or `suspended` it immediately signs the user out
  (`authClient.signOut()` + `clearBearerToken()`) and routes back to sign-in with a status banner. The OAuth
  path ([`social-callback.tsx`](../../retro-tool-ui/src/routes/auth/social-callback.tsx)) applies the same
  pending/rejected sign-out logic.
- **RBAC-driven UI gating** — [`src/lib/rbac.ts`](../../retro-tool-ui/src/lib/rbac.ts) mirrors the backend role
  matrix and is used to show/hide admin nav, action buttons, and management panels. This is **presentation
  only** — it does not protect data. Every gated action re-hits the API, which enforces the authoritative check.
  See [`./rbac.md`](./rbac.md) for the full matrix.

## Realtime (Convex) auth from the browser

Convex is authenticated with a short-lived **RS256 JWT**, not the bearer token or cookie directly.
[`realtime-providers.tsx`](../../retro-tool-ui/src/lib/realtime-providers.tsx) wraps the app in
`ConvexProviderWithAuth`; its `fetchAccessToken` calls `GET /api/auth/token` (bearer-attached, cookie
fallback) to mint the JWT the API signs, and hands it to the Convex client. `authClient` enables the
`jwtClient` plugin, which also exposes `authClient.token()` for the same purpose. Convex's `customJwt`
provider verifies the token via the API's JWKS — full issue/verify lifecycle is documented in
[`./convex-nestjs-auth.md`](./convex-nestjs-auth.md).

## Known gaps / residual risk

| Gap | Risk | Notes |
| --- | --- | --- |
| **No CSP on the UI** | If any XSS vector is introduced, nothing constrains script execution, inline eval, or data exfiltration | `sessionStorage` bearer is readable by any script running in-origin — a CSP would be the main defence-in-depth layer and it is absent |
| **Bearer in `sessionStorage`** | Web-storage tokens are readable by any JavaScript on the page, so an XSS bug would expose the session token | Chosen over a cookie to eliminate CSRF; the trade is XSS exposure. Mitigated by React's default escaping and the absence of `dangerouslySetInnerHTML`/`eval`, but not by a CSP |
| **Cookie fallback is `SameSite=None`** | The still-sent session cookie offers no CSRF protection on its own | Acceptable because the bearer is primary and the API also relies on the CORS/`trustedOrigins` allow-list; see [`./backend-api.md`](./backend-api.md) |
| **Route guards are client-side** | A user can trivially bypass the redirect/RBAC hiding in devtools | Not a real gap — the API re-authorizes every request; UI gating is UX only |
| **DevTools panels bundled** | TanStack Router/Query devtools are included in the app tree | Cosmetic; they expose no additional secrets beyond the already-public client state |
