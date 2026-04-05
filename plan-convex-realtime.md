# Convex Realtime — Architecture, Implementation, and Data Flow Reference

_Last updated: March 28, 2026_

---

## Table of Contents

1. [How Convex Works](#1-how-convex-works)
2. [How Convex Is Implemented in This Project](#2-how-convex-is-implemented-in-this-project)
3. [Authentication Integration](#3-authentication-integration)
4. [Retros — Full Data Flow](#4-retros--full-data-flow)
5. [Story Estimate — Full Data Flow](#5-story-estimate--full-data-flow)
6. [Notifications — Full Data Flow](#6-notifications--full-data-flow)
7. [Feature Flags and Backend Toggle](#7-feature-flags-and-backend-toggle)
8. [Convex Schema Reference](#8-convex-schema-reference)
9. [Convex Functions Reference](#9-convex-functions-reference)
10. [API Sync Transport Reference](#10-api-sync-transport-reference)
11. [Remaining Risks and Open Work](#11-remaining-risks-and-open-work)

---

## 1. How Convex Works

Convex is a reactive backend-as-a-service with its own embedded database (backed by PostgreSQL in self-hosted deployments). It differs fundamentally from a traditional REST or GraphQL backend.

### 1.1 Query Subscriptions (Reactive Read Path)

Every Convex `query` function is a **live subscription**, not a one-shot fetch. When a client calls `useQuery(api.liveRetros.getRetroBoard, args)`:

1. Convex executes the query and sends the current result to the client immediately.
2. Convex records which documents the query touched (its dependency set).
3. When any of those documents are modified by any mutation, Convex automatically re-executes the query and **pushes the new result to every subscribed client** over a persistent WebSocket connection.
4. Clients receive updates with no polling, no explicit cache invalidation, and no client-side interval.

This is the core reactivity model — Convex maintains a per-query document dependency graph for every active subscription across all connected clients.

### 1.2 Mutations (Transactional Write Path)

A Convex `mutation` function runs inside a serialised, ACID transaction against the embedded database. It can read and write documents atomically. When the transaction commits:

- All subscribed queries that depend on the changed documents are automatically invalidated and re-executed server-side.
- Updated results are pushed over WebSocket to all subscribed clients.
- Typical round-trip from mutation call to UI update landing on all connected clients is 50–150 ms over a local or regional network.

### 1.3 Actions (External Side-Effects)

A Convex `action` runs outside a transaction and is suitable for calling third-party APIs, fetching URLs, or triggering other mutations. Actions do **not** have direct database access and must call mutations for any writes. No actions are used in this project yet — all current Convex functions are either queries or mutations.

### 1.4 Server Functions vs. HTTP Admin API

Convex exposes two distinct interfaces:

| Interface | Used by | Purpose |
|---|---|---|
| **Realtime client SDK** (`convex/react`) | Browser (`ConvexReactClient`) | Live query subscriptions and client-initiated mutations |
| **HTTP Admin API** (`POST /api/mutation`, `POST /api/query`) | NestJS API server | Push data into Convex from outside the Convex runtime |

The HTTP Admin API requires an admin key in the `Authorization: Convex <adminKey>` header. It accepts a JSON body `{ path, args, format: "json" }` and returns `{ status: "success" }` or `{ status: "error", errorMessage: "..." }`.

In this project:
- **NestJS uses exclusively the HTTP Admin API for writes** (pushing snapshots into Convex).
- **The browser uses exclusively the client SDK for reads** (live subscriptions to board snapshots).

### 1.5 Self-Hosting

This project runs a **self-hosted Convex instance**:

- The `convex-backend` process runs as a Docker container (locally via `docker-compose.local.yml`).
- Convex uses its own PostgreSQL database, separate from the NestJS application database.
- The Convex backend URL is distinct from the NestJS API URL.
- The browser connects to `VITE_CONVEX_URL` for WebSocket subscriptions.
- Local dev watch mode: `pnpm dev:convex` (or `pnpm --dir convex-backend dev`) watches source files and hot-reloads function changes.
- One-time push without watch: `pnpm --dir convex-backend exec convex dev --once`.

---

## 2. How Convex Is Implemented in This Project

### 2.1 Architecture Pattern: PostgreSQL-Primary + Convex Realtime Projection

This project uses **Option A** — PostgreSQL (via NestJS) is the **system of record** for all durable business state. Convex stores only **active collaboration snapshots** that the UI reads reactively.

The canonical data flow is:

```
User action in browser
  ↓
HTTP REST mutation → NestJS controller
  ↓
NestJS writes to PostgreSQL (source of truth)
  ↓
NestJS calls Gateway emit method
  ↓                              ↓
Socket.IO room emit         Convex projection sync service
(for Socket.IO clients)         ↓
                     POST /api/mutation → Convex HTTP Admin API
                                ↓
                     Convex upserts document in embedded DB
                                ↓
                     Convex notifies all subscribed browser clients
                                ↓
                     Browser receives snapshot over WebSocket
                                ↓
                     Sync component writes to TanStack Query cache
                                ↓
                     React re-renders — no REST GET fired
```

### 2.2 Project Package Structure

```
convex-backend/
  convex/
    schema.ts             — Table definitions and indexes (6 tables)
    server.ts             — Re-exports mutation/query helpers from convex/server
    liveRetros.ts         — Retro projection + board snapshot functions
    liveEstimates.ts      — Estimate projection + board snapshot functions
    liveNotifications.ts  — Notification projection functions
    auth.config.ts        — Auth provider config (currently empty)
    _generated/           — Auto-generated API bindings (do not edit)

retro-tool-api/src/
  retros/
    retros-projection-sync.service.ts   — NestJS service that syncs retro data to Convex
    retros.gateway.ts                   — Socket.IO + Convex emit fan-out
  estimates/
    estimates-projection-sync.service.ts — NestJS service that syncs estimate data to Convex
  notifications/
    notifications-projection-sync.service.ts — NestJS service that syncs notifications to Convex

retro-tool-ui/src/
  lib/
    convex-client.ts       — Singleton ConvexReactClient initialisation
    realtime-providers.tsx — <ConvexProvider> wrapper (conditional on VITE_CONVEX_URL)
    realtime-config.ts     — Feature flag helpers
  routes/retros/components/
    retro-convex-sync.tsx  — Headless component: subscribes + hydrates TanStack cache
  routes/estimate/components/
    estimate-convex-sync.tsx — Same pattern for estimates
```

### 2.3 UI — Client Bootstrap

`src/lib/convex-client.ts` creates a singleton `ConvexReactClient(VITE_CONVEX_URL)`. If the env var is absent, it returns `null` and Convex is disabled entirely.

`src/lib/realtime-providers.tsx` wraps the app in `<ConvexProvider client={client}>` when a client exists. If no client, renders children unwrapped — Convex is a no-op.

`src/main.tsx` renders `<RealtimeProviders>` as the outermost wrapper around `<RouterProvider>`.

### 2.4 UI — Feature Flags (`realtime-config.ts`)

`src/lib/realtime-config.ts` reads three env vars and exports boolean helpers:

| Env var | Controls | Helper function |
|---|---|---|
| `VITE_RETROS_REALTIME_BACKEND` | `socket-io` \| `convex` | `usesConvexForRetros()` |
| `VITE_ESTIMATES_REALTIME_BACKEND` | `socket-io` \| `convex` | `usesConvexForEstimates()` |
| `VITE_NOTIFICATIONS_REALTIME_BACKEND` | `socket-io` \| `convex` | `usesConvexForNotifications()` |

Additionally `isConvexConfigured()` returns `true` when a `VITE_CONVEX_URL` is present.

Setting a backend to `convex`:
- Activates the Convex subscription for that feature.
- Disables Socket.IO invalidation loops (`invalidateRetroDetail()` becomes a no-op).
- Removes background `refetchInterval` polling.
- Keeps Socket.IO for join/leave presence signals (still needed to register the user on the NestJS gateway).

### 2.5 UI — Convex Sync Components (headless)

Each feature has a dedicated render-null React component that:
1. Calls `useConvexQuery` to subscribe to a per-user board snapshot.
2. Deduplicates updates via a `lastUpdatedAtRef` ref (skips if `updatedAt` hasn't changed).
3. Parses the JSON snapshot and writes it into TanStack Query cache using `queryClient.setQueryData`.

**`RetroConvexSync`** (`retro-convex-sync.tsx`):
- Subscribes to: `liveRetros.getRetroBoard({ retroId, userId })`
- Hydrates: `['retro', retroId]` and `['retro-previous-carried', retroId]`
- Snapshot shape: `{ retro: RetroDetail, previousCarriedItems?: CarriedForwardItem[] }`

**`EstimateConvexSync`** (`estimate-convex-sync.tsx`):
- Subscribes to: `liveEstimates.getEstimateBoard({ sessionId, userId })`
- Hydrates: `['estimate-session', sessionId]`
- Snapshot shape: `{ session: EstimateSession }`

These components are mounted inside the detail page component trees and return `null`.

### 2.6 API — Projection Sync Services

Three NestJS services call the Convex HTTP Admin API using a shared private `runMutation(path, args)` helper:

```typescript
// Shared pattern in all three sync services
const response = await fetch(`${convexUrl}/api/mutation`, {
  method: 'POST',
  headers: {
    Authorization: `Convex ${adminKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ path, args, format: 'json' }),
})
```

**Key design decisions:**
- All sync calls are `void` (fire-and-forget). They do **not** throw and do **not** block the REST response to the client.
- Failures are logged as `Logger.warn` and swallowed. A Convex sync failure never causes a REST 500.
- Each service guards with `if (!convexConfig?.url || !convexConfig.adminKey) return` — safe to run with Convex disabled in any environment.

---

## 3. Authentication Integration

### 3.1 Current State: No Convex-Native Auth

`convex-backend/convex/auth.config.ts` declares `providers: []`. There is **no JWT provider configured**. Convex function calls are not authenticated at the Convex layer.

This means:
- Convex query subscriptions from the browser are **unauthenticated at the Convex layer**.
- Access control is enforced entirely by **NestJS before data reaches Convex**.
- The board snapshot that NestJS writes to Convex already contains only the data that the target `userId` is permitted to see.
  - NestJS calls `retrosService.getRetro(userId, retroId)` which enforces team membership and RBAC before building the snapshot.
- The browser queries Convex by `{ retroId, userId }` to retrieve the correct user-scoped snapshot.

### 3.2 How NestJS Auth Works

NestJS uses **Better Auth** with session cookies (`better-auth.session_token`). On every request the API reads the session cookie and resolves it to a `SessionUser` containing `user.id`.

The Socket.IO gateways (`RetrosGateway`, `EstimatesGateway`) extract the same session cookie from the Socket.IO handshake headers using a cookie regex parse:

```typescript
private extractToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(
    /(?:^|;\s*)better-auth\.session_token=([^;]+)/,
  )
  return match ? decodeURIComponent(match[1]) : null
}
```

The resolved `userId` is stored on `client.data.userId`. Connections missing or with expired sessions are disconnected immediately. Session lookups are cached in Redis (5-minute TTL, keyed by `CacheKeys.wsSession(token)`) to avoid per-event DB round-trips.

### 3.3 Future Auth Path

When Convex-native auth becomes necessary (e.g. to allow client-initiated mutations with identity enforcement inside Convex functions), the steps are:

1. Add a JWT provider to `auth.config.ts` pointing at the Better Auth JWKS endpoint.
2. Call `ctx.auth.getUserIdentity()` inside Convex functions to validate the caller.
3. Pass the browser's auth token to `ConvexReactClient` so subscriptions carry the identity.

This has not been implemented yet. The current design is safe because snapshot data is pre-filtered by NestJS and each user only receives their own scoped snapshot.

---

## 4. Retros — Full Data Flow

### 4.1 Page Load (Initial Bootstrap)

```
User navigates to /retros/:retroId
  → TanStack Router loader fires
  → queryClient.ensureQueryData({ queryKey: ['retro', retroId], staleTime: 5_000 })
  → GET /api/retros/:retroId  ← one-time REST bootstrap
  → NestJS: RetrosController.getRetro(userId, retroId)
  → RetrosService queries PostgreSQL (joins cards, columns, votes, comments, action items)
  → Returns full RetroDetail JSON
  → TanStack cache populated at ['retro', retroId]
  → RetroDetailPage renders

  On component mount:
  → POST /api/retros/:retroId/join  (fire-and-forget — records team membership, triggers snapshot sync)
  → RetroConvexSync mounts and subscribes to liveRetros.getRetroBoard({ retroId, userId })
  → If a snapshot already exists in Convex: TanStack cache immediately overwritten with latest board data
  → Subscription stays open — future board updates arrive automatically over WebSocket
```

In Convex mode:
- `refetchInterval` on the retro detail query is `false` → no background polling.
- `staleTime` on carried-forward query is `60_000` (1 minute) and `refetchInterval` is `false` → no polling there either.
- `invalidateRetroDetail()` and `invalidatePreviousCarried()` are no-ops.

### 4.2 Socket.IO Connection (Both Modes)

Regardless of Convex mode, the Socket.IO connection to `/retros` namespace is established on page mount and `join-retro` is emitted. This is needed so:
- The user is registered on the NestJS gateway room for Socket.IO fallback in non-Convex mode.
- The `join` HTTP POST triggers `emitRetroChanged` which publishes the first Convex snapshot for newly joined users.

In Convex mode, the Socket.IO event handlers (`retro-changed`, `discussion-card-changed`, etc.) that trigger `invalidateQueries` are **not registered** (early return at top of `useEffect`).

### 4.3 Phase Transitions

All phase transitions (`startLobby`, `startRetro`, `startGrouping`, `startVoting`, `moveToDiscussion`, `completeRetro`) follow the same fan-out pattern. Full example — **Move to Voting**:

```
User (creator) clicks "Start Voting"
  → useRetroMutations mutation fires

  [Optimistic update — zero latency for the actor]
  → queryClient.setQueryData(['retro', retroId], prev => ({ ...prev, status: 'voting' }))
  → UI renders voting phase immediately

  [HTTP mutation — persistence]
  → POST /api/retros/:retroId/voting
  → NestJS: RetrosController.moveToVoting(userId, retroId)
  → RetrosService.moveToVoting() → UPDATE retrospective SET status='voting' (PostgreSQL)
  → retrosGateway.emitRetroStatusChanged(retroId, 'voting')

  [Gateway fan-out — parallel]
  → Socket.IO: server.to('retro:retroId').emit('retro-changed', { retroId, status: 'voting' })
  → void retrosProjectionSyncService.syncRetroProjection(retroId)    ← async, non-blocking

  [syncRetroProjection]
  → SELECT id, teamId, status, currentDiscussionCardId, currentDiscussionActionItemId
    FROM retrospective WHERE id = retroId
  → POST Convex /api/mutation { path: 'liveRetros:upsertRetroProjection',
      args: { retroId, teamId, status: 'voting', updatedAt } }
  → Convex upserts liveRetroSessions document
  → syncRetroBoardSnapshots(retroId, teamId, updatedAt)

  [syncRetroBoardSnapshots — per team member, parallel]
  → SELECT userId FROM teamMember WHERE teamId = teamId
  → For each userId (Promise.all):
      → retrosService.getRetro(userId, retroId)                ← full detail from PostgreSQL
      → retrosService.getPreviousCarriedForward(userId, retroId)
      → POST Convex /api/mutation { path: 'liveRetros:upsertRetroBoard',
          args: { retroId, userId,
                  snapshot: JSON.stringify({ retro, previousCarriedItems }),
                  updatedAt } }

  [Convex reactive push to all subscribed browsers]
  → liveRetroBoards document for each userId updated
  → Convex re-executes getRetroBoard({ retroId, userId }) for every active client subscription
  → Updated result pushed over WebSocket to browser
  → RetroConvexSync.useEffect: board.updatedAt changed (differs from lastUpdatedAtRef)
  → JSON.parse(board.snapshot) → { retro, previousCarriedItems }
  → queryClient.setQueryData(['retro', retroId], parsed.retro)
  → queryClient.setQueryData(['retro-previous-carried', retroId], parsed.previousCarriedItems)
  → React re-renders — no REST GET fired

  onSuccess in mutation: invalidateRetroDetail() — no-op in Convex mode
```

### 4.4 Adding a Card

```
User types card content and submits
  → createCardMutation.mutate({ columnId, content })

  [Optimistic update]
  → Temp card { id: 'local-${Date.now()}', content, ... } inserted into localPendingCards state
  → Card appears immediately in the correct column

  [HTTP mutation]
  → POST /api/retros/cards  { retroId, columnId, content }
  → NestJS: RetrosController.createCard()
  → RetrosService inserts card into PostgreSQL
  → retrosGateway.emitRetroChanged(retroId)

  [Convex sync fan-out — same as phase transition above]
  → Snapshot updated for all team members including the real card id
  → Browser receives Convex push → local pending card replaced with real card

  onSuccess: invalidateRetroDetail() — no-op in Convex mode
```

### 4.5 Editing and Deleting Cards

```
  → editCardMutation / deleteCardMutation
  → PUT/DELETE /api/retros/cards/:cardId
  → NestJS updates PostgreSQL
  → retrosGateway.emitRetroChanged(retroId) → syncRetroProjection(retroId)
  → Snapshot fan-out → Convex push → UI updates
  → onSuccess: invalidateRetroDetail() — no-op in Convex mode
```

### 4.6 Merging Cards (Grouping Phase)

```
User drags card onto another card (DnD via @dnd-kit)
  → mergeCardsMutation.mutate({ cardIds, columnId })
  → POST /api/retros/cards/merge  { retroId, cardIds, columnId }
  → NestJS merges cards in PostgreSQL (creates grouped card)
  → retrosGateway.emitRetroChanged(retroId) → syncRetroProjection(retroId)
  → Snapshot fan-out → Convex push → UI renders merged card across all clients

  onSuccess: invalidateRetroDetail() — no-op in Convex mode
```

### 4.7 Voting Phase — Casting a Vote

```
User clicks thumbs-up on a card
  → voteCardMutation.mutate({ cardId })
  → POST /api/retros/cards/:cardId/vote
  → NestJS: RetrosController.voteCard(userId, cardId)
  → RetrosService.voteCard() → upsert vote in PostgreSQL
  → retrosGateway.emitRetroChanged(retroId) → syncRetroProjection(retroId)
  → Snapshot fan-out (vote counts are per-user-scoped in the snapshot)
  → Convex push → all clients see updated vote counts

  No follow-up REST GET in Convex mode.
```

### 4.8 Discussion Phase — Discussion Card Navigation

```
Facilitator advances to next card
  → discussionNextCardMutation.mutate()
  → NestJS: RetrosService.setCurrentDiscussionCard(retroId, cardId)
  → UPDATE retrospective SET currentDiscussionCardId = cardId (PostgreSQL)
  → retrosGateway.emitDiscussionCardChanged(retroId, cardId)
      → Socket.IO emits 'discussion-card-changed' to room
      → void syncRetroProjection(retroId) → snapshot fan-out

  Snapshot now contains updated currentDiscussionCardId.
  In Convex mode: Socket.IO 'discussion-card-changed' handler is not registered.
  Convex push delivers the updated snapshot → UI shows the new current card.
```

### 4.9 Discussion Phase — Action Item Progression

```
  → retrosGateway.emitDiscussionActionItemChanged(retroId, actionItemId)
      → Socket.IO emits 'discussion-action-item-changed' to room
      → void syncRetroProjection(retroId) → snapshot fan-out
  → Snapshot includes currentDiscussionActionItemId
  → Convex push → UI updates action item highlight
```

### 4.10 Carried-Forward Items from Previous Retro

Previous retro action items not yet completed (`GET /api/retros/:retroId/previous-carried-forward`) in Convex mode:

- Fetched **once at page load** when status is `discussing` or `completed`.
- `refetchInterval` is `false`, `staleTime` is `60_000` — no polling loop.
- `retrosGateway.emitCarriedForwardChanged(retroId)` calls `syncRetroProjection(retroId)` which includes `getPreviousCarriedForward(userId, retroId)` in the snapshot fan-out.
- `RetroConvexSync` writes the result to `['retro-previous-carried', retroId]` on every snapshot push.
- Marking an item as done uses `.setQueryData` for an optimistic filter, followed by `invalidatePreviousCarried()` which is a no-op in Convex mode — the Convex push delivers the authoritative state.

### 4.11 Retro Deletion

```
  → deleteRetroMutation.mutate()
  → DELETE /api/retros/:retroId
  → NestJS deletes retro from PostgreSQL
  → retrosProjectionSyncService.deleteRetroProjection(retroId)
      → POST Convex /api/mutation { path: 'liveRetros:deleteRetroProjection', args: { retroId } }
  → Convex deletes liveRetroSessions document AND all liveRetroBoards for this retroId
  → Active subscribers receive null (board no longer exists)
  → UI navigates away on mutation success
```

---

## 5. Story Estimate — Full Data Flow

### 5.1 Page Load (Initial Bootstrap)

```
User navigates to /estimate/:sessionId
  → TanStack Router loader fires
  → GET /api/estimates/:sessionId  ← one-time REST bootstrap
  → NestJS: EstimatesController.getSession(userId, sessionId)
  → Returns full EstimateSession JSON (rounds, votes, participants, timer state, etc.)
  → TanStack cache: ['estimate-session', sessionId]

  On component mount:
  → Socket.IO emit('join-session', { sessionId }) to /estimates namespace
  → EstimatesGateway.handleJoinSession: upsertParticipant(active=true) → PostgreSQL
  → emitSessionChanged(sessionId) → syncSessionProjection(sessionId) → Convex snapshot fan-out

  EstimateConvexSync mounts:
  → useConvexQuery(liveEstimates.getEstimateBoard, { sessionId, userId }) subscribes
  → If snapshot present: TanStack cache overwritten with latest data
  → Subscription stays open
```

In Convex mode `invalidate()` in `useSessionMutations` is a no-op; `refetchSession()` is only called in error handlers to revert optimistic updates.

### 5.2 Starting a New Round

```
Creator clicks "Start Round"
  → startRoundMutation.mutate(payload: EstimateRoundInput)
  → POST /api/estimates/:sessionId/rounds  { storyName, ticketNumber, ... }
  → NestJS: EstimatesController.startRound()
  → EstimatesService.startRound() → INSERT round, reset votes in PostgreSQL
  → estimatesGateway.emitSessionChanged(sessionId)

  [Gateway fan-out]
  → Socket.IO: emit 'session-changed' to session room
  → void estimatesProjectionSyncService.syncSessionProjection(sessionId)

  [syncSessionProjection]
  → SELECT id, teamId, status, currentRoundId FROM storyEstimateSession WHERE id = sessionId
  → POST Convex /api/mutation { path: 'liveEstimates:upsertSessionProjection',
      args: { sessionId, teamId, status, currentRoundId, updatedAt } }
  → syncSessionBoardSnapshots(sessionId, teamId, updatedAt)

  [syncSessionBoardSnapshots — per team member, parallel]
  → SELECT userId FROM teamMember WHERE teamId
  → For each userId (Promise.all):
      → estimatesService.getSession(userId, sessionId) ← full session detail from PostgreSQL
      → POST Convex /api/mutation { path: 'liveEstimates:upsertEstimateBoard',
          args: { sessionId, userId,
                  snapshot: JSON.stringify({ session }),
                  updatedAt } }

  [Convex push]
  → liveEstimateBoards document for each userId updated
  → getEstimateBoard subscription re-executed for all active client subscriptions
  → EstimateConvexSync hydrates ['estimate-session', sessionId]
  → UI shows new round in voting state across all participants — no REST GET

  onSuccess: invalidate() — no-op in Convex mode
```

### 5.3 Casting a Vote

```
User selects a story point card
  → castVoteMutation.mutate(points)

  [Optimistic update]
  → queryClient.setQueryData(['estimate-session', sessionId],
      prev => ({ ...prev, userVote: points }))
  → Selected card highlighted immediately

  [HTTP mutation]
  → POST /api/estimates/:sessionId/votes  { points }
  → NestJS: EstimatesController.castVote(userId, sessionId, points)
  → EstimatesService.upsertVote() → upsert vote row in PostgreSQL

  In Convex mode, Socket.IO emit('cast-vote') is NOT sent:
  if (!usesConvexRealtime) {
    getEstimateSocket().emit('cast-vote', { sessionId, points })
  }

  → estimatesGateway.emitSessionChanged(sessionId)
  → void syncSessionProjection(sessionId) → snapshot fan-out

  Per-user snapshots contain vote masking — each user only sees their own vote
  before reveal. NestJS enforces this in getSession before building the snapshot.

  onSuccess: no-op (cast vote success handler is intentionally empty)
  onError: refetchSession() — reverts optimistic update to server state
```

### 5.4 Removing a Vote

```
  → removeVoteMutation.mutate()
  → Optimistic: queryClient.setQueryData → userVote: null
  → DELETE /api/estimates/:sessionId/votes
  → NestJS deletes vote from PostgreSQL
  → emitSessionChanged → syncSessionProjection → snapshot fan-out → Convex push
  → onError: refetchSession() — revert
```

### 5.5 Revealing Votes

```
Creator clicks "Reveal"
  → revealVotesMutation.mutate()
  → POST /api/estimates/:sessionId/reveal
  → NestJS: EstimatesService.revealVotes()
    → UPDATE session.status = 'revealed', set all votes visible
  → emitSessionChanged(sessionId) → syncSessionProjection(sessionId)
  → Snapshot now includes all vote values exposed for all users
  → Convex push: all participants simultaneously see all votes revealed

  onSuccess: invalidate() — no-op in Convex mode
```

### 5.6 Timer

```
Creator sets a countdown timer
  → startTimerMutation.mutate(seconds)
  → POST /api/estimates/:sessionId/timer  { duration: seconds }
  → NestJS: EstimatesService.startTimer() → sets timerEndsAt timestamp in PostgreSQL
  → emitSessionChanged(sessionId) → syncSessionProjection(sessionId)
  → Snapshot includes timerEndsAt epoch ms
  → Convex push: all participants receive timerEndsAt simultaneously
  → Each client calculates remaining seconds from timerEndsAt locally
    (no per-tick sync needed — countdown is client-computed)

  onSuccess: invalidate() — no-op in Convex mode
```

### 5.7 Participant Join / Leave

```
User opens session page:
  → Socket.IO emit('join-session', { sessionId })  ← always, regardless of Convex mode
  → EstimatesGateway.handleJoinSession:
      → upsertParticipant(userId, sessionId, active=true) → PostgreSQL
      → emitSessionChanged(sessionId) → syncSessionProjection(sessionId)
  → All participants receive updated snapshot with new participant listed

User leaves / closes tab:
  → Socket.IO disconnect fires handleDisconnect
    OR Socket.IO emit('leave-session', { sessionId })
  → EstimatesGateway.handleLeaveSession:
      → upsertParticipant(userId, sessionId, active=false) → PostgreSQL
      → emitSessionChanged(sessionId) → syncSessionProjection(sessionId)
  → All participants receive updated snapshot with participant marked inactive
```

### 5.8 Session Deletion

```
  → DELETE /api/estimates/:sessionId
  → NestJS deletes session from PostgreSQL
  → estimatesProjectionSyncService.deleteSessionProjection(sessionId)
      → POST Convex /api/mutation { path: 'liveEstimates:deleteSessionProjection', ... }
  → Convex deletes liveEstimateSessions document AND all liveEstimateBoards for this sessionId
  → Active subscribers receive null → UI navigates away
```

---

## 6. Notifications — Full Data Flow

### 6.1 Notification Created

```
NestJS business logic creates a notification
  → NotificationsService.createNotification(userId, payload)
  → INSERT notification INTO PostgreSQL
  → notificationsProjectionSyncService.syncNotificationProjection(notification)
      → POST Convex /api/mutation { path: 'liveNotifications:upsertNotificationProjection',
          args: { notificationId, userId, type, title, message, link,
                  read: false, createdAt, updatedAt } }

  Browser (if VITE_NOTIFICATIONS_REALTIME_BACKEND=convex):
  → useConvexQuery(liveNotifications.listUserNotifications, { userId })
  → Convex detects new liveNotifications document
  → Re-executes listUserNotifications for this userId
  → Result pushed to browser
  → Notification bell badge increments, notification list updated — no polling
```

### 6.2 Mark Notification Read

```
User clicks a notification
  → PATCH /api/notifications/:id/read
  → NestJS: NotificationsController.markRead(userId, notificationId)
  → UPDATE notification SET read=true IN PostgreSQL
  → notificationsProjectionSyncService.syncNotificationReadState(userId, notificationId, true)
      → POST Convex /api/mutation { path: 'liveNotifications:markNotificationReadProjection',
          args: { notificationId, userId, updatedAt } }
  → Convex patches liveNotifications document { read: true }
  → listUserNotifications subscription re-executes → updated list pushed
  → getUnreadCount query re-executes → badge decrements
```

### 6.3 Mark All Notifications Read

```
  → notificationsProjectionSyncService.syncAllNotificationsRead(userId)
      → POST Convex /api/mutation { path: 'liveNotifications:markAllNotificationsReadProjection',
          args: { userId, updatedAt } }
  → Convex patches ALL liveNotifications documents for this userId to read=true
  → getUnreadCount returns 0 → badge clears
```

---

## 7. Feature Flags and Backend Toggle

### 7.1 Environment Variables

**UI** (`retro-tool-ui/.env` or `.env.local`):

```env
VITE_CONVEX_URL=http://localhost:3210
VITE_RETROS_REALTIME_BACKEND=convex            # or: socket-io
VITE_ESTIMATES_REALTIME_BACKEND=convex         # or: socket-io
VITE_NOTIFICATIONS_REALTIME_BACKEND=convex     # or: socket-io
```

**API** (`retro-tool-api/.env`):

```env
CONVEX_URL=http://localhost:3210
CONVEX_ADMIN_KEY=<key from convex deploy output>
```

### 7.2 Behaviour by Mode

| Feature | `socket-io` mode | `convex` mode |
|---|---|---|
| Background REST polling | Yes (3s on retro detail, 3s on carried-forward when discussing) | No |
| Socket.IO `join-retro` / `join-session` | Yes | Yes (still needed for presence) |
| Socket.IO invalidation handlers | Yes (`retro-changed`, `session-changed`, etc.) | Not registered |
| Convex board subscription | Not active | Active |
| Mutation `invalidate()` / `invalidateRetroDetail()` | Triggers REST refetch | No-op |
| Post-vote REST GET | Yes | No |
| Socket.IO `cast-vote` emit | Yes | No (HTTP only) |
| Snapshot hydration via `setQueryData` | No | Yes (via sync component) |

---

## 8. Convex Schema Reference

### `liveRetroSessions` — Lightweight retro projection

| Field | Type | Description |
|---|---|---|
| `retroId` | `string` | PostgreSQL retro UUID |
| `teamId` | `string` | PostgreSQL team UUID |
| `status` | union literal | `draft` \| `waiting` \| `active` \| `grouping` \| `voting` \| `discussing` \| `completed` |
| `currentDiscussionCardId` | `string?` | Active discussion card UUID |
| `currentDiscussionActionItemId` | `string?` | Active discussion action item UUID |
| `updatedAt` | `number` | Unix milliseconds timestamp |

Indexes: `by_retro_id ['retroId']`, `by_team_id ['teamId']`

### `liveRetroBoards` — Full per-user retro board snapshot

| Field | Type | Description |
|---|---|---|
| `retroId` | `string` | PostgreSQL retro UUID |
| `userId` | `string` | PostgreSQL user UUID — snapshot is user-scoped |
| `snapshot` | `string` | JSON-serialised `{ retro: RetroDetail, previousCarriedItems?: CarriedForwardItem[] }` |
| `updatedAt` | `number` | Unix milliseconds timestamp |

Indexes: `by_retro_id ['retroId']`, `by_retro_user ['retroId', 'userId']`

### `liveEstimateSessions` — Lightweight estimate projection

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | PostgreSQL session UUID |
| `teamId` | `string` | PostgreSQL team UUID |
| `status` | union literal | `waiting` \| `voting` \| `revealed` \| `completed` |
| `currentRoundId` | `string?` | Active round UUID |
| `revealedAt` | `number?` | Unix ms when votes were revealed |
| `updatedAt` | `number` | Unix milliseconds timestamp |

Indexes: `by_session_id ['sessionId']`, `by_team_id ['teamId']`

### `liveEstimateBoards` — Full per-user estimate session snapshot

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | PostgreSQL session UUID |
| `userId` | `string` | PostgreSQL user UUID — snapshot is user-scoped |
| `snapshot` | `string` | JSON-serialised `{ session: EstimateSession }` |
| `updatedAt` | `number` | Unix milliseconds timestamp |

Indexes: `by_session_id ['sessionId']`, `by_session_user ['sessionId', 'userId']`

### `liveNotifications`

| Field | Type | Description |
|---|---|---|
| `notificationId` | `string` | PostgreSQL notification UUID |
| `userId` | `string` | Recipient user UUID |
| `type` | `string` | Notification type string |
| `title` | `string` | Display title |
| `message` | `string` | Display message |
| `link` | `string?` | Optional deep link URL |
| `read` | `boolean` | Whether the notification has been read |
| `createdAt` | `number` | Unix milliseconds timestamp |
| `updatedAt` | `number` | Unix milliseconds timestamp |

Indexes: `by_notification_id ['notificationId']`, `by_user_id ['userId']`, `by_user_read ['userId', 'read']`

### `livePresence` — Defined, not yet wired

| Field | Type | Description |
|---|---|---|
| `scopeType` | `'estimate'` \| `'retro'` | Which feature |
| `scopeId` | `string` | Session or retro UUID |
| `userId` | `string` | Present user UUID |
| `displayName` | `string` | Name to display |
| `joinedAt` | `number` | Unix ms when user joined |
| `heartbeatAt` | `number` | Unix ms — updated periodically to detect stale presence |

Indexes: `by_scope ['scopeType', 'scopeId']`, `by_scope_user ['scopeType', 'scopeId', 'userId']`

---

## 9. Convex Functions Reference

### `liveRetros.ts`

| Export | Type | Description |
|---|---|---|
| `upsertRetroProjection` | mutation | Insert or patch `liveRetroSessions` document. Finds existing by `by_retro_id` index, patches if found, inserts if not. Returns `{ retroId, operation: 'created' \| 'updated' }`. |
| `deleteRetroProjection` | mutation | Deletes `liveRetroSessions` document **and all** `liveRetroBoards` for the same `retroId`. |
| `getRetroProjection` | query | Returns lightweight projection for a `retroId`, or `null`. |
| `listRecentRetroProjections` | query | Returns all projections sorted by `retroId`. Used for diagnostics/dashboards. |
| `upsertRetroBoard` | mutation | Insert or patch `liveRetroBoards` document keyed by `(retroId, userId)`. Collects all boards for the retroId then filters by userId. Returns `{ retroId, operation }`. |
| `getRetroBoard` | query | Returns board snapshot `{ retroId, snapshot, updatedAt }` for a `(retroId, userId)` pair, or `null`. This is the primary query subscribed to by `RetroConvexSync`. |

### `liveEstimates.ts`

| Export | Type | Description |
|---|---|---|
| `upsertSessionProjection` | mutation | Insert or patch `liveEstimateSessions` document. |
| `deleteSessionProjection` | mutation | Deletes `liveEstimateSessions` document **and all** `liveEstimateBoards` for the same `sessionId`. |
| `getSessionProjection` | query | Returns lightweight projection for a `sessionId`, or `null`. |
| `listActiveSessionProjections` | query | Returns all session projections sorted by `sessionId`. |
| `upsertEstimateBoard` | mutation | Insert or patch `liveEstimateBoards` document keyed by `(sessionId, userId)`. |
| `getEstimateBoard` | query | Returns board snapshot `{ sessionId, snapshot, updatedAt }` for a `(sessionId, userId)` pair, or `null`. Subscribed to by `EstimateConvexSync`. |

### `liveNotifications.ts`

| Export | Type | Description |
|---|---|---|
| `upsertNotificationProjection` | mutation | Insert or patch `liveNotifications` document. |
| `markNotificationReadProjection` | mutation | Patches a single notification `{ read: true, updatedAt }`. |
| `markAllNotificationsReadProjection` | mutation | Collects all notifications for `userId` and patches each to `{ read: true, updatedAt }`. |
| `listUserNotifications` | query | Returns notifications for a `userId`. Supports `unreadOnly: boolean` and `limit: number` args. Ordered by `createdAt` descending. |
| `getUnreadCount` | query | Returns the count of unread notifications for a `userId`. |

---

## 10. API Sync Transport Reference

### How NestJS Calls Convex (`runMutation`)

All three projection sync services share the same private `runMutation(path, args)` helper:

```typescript
const response = await fetch(`${convexConfig.url.replace(/\/$/, '')}/api/mutation`, {
  method: 'POST',
  headers: {
    Authorization: `Convex ${convexConfig.adminKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ path, args, format: 'json' }),
})
```

**Error handling:**
- `response.ok === false` → `Logger.warn` with status code, return (no throw).
- `result.status === 'error'` → `Logger.warn` with `result.errorMessage`, return (no throw).
- Any exception → caught, `Logger.warn` with message, return (no throw).

Convex sync failure **never** fails the REST response to the client.

### Gateway Emit Methods and Convex Triggers

Every `RetrosGateway` emit method triggers `syncRetroProjection` immediately after the Socket.IO emit:

| Gateway method | Socket.IO event emitted | Convex sync triggered |
|---|---|---|
| `emitRetroChanged(retroId)` | `retro-changed` | `syncRetroProjection(retroId)` |
| `emitRetroStatusChanged(retroId, status)` | `retro-changed` | `syncRetroProjection(retroId)` |
| `emitDiscussionCardChanged(retroId, cardId)` | `discussion-card-changed` | `syncRetroProjection(retroId)` |
| `emitDiscussionActionItemChanged(retroId, actionItemId)` | `discussion-action-item-changed` | `syncRetroProjection(retroId)` |
| `emitCarriedForwardChanged(retroId, actionItemId?)` | `carried-forward-changed` | `syncRetroProjection(retroId)` |
| `emitRetroListChanged()` | `retro-list-changed` (to all) | — (list-level, no detail sync) |

`EstimatesGateway.emitSessionChanged(sessionId)` → Socket.IO `session-changed` to session room + `syncSessionProjection(sessionId)`.

### Full Function Call Registry

| Convex function path | Called by |
|---|---|
| `liveRetros:upsertRetroProjection` | `RetrosProjectionSyncService.syncRetroProjection` |
| `liveRetros:upsertRetroBoard` | `RetrosProjectionSyncService.syncRetroBoardSnapshots` (one call per team member) |
| `liveRetros:deleteRetroProjection` | `RetrosProjectionSyncService.deleteRetroProjection` (on retro delete) |
| `liveRetros:getRetroBoard` | Browser via `RetroConvexSync` (live subscription) |
| `liveRetros:getRetroProjection` | Available — not yet wired to any UI component |
| `liveEstimates:upsertSessionProjection` | `EstimatesProjectionSyncService.syncSessionProjection` |
| `liveEstimates:upsertEstimateBoard` | `EstimatesProjectionSyncService.syncSessionBoardSnapshots` (one call per team member) |
| `liveEstimates:deleteSessionProjection` | `EstimatesProjectionSyncService.deleteSessionProjection` |
| `liveEstimates:getEstimateBoard` | Browser via `EstimateConvexSync` (live subscription) |
| `liveNotifications:upsertNotificationProjection` | `NotificationsProjectionSyncService.syncNotificationProjection` |
| `liveNotifications:markNotificationReadProjection` | `NotificationsProjectionSyncService.syncNotificationReadState` |
| `liveNotifications:markAllNotificationsReadProjection` | `NotificationsProjectionSyncService.syncAllNotificationsRead` |
| `liveNotifications:listUserNotifications` | Browser (notifications list component) |
| `liveNotifications:getUnreadCount` | Browser (notifications badge component) |

---

## 11. Remaining Risks and Open Work

### 11.1 Convex Auth Not Enforced at Query Level

Convex functions currently have no auth guard. Any client that knows a `(retroId, userId)` pair can subscribe to that board snapshot without authentication at the Convex layer. The current mitigation is that NestJS pre-filters data before writing to Convex — each user's snapshot only contains data they are authorised to see.

**Future fix:** Add a JWT provider to `convex-backend/convex/auth.config.ts` pointing at the Better Auth JWKS endpoint, then call `ctx.auth.getUserIdentity()` inside `getRetroBoard` and `getEstimateBoard` to validate that the subscribing client matches the requested `userId`.

### 11.2 Snapshot Staleness on Convex Outage

If a Convex sync call fails silently (network hiccup, Convex container restart), the board snapshot becomes stale. The UI has no automatic fallback to REST polling in Convex mode. Pages will show stale data until either the user refreshes or any team member's next successful mutation triggers a new snapshot fan-out.

**Mitigation options:** Add a background reconciliation job that re-publishes snapshots for all active sessions every N minutes. Or add a client-side staleness detector that falls back to a single REST fetch when the Convex subscription returns null for longer than X seconds after page load.

### 11.3 `livePresence` Table Not Wired

The `livePresence` schema and indexes are fully defined in `schema.ts` but no NestJS service writes to it and no UI component subscribes to it. Currently presence (who is in a session) is handled through Socket.IO participant join/leave events and the `storyEstimateParticipant` table in PostgreSQL.

Implementing presence via Convex would replace the Socket.IO participant model for estimates and add a real-time presence layer to retros.

### 11.4 Snapshot Fan-out Scale

The current model writes one Convex mutation per team member on every board change. For a team with 20 members, one NestJS mutation produces 20 parallel Convex HTTP Admin API calls, each preceded by a full `getSession(userId, sessionId)` PostgreSQL read. During high-frequency voting or discussion navigation, this amplifies DB read load proportionally to team size.

**Mitigation:** Consider a shared non-sensitive snapshot (visible state, same for all users) plus a small per-user supplement (my vote before reveal, my permissions). Or batch the fan-out with a Convex action that accepts the base data and writes per-user variants in one round-trip.

### 11.5 Socket.IO Still Running Alongside Convex

Both WebSocket channels remain active in Convex mode:
- NestJS Socket.IO gateway maintains and broadcasts to rooms even when the UI ignores those events.
- The browser still establishes the Socket.IO connection for the `join-retro`/`join-session` presence signal.
- Socket.IO invalidation handlers are not registered in Convex mode, but the connection open/close lifecycle still runs.

Future cleanup: retire Socket.IO subscriptions feature-by-feature using the existing feature flag as the gate, once per-feature Convex parity is confirmed stable.

### 11.6 `liveRetros:getRetroProjection` and `listRecentRetroProjections` Not Used in UI

These queries are exported and deployed but not wired to any UI component. They could be used to replace the retro list polling or to show a lightweight live status badge on the retros list page without loading full board snapshots.

## Executive Summary

This plan formalizes a dual-backend architecture and delivery model:

- NestJS remains the durable business backend.
- Convex becomes the realtime subscription and fanout backend.
- One Azure PostgreSQL Flexible Server is shared, with separate databases per backend and per environment.
- Delivery follows a develop to staging and main to production branch promotion strategy.
- Infrastructure is managed with Bicep for Azure staging and production.

The migration starts with Option A (Postgres-primary plus Convex projection) to reduce risk and allow staged rollout with rollback.

Your current stack already supports realtime with Socket.IO and cache-aside patterns, but active collaboration flows still pay a latency penalty from:

- Multi-query detail reads.
- Cache invalidation overhead.
- Polling fallback loops.
- Full-detail refetches after some mutations.

Convex is a strong fit for reducing perceived and actual latency in collaboration-heavy screens because:

- Query subscriptions are realtime by default.
- Query results are automatically cached.
- Mutations are transactional.
- Function boundaries support explicit auth and validation.

## Findings

### 1. Current architecture is realtime-capable but query-heavy

- API: NestJS + Drizzle + PostgreSQL, Socket.IO gateways, Redis adapter/cache.
- UI: TanStack Query + socket listeners + optimistic updates in some paths.
- Hottest collaboration features:
  - Retro detail board.
  - Story estimate live session.

### 2. Main latency contributors

- Detail endpoints compose many reads per refresh.
- Active views still rely on short refetch intervals as fallback.
- Several flows still invalidate and reload full query payloads.
- Under concurrent users, query fanout and repeated refetch amplify DB pressure.

### 3. Convex fit for this codebase

- Realtime subscriptions are built into query functions.
- Mutations run with transaction guarantees.
- Index design is essential for predictable performance.
- Actions should be reserved for external side effects, not core state transitions.

### 4. Self-hosted Convex plus PostgreSQL is viable

- Self-hosted Convex supports PostgreSQL-backed persistence.
- Regional co-location of Convex backend and PostgreSQL is critical for latency.
- The chosen Azure architecture supports local development, staging, and production with one consistent runtime model.

## Architecture Decision

### Option A: PostgreSQL Primary, Convex Realtime Projection (Recommended First)

#### Design

- PostgreSQL is the system of record for retros, estimates, reporting, and RBAC-driven domain state.
- Convex stores active collaboration projections for low-latency subscriptions (presence, votes, active board/session state).
- NestJS mutations write to Postgres first and publish projection updates to Convex through an idempotent sync contract.

#### Pros

- Lowest migration risk.
- Minimal disruption to existing APIs and reports.
- Clear rollback path by disabling Convex feature flags.

#### Cons

- Dual-write orchestration complexity.
- Requires outbox/retry and reconciliation safeguards.

### Option B: Convex Primary for Active Session State (Future Evaluation)

#### Design

- Convex owns active retro and estimate session state.
- Postgres remains durable store for history, analytics, and long-term records.

#### Pros

- Best realtime ergonomics and lowest collaboration latency.

#### Cons

- Larger rewrite scope and migration complexity.

## Recommendation

Start with Option A, measure outcomes in staging and production behind feature flags, then decide if selected active-session flows should move further toward Option B.

## Branching Strategy

### Branch Model

- main: production branch.
- develop: integration and staging branch.
- feature/*: short-lived feature branches from develop.
- hotfix/*: emergency branches from main, merged back to main and propagated to develop.

### Promotion Flow

1. feature/* to develop via PR.
2. Automatic deployment to staging on develop.
3. develop to main via PR after staging validation.
4. Automatic deployment to production on main after approval gate.

### Protected Branch Policy

#### develop required checks

- Lint, unit tests, integration tests.
- Build validation for retro-tool-api, retro-tool-ui, and convex-backend.
- Security/dependency checks.

#### main required checks

- All develop checks.
- Staging smoke tests pass.
- Migration readiness check passes.
- Manual release approval.

### Release and rollback policy

- Tag releases from main using semantic versioning.
- Keep image tags immutable for rollback.
- Require documented rollback steps for application and schema changes.
- For emergency fixes, use hotfix branches from main and merge back into develop after production stabilization.

## DevOps Delivery Plan

## Local: Docker Compose

Use local containers for parity and onboarding.

### Services

- postgres
- redis
- nest-api
- convex-backend
- convex-dashboard
- ui (optional containerized frontend)

### Database model

- One postgres server instance.
- Separate databases:
  - app_local
  - convex_local

### Note

Bicep is not used for local runtime. Docker Compose is the local infrastructure definition.

## Azure Staging: AKS + PostgreSQL Flexible Server

### Runtime

- AKS namespace: staging.
- Container images from ACR.
- Ingress host routing for UI, Nest API, Convex API, Convex site/actions, Convex dashboard.

### Database model

- Shared Azure PostgreSQL Flexible Server.
- Separate databases:
  - app_staging
  - convex_staging

### Secrets and observability

- GitHub Environment secrets for deployment configuration.
- Log Analytics + Application Insights.

## Production: AKS + Secrets + Private Networking

### Runtime

- AKS namespace: production.
- Same ingress pattern as staging with hardened policies.

### Database model

- Shared Azure PostgreSQL Flexible Server.
- Separate databases:
  - app_prod
  - convex_prod

### Security and reliability

- Secrets delivered via CI/CD app settings.
- Private networking and private endpoints where applicable.
- Same-region placement for AKS and PostgreSQL.
- Strict rollout and rollback runbooks.

### Environment mapping summary

- Local: developer workstations using Docker Compose.
- Staging: develop branch deployed to AKS staging namespace.
- Production: main branch deployed to AKS production namespace.

## AKS Ingress Plan

### Routing

- app.<env>.domain -> frontend service
- api.<env>.domain -> NestJS service
- convex-api.<env>.domain -> Convex API endpoint
- convex-site.<env>.domain -> Convex HTTP actions/site endpoint
- convex-dashboard.<env>.domain -> Convex dashboard endpoint

### Requirements

- TLS termination and certificate automation.
- Websocket upgrade support.
- Extended proxy timeout configuration for long-lived realtime connections.
- Restricted dashboard exposure in production.
- CORS-compatible forwarding and origin preservation.
- Stable service naming for UI, Nest API, Convex API, Convex site, and Convex dashboard.

## Bicep Plan

## Folder Structure

```
infra/
  bicep/
    modules/
      aks.bicep
      acr.bicep
      postgres-flexible-server.bicep
      log-analytics.bicep
      app-insights.bicep
      managed-identity.bicep
      role-assignments.bicep
      network.bicep
      private-dns.bicep
      private-endpoint.bicep
    environments/
      staging/
        main.bicep
        parameters.json
      production/
        main.bicep
        parameters.json
```

## Module Scope

- AKS cluster and node pools.
- ACR for image storage.
- PostgreSQL Flexible Server.
- Secrets and managed identities.
- Networking, private DNS, and private endpoint modules.
- Monitoring stack.

### Expected environment files

- infra/bicep/environments/staging/main.bicep
- infra/bicep/environments/staging/parameters.json
- infra/bicep/environments/production/main.bicep
- infra/bicep/environments/production/parameters.json

## Deployment Pipeline Expectations

1. what-if validation.
2. deploy.
3. post-deploy health and smoke validation.

### CI/CD expectations by branch

#### On pull requests to develop

- Run lint, tests, and builds for retro-tool-api, retro-tool-ui, and convex-backend.
- Validate Docker builds for containerized services.
- Run infrastructure lint and optional Bicep validation if infra changes are present.

#### On merge to develop

- Build and push images to ACR.
- Deploy to AKS staging.
- Run database migrations against app_staging.
- Run staging smoke tests.

#### On merge to main

- Require release approval.
- Build and push production-tagged images.
- Deploy to AKS production.
- Run migrations against app_prod.
- Execute smoke checks and canary verification.

## Backend Rewrite Scope

### NestJS responsibilities

- Durable writes and source-of-truth business state.
- RBAC authority and domain policy.
- Existing integrations, reports, digests.
- Outbox and projection sync publishing.

### Convex responsibilities

- Realtime subscriptions.
- Active collaboration projections.
- Presence and low-latency fanout.

### Sync strategy

- Postgres commit first.
- Projection update to Convex with idempotency key.
- Retry and reconciliation for drift correction.

### Data ownership model

- NestJS owns durable domain state, reports, permissions, and business workflows.
- Convex owns active collaboration projections, presence, and low-latency subscription reads.
- PostgreSQL remains the system of record during the first migration phase.

## Frontend Change Plan

1. Add Convex client/provider behind feature flags.
2. Migrate story estimate active read path to subscriptions first.
3. Migrate retro active board read path second.
4. Keep HTTP mutation path initially.
5. Introduce subscription-first with fallback to existing API refresh on Convex outage.

### Migration sequence recommendation

- Start with Story Estimate voting because it has high realtime value and lower migration complexity.
- Move to Retro board subscriptions after estimate flow stabilizes.
- Retire Socket.IO channels only after feature-level parity and fallback coverage are confirmed.

## Target Repository Structure

```
Retro-Tool/
  retro-tool-api/
  retro-tool-ui/
  convex-backend/
  packages/
    shared/
      contracts/
  infra/
    bicep/
  deploy/
    aks/
  docker/
  docs/
    architecture/
    devops/
```

### Responsibilities by folder

- retro-tool-api/: existing NestJS backend, plus new convex-sync and outbox/retry logic.
- retro-tool-ui/: existing frontend, plus Convex provider wiring, subscription hooks, and feature flags.
- convex-backend/: new self-hosted Convex app including schema, queries, mutations, auth config, and generated artifacts.
- packages/shared/contracts/: shared contracts between NestJS, Convex, and frontend.
- infra/bicep/: Azure infrastructure definitions for staging and production.
- deploy/aks/: manifests, Helm values, or deployment overlays for AKS runtime resources.

## Implementation Phases

### Phase 1: Governance and pipelines

1. Implement branch protections and required checks.
2. Add develop-to-staging and main-to-production workflows.

### Phase 2: Infrastructure baseline

3. Create Bicep modules and environment entry points.
4. Provision staging AKS, ACR, PostgreSQL, ingress prerequisites.

### Phase 3: Runtime setup

5. Add local docker compose stack.
6. Add convex-backend package and shared contracts package.

### Phase 4: Baseline and SLO definition

7. Define measurable targets for active retro and estimate sessions:
- p95 board/session initial load.
- p95 mutation-to-visible-update.
- DB query count per key interaction.
- Concurrent-user target per session.
8. Instrument current flows for baseline comparison.

### Phase 5: Convex data model and indexes

9. Create Convex schema for active collaboration entities only:
- Live retro snapshot.
- Live estimate snapshot.
- Presence state.
- Live vote state.
10. Define indexes for high-frequency access paths before rollout.
11. Define retention and archival boundaries back to Postgres.

### Phase 6: Backend sync contract

12. Implement deterministic projection sync contract:
- Commit in Postgres first.
- Publish projection update to Convex.
- Use idempotency keys per mutation.
13. Add retry-safe outbox or equivalent reliability mechanism for projection sync.
14. Add reconciliation job to detect and fix projection drift.

### Phase 7: Feature migration

15. Replace polling-heavy Story Estimate detail reads with Convex subscriptions first.
16. Migrate retro board active read path second.
17. Keep existing HTTP mutations initially and migrate the highest-frequency actions only after validation.
18. Run Socket.IO and Convex in parallel during transition and retire channels feature by feature after parity.

### Phase 8: Auth and RBAC parity

19. Integrate Convex auth with the existing token flow.
20. Mirror RBAC checks at function boundaries for org, team, and retro scopes.
21. Enforce secure JWT audience and issuer validation.

### Phase 9: Hardening and production rollout

22. Run performance, security, and failover drills.
23. Promote to main and production with canary and rollback readiness.
24. Roll out behind feature flags by organization or team.

## Verification Checklist

- Branch governance and CI checks enforce promotion policy.
- Staging and production ingress routing works for all endpoints.
- Websocket behavior is stable behind ingress.
- Migrations target correct databases per environment.
- Convex fallback path functions during outage drills.
- p95 session load and mutation-to-visible-update improve versus baseline.
- Security posture validated (GitHub Secrets, restricted dashboard, private networking).

### Additional validation scenarios

- Correctness under concurrency for votes, comments, merges, and presence churn.
- Resilience under partial outages such as Convex sync failure or temporary ingress disruption.
- Drift reconciliation tests between durable Postgres state and Convex projections.
- Production rollback drill using previous image tags and documented procedures.

## Risks and Mitigations

### Risk: Dual-write inconsistency

Mitigation:

- Idempotency keys.
- Outbox + retry worker.
- Reconciliation jobs.

### Risk: Runtime routing issues for realtime

Mitigation:

- Explicit ingress websocket settings.
- Timeout tuning and staged load testing.

### Risk: Auth drift between backends

Mitigation:

- Shared claim model.
- RBAC checks at function boundaries.
- JWT issuer/audience validation.

### Risk: Slow Convex queries from poor indexing

Mitigation:

- Index-first query design.
- Avoid broad scans on high-churn tables.
- Validate with load tests before full rollout.

### Risk: Duplicate event handling during transition

Mitigation:

- Feature-gated ownership of realtime channels.
- Strict handoff rules between Socket.IO and Convex per feature.

## Key Decisions

- Container platform: AKS for staging and production.
- Database topology: one postgres server, separate databases by backend and environment.
- Branch strategy: develop for staging, main for production.
- Migration strategy: Option A first, evaluate Option B later.

## Suggested First Slice

Implement the first production slice on Story Estimate voting:

- Highest collaboration frequency.
- Clear measurable latency improvements.
- Lower migration complexity than the full retro board.

After this is stable, migrate retro discussion and active board updates.

## Source Material Referenced

- Convex documentation covering tutorial, quickstarts, functions, validation, realtime, auth, database, indexes, hosting, and self-hosting.
- Self-hosted Convex guidance for PostgreSQL-backed persistence.
- Existing project plans and deployment assumptions already present in this repository.

## Expected Outcome

This plan delivers low-latency collaboration capabilities with controlled risk through phased migration, clear branch governance, AKS-based container operations, and Bicep-managed Azure infrastructure for staging and production.

It also preserves the stronger technical detail from the earlier integration plan so the document can be used as both an architecture decision record and an execution roadmap.
