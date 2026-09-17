# API security

How the NestJS API (`retro-tool-api`) is hardened across the four areas of the
[NestJS security docs](https://docs.nestjs.com/security/helmet): Helmet, rate limiting, CORS, and CSRF.

## Helmet (response headers)

`helmet()` is applied globally in [`src/main.ts`](../../retro-tool-api/src/main.ts), **before** all other
middleware so it covers every response. It sets the standard hardening headers (`X-Content-Type-Options:
nosniff`, `X-Frame-Options`, HSTS over HTTPS, etc.).

The **Content-Security-Policy is intentionally relaxed** to let Swagger UI (`/api/docs`) render its
inline scripts/styles and data-URI images:

```
defaultSrc 'self'
scriptSrc  'self' 'unsafe-inline'
styleSrc   'self' 'unsafe-inline'
imgSrc     'self' data: https:
connectSrc 'self'
```

`crossOriginEmbedderPolicy` is disabled to avoid blocking cross-origin asset loads. HSTS only emits over
HTTPS, so it is a no-op in local dev.

## Rate limiting

Two layers, both per-IP:

1. **Global** — `@nestjs/throttler` (`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` in
   [`src/app.module.ts`](../../retro-tool-api/src/app.module.ts)) → ~100 requests/minute/IP across the
   whole API, enforced by a global `APP_GUARD`.
2. **Auth routes** — Better Auth's own stricter `rateLimit`
   ([`src/auth/auth.config.ts`](../../retro-tool-api/src/auth/auth.config.ts)) layered on top: 5 sign-ups /
   5 min, 10 sign-ins / min, 3 password resets / 5 min.

**Behind a proxy:** Azure App Service terminates TLS at a reverse proxy, so the real client IP arrives
in `X-Forwarded-For`. `main.ts` sets Express `trust proxy = 1`, and
[`ThrottlerBehindProxyGuard`](../../retro-tool-api/src/common/guards/throttler-behind-proxy.guard.ts) keys
the limit off `req.ips[0]` (falling back to `req.ip`). Without `trust proxy`, every request would appear
to come from the proxy and share one bucket.

**Exemptions:** `HealthController` is annotated `@SkipThrottle()` so liveness/readiness probes are never
limited. The throttler governs **HTTP only**; there is no WebSocket gateway left to worry about —
Socket.IO has been removed entirely and Convex (the sole realtime transport) is a separate service
with its own rate limiting (see [architecture/convex.md](../architecture/convex.md)).

## CORS

[`src/main.ts`](../../retro-tool-api/src/main.ts) calls `app.enableCors` with an **allow-list** of origins
(`credentials: true`) resolved from `ALLOWED_ORIGINS` (comma-separated), falling back to `FRONTEND_URL` +
`LOCAL_SERVER_URL`. In **production the app refuses to boot** if no origins resolve, rather than starting
with an empty/`undefined` list. There is no separate Socket.IO adapter to mirror this allow-list against
anymore — Socket.IO was removed entirely, and the browser's only realtime connection (Convex) is a
separate service authenticated by JWT rather than CORS (see
[security/convex-nestjs-auth.md](./convex-nestjs-auth.md)). Better Auth's
`trustedOrigins` is also set to the same list.

## CSRF

### What CSRF is

**CSRF (Cross-Site Request Forgery)** — also written XSRF and sometimes called a "confused deputy"
attack — tricks a logged-in user's browser into sending a state-changing request to an application
the user is authenticated with, **without the user intending it**. The application can't tell the
forged request apart from a genuine one, because it carries the victim's real credentials.

**Why it works — ambient cookie authentication.** When a browser holds a session cookie for
`api.example.com`, it attaches that cookie to **every** request to that origin automatically — no
matter which site caused the request. So if a victim is logged into our app and then visits a
malicious page, that page can trigger a request to our API and the browser will happily include the
victim's session cookie. The server sees a valid session and executes the action. The attacker never
sees the cookie or the response (the same-origin policy blocks reading it) — they don't need to. For a
state-changing action ("delete my org", "change my email", "promote this user"), **firing the request
is the whole attack**.

**A concrete walk-through:**

1. The victim signs into `app.example.com`; the browser stores the `better-auth.session_token` cookie.
2. While still logged in, the victim opens a malicious page (`evil.example`) — from a phishing email,
   an ad, a compromised site, etc.
3. That page silently issues a cross-site request to our API, e.g.:

   ```html
   <!-- auto-submits on load; no click needed -->
   <form action="https://api.example.com/api/users/me" method="POST">
     <input name="email" value="attacker@evil.example" />
   </form>
   <script>document.forms[0].submit()</script>
   ```

   or with `fetch('https://api.example.com/...', { method: 'POST', credentials: 'include' })`.
4. The browser **automatically attaches the victim's session cookie**. If nothing stops it, the API
   processes the request **as the victim**.

**What CSRF is NOT:**

- It is **not XSS.** XSS runs attacker JavaScript *inside* our origin (and can read responses/tokens);
  CSRF runs on a *different* origin and only forges requests — it can't read our responses.
- It targets **state-changing** requests (POST/PUT/PATCH/DELETE, or GETs with side effects). Safe,
  read-only GETs aren't the concern.
- It is fundamentally about **ambient credentials** (cookies, HTTP Basic, client certs) that the
  browser sends automatically. Auth schemes where the client must *explicitly* attach the credential
  (e.g. an `Authorization: Bearer` header set by JS) are **not vulnerable**, because a cross-site page
  cannot set that header on a request to our origin.

### Standard defenses (how CSRF is normally prevented)

- **SameSite cookies** — mark the session cookie `SameSite=Lax` or `Strict` so the browser won't send
  it on cross-site requests. This is the simplest defense, **but it fails when the cookie must be
  `SameSite=None`** (required when the UI and API are on different sites/subdomains and the cookie has
  to travel cross-site) — which is exactly our production setup.
- **CSRF tokens (synchronizer / double-submit)** — the server issues an unpredictable token the
  legitimate frontend must echo back in a header (e.g. `X-CSRF-Token`) or hidden field on every
  mutating request. A cross-site attacker can't read or guess the token, so forged requests are
  rejected. The NestJS-recommended [`csrf-csrf`](https://docs.nestjs.com/security/csrf) package
  implements the double-submit-cookie variant.
- **Header / token-based auth** — if the session is carried in an `Authorization` header that the
  frontend sets explicitly (rather than an auto-sent cookie), CSRF is **structurally impossible**: the
  browser never attaches that header to a cross-origin request a foreign page makes.
- **Origin / Referer allow-listing** — rejecting cross-origin requests at the CORS / `trustedOrigins`
  layer blunts browser-driven CSRF, but is considered a defense-in-depth measure rather than a
  complete substitute for tokens or SameSite.

### Current posture & residual risk

**No CSRF middleware is installed yet.** This is a deliberate, documented gap:

- Auth is **cookie-based** (`better-auth.session_token`). In production the UI and API live on different
  subdomains, so cookies are issued with `sameSite: 'none'; secure` — which means **SameSite provides no
  CSRF protection** for state-changing requests.
- Current mitigations: the CORS **origin allow-list** and Better Auth **`trustedOrigins`** reject
  cross-origin browser requests, which blunts (but is not a complete substitute for) CSRF defense.

**Residual risk:** a malicious site could attempt state-changing requests that ride the ambient session
cookie. The CORS allow-list mitigates browser-driven cross-origin calls, but cookie-auth without CSRF
tokens remains weaker than token-based auth.

**Recommended fix (future work):** the Better Auth **`bearer()` plugin is already enabled**. Have the
browser client store the session token and send it as `Authorization: Bearer <token>` instead of relying
on the ambient cookie. Custom headers cannot be attached to forged cross-site requests, so this
**structurally eliminates CSRF** without the moving parts of the double-submit-cookie pattern. If cookie
auth must stay, the alternative is the NestJS-recommended
[`csrf-csrf`](https://docs.nestjs.com/security/csrf) double-submit middleware (CSRF cookie +
`X-CSRF-Token` header), exempting `/api/auth/*` and any server-to-server webhooks.
