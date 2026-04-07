# Convex Components — Integration Reference

This document covers the three Convex components integrated into this project:
`@convex-dev/rate-limiter`, `@convex-dev/aggregate`, and the Better Auth JWT bridge.

---

## Table of Contents

1. [Rate Limiter](#1-rate-limiter)
2. [Aggregate — Live Reports](#2-aggregate--live-reports)
3. [Better Auth JWT Bridge](#3-better-auth-jwt-bridge)
4. [Component Registration](#4-component-registration)
5. [Environment Variables](#5-environment-variables)
6. [Deployment Checklist](#6-deployment-checklist)

---

## 1. Rate Limiter

**Package:** `@convex-dev/rate-limiter`  
**File:** `convex-backend/convex/rateLimits.ts`

### Purpose

Protects Convex mutations from runaway fan-out bugs. If NestJS enters a pathological sync loop, 
Convex will reject writes beyond the configured threshold instead of endlessly accumulating documents.
It also protects against client-side subscription spam once Convex auth is enforced.

### Configured Limits

| Limit name | Algorithm | Rate | Period | Key | Shards |
|---|---|---|---|---|---|
| `retroBoardUpsert` | Token bucket | 10 | 1 second | `retroId` | 2 |
| `estimateBoardUpsert` | Token bucket | 10 | 1 second | `sessionId` | 2 |
| `notificationUpsert` | Fixed window | 50 | 1 minute | `userId` | — |

**Token bucket** allows short bursts (up to the capacity) while maintaining the average rate over time.  
**Shards: 2** distributes the rate limiter state across 2 documents, doubling the write throughput before contention occurs.

### How It Works

Each protected mutation calls:

```ts
await rateLimiter.limit(ctx, "retroBoardUpsert", { key: args.retroId, throws: true });
```

- If the current key is within the limit, the call proceeds normally.
- If the limit is exceeded, `throws: true` causes the mutation to throw a `ConvexError`, rolling back the entire transaction.
- The error is caught and logged as a warning in `RetrosProjectionSyncService.runMutation` without blocking the NestJS HTTP response.

### Protected Mutations

- `convex-backend/convex/liveRetros.ts` → `upsertRetroBoard`, `upsertRetroProjection`
- `convex-backend/convex/liveEstimates.ts` → `upsertEstimateBoard`, `upsertSessionProjection`
- `convex-backend/convex/liveNotifications.ts` → `upsertNotificationProjection`

### Adjusting Limits

Edit the `RateLimiter` config in `convex-backend/convex/rateLimits.ts` and re-deploy:

```ts
// Example: increase to 20/second for retros
retroBoardUpsert: { kind: "token_bucket", rate: 20, period: SECOND, shards: 4 }
```

---

## 2. Aggregate — Live Reports

**Package:** `@convex-dev/aggregate`  
**Files:** `convex-backend/convex/liveReports.ts`, `convex-backend/convex/convex.config.ts`

### Purpose

Maintains denormalized O(log n) counts for the reports dashboard instead of O(n) PostgreSQL
`COUNT` scans. Stats update reactively — a vote cast during a live retro increments the team's
vote counter on screen without a page refresh or REST poll.

### Architecture: Manual Lower-Level API

Because the source of truth is PostgreSQL (not Convex tables), the project uses the lower-level
`Aggregate` class (not `TableAggregate`). NestJS projection sync services call dedicated
`liveReports:upsert*Stat` mutations via the Convex HTTP Admin API after each business operation.

```
User action (vote, create card, complete retro)
  → NestJS controller handles the request
  → Creates/modifies DB row in PostgreSQL
  → void retrosProjectionSyncService.syncVoteCastStat(voteId, teamId, userId, createdAtMs)
  → POST convexUrl/api/mutation { path: "liveReports:upsertVoteStat", args: { ..., operation: "insert" } }
  → Convex aggregate B-tree updated
  → Browser subscriptions to getTeamStats / getUserStats reactively receive updated counts
```

### Aggregate Instances

| Instance | Sort Key | Document ID | Enables |
|---|---|---|---|
| `retrosCompletedByTeam` | `[teamId, completedAtMs]` | `retroId` | Retros completed per team in any date range |
| `cardsByTeamUser` | `[teamId, userId, createdAtMs]` | `cardId` | Cards per user, cards per team |
| `votesByTeamUser` | `[teamId, userId, createdAtMs]` | `voteId` | Votes per user, votes per team |
| `actionItemsByTeamStatus` | `[teamId, status, createdAtMs]` | `itemId` | Action item completion rate |
| `estimateSessionsByTeam` | `[teamId, completedAtMs]` | `sessionId` | Sessions completed per team |
| `systemRetros` | `[completedAtMs]` | `retroId` | Total retros across the system |
| `systemUsers` | `[createdAtMs]` | `userId` | Total users (populated via backfill or user creation hook) |

### Query API (Browser → Convex Subscription)

```ts
// All available queries in liveReports.ts:

// Team dashboard stats — reactive subscription
useQuery(api.liveReports.getTeamStats, {
  teamId: "...",
  sinceMs: Date.now() - 30 * 24 * 60 * 60 * 1000, // last 30 days
  untilMs: Date.now(),
})
// Returns: { retrosCompleted, cardsCreated, votescast, completedActionItems, pendingActionItems, estimateSessionsCompleted }

// Per-user stats within a team
useQuery(api.liveReports.getUserStats, {
  teamId: "...",
  userId: "...",
  sinceMs: ...,
  untilMs: ...,
})
// Returns: { cardsCreated, votesCast }

// System-wide stats (admin only)
useQuery(api.liveReports.getSystemStats, {})
// Returns: { totalRetros, totalUsers }
```

All three queries require an authenticated user (`ctx.auth.getUserIdentity()`).
`getSystemStats` additionally requires `identity.role === 'admin'`.

### NestJS Fan-Out Points

| Trigger | Method called | Convex mutation |
|---|---|---|
| `completeRetro` controller | `syncRetroCompletedStat(retroId)` | `liveReports:upsertRetroStat` insert |
| `createCard` controller | `syncCardCreatedStat(cardId, retroId, userId, createdAtMs)` | `liveReports:upsertCardStat` insert |
| `deleteCard` controller | `syncCardDeletedStat(cardId, retroId, userId, createdAtMs)` | `liveReports:upsertCardStat` delete |
| `voteForCard` controller | `syncVoteCastStat(voteId, teamId, userId, createdAtMs)` | `liveReports:upsertVoteStat` insert |
| `removeVote` controller | `syncVoteRemovedStat(voteId, teamId, userId, createdAtMs)` | `liveReports:upsertVoteStat` delete |
| `endSession` controller (estimates) | `syncSessionCompletedStat(sessionId)` | `liveReports:upsertEstimateSessionStat` insert |

All fan-out calls are fire-and-forget (`void`). Failures are logged as warnings but do not affect
the primary REST response. Convex sync failure = slightly stale aggregate counts, not a user-facing error.

### Backfill (One-Time Historical Data)

Run once after deployment to populate aggregates with historical data:

```http
POST /api/admin/reports/aggregate-backfill
Authorization: session cookie (system admin role required)
```

This reads all historical data from PostgreSQL and calls the corresponding Convex aggregate
mutations in batches. After the initial backfill, live fan-out keeps aggregates current.

> **Note:** The backfill endpoint is described in the reports module roadmap but is not yet implemented.
> Until then, `getTeamStats` will only reflect events that occurred after the Convex components were deployed.

### Throughput Considerations

- The aggregate B-tree can handle ~100 writes/second per instance before contention.
- For `votesByTeamUser` during a high-traffic voting session (many users voting simultaneously),
  the aggregate may queue briefly. This is acceptable since vote counts are not latency-critical
  for the aggregate (the live board snapshot already shows real-time vote counts via `liveReports`).
- If throughput becomes an issue, add `shards: N` to the affected aggregate instance in `convex.config.ts`.

---

## 3. Better Auth JWT Bridge

**Files:**  
- `convex-backend/convex/auth.config.ts` — Convex JWKS consumer config  
- `retro-tool-api/src/auth/auth.ts` — Better Auth server with `jwt()` plugin  
- `retro-tool-ui/src/lib/auth-client.ts` — Better Auth client with `jwtClient()` plugin  
- `retro-tool-ui/src/lib/realtime-providers.tsx` — Convex client auth wiring  

### Purpose

Allows Convex functions to call `ctx.auth.getUserIdentity()` to verify the caller's identity.
This enables per-user access control inside Convex queries — for example, preventing a user
from subscribing to another user's board snapshot.

**No data migration required.** PostgreSQL remains the user database. The JWT is only used
for identity verification inside Convex functions.

### Architecture

```
Browser                 Better Auth (NestJS)       Convex
─────────               ────────────────────────   ──────────────────────────
1. User signs in
   → POST /api/auth/sign-in
   → Session cookie set

2. UI requests JWT
   → GET /api/auth/token        ←── jwt() plugin serves this
   ← Returns { token: "eyJ..." }

3. Convex client authenticates
   → client.setAuth(fetchToken)
   → Convex sends JWT on each WebSocket mutation/query call

4. Convex verifies JWT
   → Fetches JWKS from ${BETTER_AUTH_URL}/.well-known/jwks.json
   → Validates RS256 signature
   → ctx.auth.getUserIdentity() returns { subject: userId, email, role }

5. Convex function checks identity
   → if (!identity || identity.subject !== args.userId) throw ConvexError("Forbidden")
```

### NestJS Better Auth — `jwt()` Plugin Config

```ts
// retro-tool-api/src/auth/auth.ts
jwt({
  jwks: {
    endpoint: "/.well-known/jwks.json",
    disablePrivateKeyEncryption: false,
    rotationInterval: "30d",         // rotate signing key every 30 days
    gracePeriod: "1d",               // old key accepted for 1 day after rotation
  },
  jwt: {
    issuer: process.env.BETTER_AUTH_URL,  // e.g. http://localhost:8000/api/auth
    audience: "retro-tool",
    expirationTime: "1h",            // short-lived; Convex SDK auto-refreshes
    definePayload: ({ user }) => ({
      role: user.role,               // included in identity.role inside Convex
    }),
  },
})
```

A new `jwks` table is created in PostgreSQL to store the rotating key pairs.  
Run `npx drizzle-kit push` (or the migration) to apply the schema change.

### UI Auth Client — `jwtClient()` Plugin

```ts
// retro-tool-ui/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [jwtClient()],
});
```

`authClient.token()` calls `GET /api/auth/token` and returns the current JWT.
The response is cached client-side until the token expires.

### Convex Auth Config

```ts
// convex-backend/convex/auth.config.ts
const authConfig: AuthConfig = {
  providers: [{
    domain: (import.meta as any).env?.CONVEX_BETTER_AUTH_URL ?? '',
    applicationID: "retro-tool",
  }],
}
```

Convex fetches `${domain}/.well-known/jwks.json` to obtain the public key(s) and caches them.  
On key rotation, Convex automatically re-fetches the JWKS endpoint.

### Setting the Convex Env Var

```bash
# Local dev (connect to self-hosted Convex):
npx convex env set CONVEX_BETTER_AUTH_URL http://localhost:8000/api/auth

# Staging / production:
npx convex env set CONVEX_BETTER_AUTH_URL https://api.retro-tool.com/api/auth
```

> **Docker Compose note:** Inside Docker, the Convex container cannot reach `localhost:8000`.
> Use the Docker service hostname instead:
> ```bash
> npx convex env set CONVEX_BETTER_AUTH_URL http://api:3000/api/auth
> ```

### Auth Guard in Convex Functions

All user-facing queries now enforce authentication:

```ts
// Example from liveRetros.ts
export const getRetroBoard = query({
  args: { retroId: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");
    if (identity.subject !== args.userId) throw new ConvexError("Forbidden");
    // ... proceed to fetch board snapshot
  },
});
```

### Token Lifecycle

| Event | Behaviour |
|---|---|
| User signs in | Session cookie set; no JWT yet |
| `ConvexProvider` mounts | `client.setAuth(fetchToken)` registered |
| Convex first subscription | `fetchToken` called → `authClient.token()` → GET /api/auth/token → JWT returned |
| JWT expires (1h) | Convex SDK calls `fetchToken` again → new JWT fetched transparently |
| Session expires (7 days) | `authClient.token()` returns null → Convex WebSocket disconnects → subscriptions end |
| User signs out | Session cookie cleared → same as session expiry |

---

## 4. Component Registration

All three components are registered in `convex-backend/convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();

// Rate limiter (single instance)
app.use(rateLimiter);

// One aggregate instance per metric namespace
app.use(aggregate, { name: "retrosCompletedByTeam" });
app.use(aggregate, { name: "cardsByTeamUser" });
app.use(aggregate, { name: "votesByTeamUser" });
app.use(aggregate, { name: "actionItemsByTeamStatus" });
app.use(aggregate, { name: "estimateSessionsByTeam" });
app.use(aggregate, { name: "systemRetros" });
app.use(aggregate, { name: "systemUsers" });

export default app;
```

> **Generated file dependency:** `convex-backend/convex/_generated/api.d.ts` must declare
> the matching `components` type for TypeScript to resolve aggregate/rate-limiter instances.
> This file is auto-generated by `npx convex dev` once the self-hosted Convex instance is running
> with this `convex.config.ts` loaded. Until then, `_generated/api.d.ts` is manually maintained
> to include the correct component types.

---

## 5. Environment Variables

### NestJS API (`retro-tool-api/.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `CONVEX_SYNC_URL` | Yes | `http://localhost:3210` | Convex backend sync URL used by API |
| `CONVEX_SYNC_ADMIN_KEY` | Yes | `convex-local\|abc123...` | From `./generate_admin_key.sh` output |
| `BETTER_AUTH_URL` | Yes | `http://localhost:8000/api/auth` | Must match issuer in JWT config |

### Convex (`npx convex env set ...`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `CONVEX_BETTER_AUTH_URL` | Yes (for auth) | `http://localhost:8000/api/auth` | Must be reachable FROM Convex container |

### UI (`retro-tool-ui/.env`)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_CONVEX_URL` | Yes | `http://localhost:3210` | Convex WebSocket URL for browser |
| `VITE_RETROS_REALTIME_BACKEND` | No | `convex` | `convex` or `socket-io` (default: `socket-io`) |
| `VITE_ESTIMATES_REALTIME_BACKEND` | No | `convex` | Same |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND` | No | `convex` | Same |

---

## 6. Deployment Checklist

### First-Time Setup

- [ ] `pnpm --dir convex-backend add @convex-dev/rate-limiter @convex-dev/aggregate`
- [ ] Set `CONVEX_SYNC_URL` and `CONVEX_SYNC_ADMIN_KEY` in `retro-tool-api/.env`
- [ ] Set `VITE_CONVEX_URL` in `retro-tool-ui/.env`
- [ ] Run `pnpm --dir convex-backend exec convex dev --once` to push functions and regenerate `_generated/api.d.ts`
- [ ] Set `CONVEX_BETTER_AUTH_URL` via `npx convex env set ...`
- [ ] Run the Drizzle migration to create the `jwks` table (`npx drizzle-kit push` or apply migration file)
- [ ] Enable at least `VITE_RETROS_REALTIME_BACKEND=convex` in UI env

### After Every Convex Function Change

- [ ] Ensure `pnpm dev:convex` (watch mode) is running **OR** run `pnpm --dir convex-backend exec convex dev --once` to push

### Verifying Rate Limiter Works

1. Open your retro page while Convex dev is running.
2. In the browser console, call `fetch('/api/retros/<id>/join', { method: 'POST' })` 15 times rapidly.
3. Check Convex dashboard logs — you should see `ConvexError: rate limited` on the 11th call for `retroBoardUpsert`.

### Verifying Aggregate Works

1. Complete a retro (moves to status `completed`).
2. Subscribe to `getTeamStats` for that team in the browser console:
   ```ts
   // In browser console with Convex client exposed:
   convexClient.subscribeQuery(api.liveReports.getTeamStats, { teamId: "..." }, (data) => console.log(data))
   ```
3. `retrosCompleted` should increment by 1.

### Verifying Auth Bridge Works

1. Sign in and open the retro page.
2. In the browser Network tab, find a WebSocket connection to `ws://localhost:3210`.
3. In the WS frames, confirm messages contain `"token": "eyJ..."` in the authenticate frame.
4. In Convex dashboard logs, `getRetroBoard` should show `identity.subject = <your userId>`.
5. In incognito (signed out), the retro page's Convex subscription should fail with `Unauthenticated`.
