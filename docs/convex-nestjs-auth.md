# Auth between Convex and the NestJS API

How the self-hosted/cloud Convex deployment trusts requests, given that the
**NestJS API (Better Auth) is the only identity authority** and Convex never
manages sessions or users. This doc explains the mechanism end to end: who issues
tokens, who verifies them, how keys are exchanged, and exactly which config makes
it work.

> **Scope:** the trust relationship between Convex and the API. For the broader
> Convex data model and sync layer see
> [convex-architecture.md](convex-architecture.md); for the app's other auth
> flows see [auth-workflows.md](auth-workflows.md); for the hardening rationale
> see [AUTH-SECURITY-PLAN.md](../AUTH-SECURITY-PLAN.md).

---

## Background: what are JWT and JWKS?

If you already know these, skip to [§1](#1-the-problem-this-solves).

### JWT — JSON Web Token

A **JWT** is a compact, self-contained credential: a string that carries some
claims (facts) about who the caller is, **cryptographically signed** so the
recipient can trust it wasn't forged or tampered with. It's three
Base64URL-encoded parts joined by dots — `header.payload.signature`:

```
eyJhbGciOiJSUzI1NiIsImtpZCI6IjRmMTAuLi4ifQ   ← header   {"alg":"RS256","kid":"4f10…"}
.eyJzdWIiOiJmMTYwMzNhYy0uLi4iLCJpc3MiOiJ…    ← payload  {"sub":"f16033ac-…","iss":"…","aud":"convex","exp":…}
.MEUCIQD… (binary signature, base64url)       ← signature
```

- **Header** — which algorithm signed it (`RS256` here) and a `kid` (key id) that
  says *which* key to verify against.
- **Payload (claims)** — the data. Standard claims used here: `sub` (subject — the
  user id), `iss` (issuer — who minted it), `aud` (audience — who it's for), `exp`
  (expiry), `iat` (issued-at). Plus our custom `role` claim.
- **Signature** — the header+payload signed with a secret/private key. **The
  payload is *not* encrypted** — anyone can read it (paste any JWT into
  [jwt.io](https://jwt.io)). The signature only proves **authenticity**: that a
  holder of the signing key produced exactly these claims.

**Symmetric vs asymmetric signing.** A JWT can be signed two ways:

- *Symmetric* (e.g. `HS256`): one shared secret both signs and verifies. The
  verifier needs the same secret the signer used — bad here, because Convex would
  need a secret the API holds.
- *Asymmetric* (e.g. `RS256`, what we use): a **key pair**. The API signs with the
  **private key** (never shared); anyone can verify with the matching **public
  key**. Convex only needs the public key, which is safe to hand out. This is why
  no secret crosses to Convex or the browser.

### JWKS — JSON Web Key Set

For asymmetric verification, Convex needs the API's **public key**. Rather than
hard-coding it (which would break on key rotation), the API publishes its public
keys at a standard endpoint as a **JWKS** — a JSON document listing one or more
public keys, each tagged with a `kid`:

```json
// GET /api/auth/jwks
{
  "keys": [
    { "kty": "RSA", "alg": "RS256", "use": "sig",
      "kid": "4f10e00a-…", "n": "iRJ5whw22f…", "e": "AQAB" }
  ]
}
```

To verify a token, Convex reads the token header's `kid`, finds the matching key
in the JWKS (`n`/`e` are the RSA public key components), and checks the signature.
Publishing keys this way means the API can **rotate** signing keys (add a new
`kid`, retire the old) without Convex needing reconfiguration — it just refetches
the JWKS. The private halves never leave the API (stored AES-encrypted in the
`jwks` table); only these public halves are exposed.

**In one line:** the API mints a **JWT** (signed proof of who the user is) and
publishes its public keys as a **JWKS**; Convex fetches the JWKS to verify the
JWT's signature without ever holding a shared secret.

---

## 1. The problem this solves

Convex is deployed as a **separate origin** from the API and runs the projection
queries the browser subscribes to. Before this mechanism existed, Convex had
`providers: []` — it was **completely unauthenticated**, so anyone with the public
`VITE_CONVEX_URL` could read any user's data by passing arbitrary IDs.

But the API owns all identity (Better Auth + Postgres). We do **not** want to:

- run Better Auth inside Convex (the official `@convex-dev/better-auth` component
  does this — it inverts our "Postgres is the system of record" rule); or
- share a session secret or the admin key with the browser.

The solution is standard **asymmetric JWT verification**: the API *signs*
short-lived tokens with a private key; Convex *verifies* them with the matching
public key it fetches from the API. No shared secret, no session lookups in
Convex, no business logic in Convex — it only checks "is this token validly signed
by our API, and who does it say the caller is?"

```
   ┌────────────┐   1. GET /api/auth/token        ┌──────────────────────┐
   │            │ ───────────────────────────────►│  NestJS API          │
   │  Browser   │   (cookie or bearer session)    │  (Better Auth)       │
   │  (UI)      │ ◄─────────────────────────────── │  - signs RS256 JWT   │
   │            │   2. { token } signed RS256      │    with private key  │
   └────┬───────┘                                  │  - serves JWKS       │
        │ 3. attach JWT to every Convex call       │    (public key)      │
        ▼                                          └──────────┬───────────┘
   ┌────────────┐   4. fetch JWKS (once, cached)              │
   │  Convex    │ ◄───────────────────────────────────────────┘
   │ deployment │   5. verify signature + iss + aud
   │            │   6. ctx.auth.getUserIdentity() → { subject, role }
   └────────────┘
```

The API and Convex **never talk directly about a specific user**. The only
server-to-server call is Convex fetching the API's public keys (step 4). Identity
travels entirely inside the signed token the browser carries.

---

## 2. The two halves

### API side — issuer (`retro-tool-api`)

The Better Auth `jwt` plugin, configured in
[auth.config.ts](../retro-tool-api/src/auth/auth.config.ts):

```ts
jwt({
  jwt: {
    issuer: jwtIssuer,          // = auth.jwtIssuer || BETTER_AUTH_URL (the API origin)
    audience: jwtAudience,      // = 'convex'
    expirationTime: '15m',
    definePayload: (session) => ({ role: session.user.role }),
  },
  jwks: { keyPairConfig: { alg: 'RS256', modulusLength: 2048 } },
})
```

This plugin auto-mounts two routes under Better Auth's `/api/auth` base path
(no controller needed — see [§6](#6-how-the-endpoints-are-mounted)):

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/token` | Returns `{ token }` — a fresh RS256 JWT for the **current session** (requires the caller to be authenticated by cookie or bearer). |
| `GET /api/auth/jwks` | Returns the **public** half of the signing key(s) as a JWKS document — unauthenticated, safe to expose. |

The RSA key pair is generated lazily and stored in the `jwks` Drizzle table
([auth/schema/index.ts](../retro-tool-api/src/auth/schema/index.ts), migration
`0015_dazzling_black_cat`); the private key is AES-encrypted at rest.

**Token claims** (verified by decoding a real token in this repo):

```json
{
  "iat": 1782339194,
  "role": "member",
  "sub": "f16033ac-…",                 // Better Auth user id
  "exp": 1782340094,                    // iat + 900s (15 min)
  "iss": "http://localhost:8000",       // = JWT_ISSUER
  "aud": "convex"                       // = JWT_AUDIENCE
}
```

Header: `{ "alg": "RS256", "kid": "<key id matching a JWKS entry>" }`.

### Convex side — verifier (`convex-backend`)

[convex/auth.config.ts](../convex-backend/convex/auth.config.ts):

```ts
const authConfig: AuthConfig = {
  providers: [
    {
      type: 'customJwt',
      applicationID: process.env.JWT_AUDIENCE ?? 'convex',
      issuer: process.env.JWT_ISSUER ?? '',
      jwks: process.env.JWT_JWKS_URL ?? '',
      algorithm: 'RS256',
    },
  ],
}
```

`type: 'customJwt'` (not `oidc`) means Convex takes the **JWKS URL directly** and
does **not** need a `/.well-known/openid-configuration` discovery document. On a
verified request, `ctx.auth.getUserIdentity()` resolves to an identity whose
`subject` is the JWT `sub` (= the Better Auth user id we store on projection rows).

---

## 3. The three config values that must line up

These are read by `process.env` **inside Convex functions**, so they live on the
**Convex deployment** (set via `convex env set`), not in any `.env` file. Each has
a distinct relationship to the API:

| Convex var | Must equal | Relationship | Checked how |
| --- | --- | --- | --- |
| `JWT_ISSUER` | the API's `iss` claim (= its `BETTER_AUTH_URL`) | **identity string** | exact string compare against the token's `iss` — never fetched |
| `JWT_AUDIENCE` | the API's `aud` claim (= `BETTER_AUTH_JWT_AUDIENCE`, default `convex`) | **identity string** | exact string compare against the token's `aud` |
| `JWT_JWKS_URL` | the API's `GET /api/auth/jwks` URL | **network address** | HTTP-fetched by Convex to get the public key |

Why `JWT_ISSUER` and `JWT_JWKS_URL` are **separate** vars even though both point at
the API: one is an *identity label* and the other is a *reachable address*, and
they legitimately differ in local Docker:

- `JWT_ISSUER = http://localhost:8000` — what the API stamps into the token (and
  what the browser-origin API actually is).
- `JWT_JWKS_URL = http://host.docker.internal:8000/api/auth/jwks` — because inside
  the Convex container, `localhost` is the *container itself*; it must reach the
  host-machine API via `host.docker.internal` (or the compose service name
  `http://nest-api:8000/api/auth/jwks`).

In deployed environments both use the public API host, e.g.
`https://retrotool-prod-api.azurewebsites.net` and
`…/api/auth/jwks`. Set these in [infra/README.md](../infra/README.md) step 7.

> **The #1 failure mode:** a byte-mismatch on `JWT_ISSUER` (extra trailing slash,
> `http` vs `https`, missing port). Verification then fails on the `iss` check and
> **every Convex query throws `Unauthenticated`**. To debug, decode a token from
> `GET /api/auth/token` at jwt.io and compare its `iss` to `convex env list`.

---

## 4. End-to-end request lifecycle

1. **User signs in** to the API normally (password / OTP / passkey / OAuth — see
   [auth-workflows.md](auth-workflows.md)). This establishes a Better Auth session
   (cookie, or bearer in private windows). Convex is not involved yet.

2. **UI obtains a JWT.** The Convex client is wrapped in `ConvexProviderWithAuth`
   in [realtime-providers.tsx](../retro-tool-ui/src/lib/realtime-providers.tsx).
   Its `useAuth` hook's `fetchAccessToken` calls:

   ```ts
   fetch(`${VITE_API_URL}/api/auth/token`, {
     credentials: 'include',                       // session cookie
     headers: shouldUseBearerToken()               // or bearer fallback
       ? { Authorization: `Bearer ${getBearerToken()}` } : {},
   })
   ```

   The API authenticates that request via the existing session and returns a
   15-minute JWT.

3. **UI attaches the JWT to Convex.** The Convex React client puts it in the
   WebSocket handshake and on each function call. The UI's sync components also
   gate on `useConvexAuth().isAuthenticated` so they don't fire a query before a
   token exists (avoiding a transient `Unauthenticated`).

4. **Convex fetches the public keys.** On first use (and cached afterward) Convex
   GETs `JWT_JWKS_URL` to retrieve the RSA public key whose `kid` matches the
   token header.

5. **Convex verifies the token** on every call: RS256 signature against the public
   key, `iss === JWT_ISSUER`, `aud === JWT_AUDIENCE`, and `exp` not passed.

6. **The function authorizes the caller.** Convex functions call
   `requireIdentity(ctx)` ([convex/lib/authz.ts](../convex-backend/convex/lib/authz.ts)),
   which returns `{ subject, role }` or throws `Unauthenticated`. Per-user reads
   compare `identity.subject` against the row's stored `userId`. It uses
   **`subject`** (the bare `sub`), not `tokenIdentifier` (which is `sub`+`iss` and
   wouldn't match the stored id).

7. **Token refresh.** The JWT lives 15 minutes; Convex calls `fetchAccessToken`
   again (with `forceRefreshToken`) to mint a fresh one from the still-valid
   session, so long-open boards stay authenticated.

---

## 5. This is NOT how NestJS → Convex writes are authed

Two completely different trust paths share the same deployment — don't conflate
them:

| | **Browser → Convex (reads)** | **NestJS → Convex (projection writes)** |
| --- | --- | --- |
| Auth | RS256 **JWT** (this doc) | `Authorization: Convex <CONVEX_SYNC_ADMIN_KEY>` (admin key) |
| Transport | Convex client / WebSocket | `POST {CONVEX_SYNC_URL}/api/mutation` HTTP |
| Callable functions | public `query`/`mutation` (with `requireIdentity`) | `internalMutation` / `internalQuery` (admin-key only) |
| Identity | derived from JWT `sub` | none — fully trusted server principal |
| Code | [realtime-providers.tsx](../retro-tool-ui/src/lib/realtime-providers.tsx) | [convex-admin.service.ts](../retro-tool-api/src/convex-admin/convex-admin.service.ts) `runMutation` |

The admin key bypasses the "internal functions aren't client-callable"
restriction, which is exactly why the server-driven `internalMutation`s stay
reachable by NestJS while being invisible to the browser. The JWT path, by
contrast, can only reach the public functions and is always scoped to one user.

---

## 6. How the endpoints are mounted (why there's no controller)

`/api/auth/jwks` and `/api/auth/token` are not NestJS routes you'll find in a
controller. They're produced by the Better Auth `jwt` plugin and served by the
`@thallesp/nestjs-better-auth` middleware:

- The `jwt` plugin registers the endpoints at `/jwks` and `/token`
  (`better-auth/.../plugins/jwt`), defaulting `jwksPath` to `/jwks`.
- Better Auth's default `basePath` is `/api/auth`
  (`better-auth/.../auth/base.mjs`), so they become `/api/auth/jwks` and
  `/api/auth/token`.
- `@thallesp/nestjs-better-auth` registers `toNodeHandler(auth)` as Express
  middleware for everything matching `/api/auth` and `/api/auth/*`, **before** the
  Nest router. That `/api` is Better Auth's own `basePath`, independent of Nest's
  global `api` prefix in [main.ts](../retro-tool-api/src/main.ts).

Because these are handled by the Better Auth middleware (not the Nest router),
they need no controller and no `@AllowAnonymous` — the global `AuthGuard` never
sees them.

So `${JWT_ISSUER}/api/auth/jwks` in the docs is just shorthand: `JWT_ISSUER` is
the API origin, and `/api/auth/jwks` is the auto-mounted route on it. Nothing
concatenates those two at runtime — Convex reads the literal `JWT_JWKS_URL` you
set.

---

## 7. Security properties & residual risk

**What this guarantees:**

- A request to Convex is rejected unless it carries a token **signed by our API's
  private key** (which never leaves the API / its DB).
- The token names a specific user (`sub`); functions enforce ownership on that,
  so user A cannot read user B's board/notifications even with a valid token.
- No shared secret crosses to the browser; the only thing public is the JWKS
  public key, which is meant to be public.
- Token theft is bounded to the **15-minute** TTL.

**Residual risks (accepted, tracked in [AUTH-SECURITY-PLAN.md](../AUTH-SECURITY-PLAN.md)):**

- **Revocation lag:** JWTs are stateless, so a signed-out or banned user retains
  Convex *read* access until the token expires (≤15 min). Acceptable for a
  read-only projection; don't raise the TTL.
- **Team-membership granularity:** Convex holds no team-membership data, so
  team-scoped reads (typing/ready/list projections, `getTeamStats`) enforce
  *authenticated* but not *member-of-this-team*. A membership projection is the
  follow-up.
- **XSS → token theft:** the JWT (and bearer fallback) live in `sessionStorage`;
  XSS could exfiltrate them. Mitigated by short TTL + CSP; the broader bearer
  migration is deferred (see the plan).

---

## 8. Setup & verification checklist

**Per Convex deployment (one-time, and whenever the API host changes):**

```bash
convex env set JWT_ISSUER   <API origin, byte-exact = BETTER_AUTH_URL>
convex env set JWT_AUDIENCE convex
convex env set JWT_JWKS_URL <API origin>/api/auth/jwks   # reachable from Convex
convex env list                                          # verify
```

(Local self-hosted: use `host.docker.internal` in the JWKS URL and target the CLI
at `CONVEX_SELF_HOSTED_URL`. Cloud: `CONVEX_DEPLOY_KEY` or the dashboard.)

**API side:** nothing required — `BETTER_AUTH_JWT_ISSUER` defaults to
`BETTER_AUTH_URL` and `BETTER_AUTH_JWT_AUDIENCE` to `convex`. Override only to
change them.

**Verify the chain:**

1. `curl <API>/api/auth/jwks` → a JSON `{ keys: [{ kty:"RSA", alg:"RS256", kid, … }] }`.
2. Authenticated `curl --cookie … <API>/api/auth/token` → `{ token }`; decode it and
   confirm `iss`/`aud`/`sub`/`alg` match the Convex env vars.
3. Sign in to the app and open a board/notifications — it should hydrate with **no**
   `Unauthenticated` errors in the Convex logs.
4. Cross-user check: a valid token for user A requesting B's board returns A's own
   (or null), never B's.

If step 3 fails with `Unauthenticated` on every query, the cause is almost always
a `JWT_ISSUER` mismatch (step 2's `iss` ≠ `convex env get JWT_ISSUER`) or a
`JWT_JWKS_URL` the Convex deployment can't reach.
