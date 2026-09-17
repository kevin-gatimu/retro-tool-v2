# Caching strategy

> The frontend uses TanStack Query for client-side caching; the backend has no server-side cache layer — every API request reads PostgreSQL directly via Drizzle.

---

## Architecture overview

```
Browser
├── TanStack Query (in-memory cache, staleTime / gcTime per query)
│   └── on stale or invalidateQueries() → HTTP GET /api/...
└── Convex WebSocket (realtime snapshots)
    └── on snapshot update → queryClient.invalidateQueries(...)

API Server
└── NestJS service → Drizzle → PostgreSQL (direct read, no intermediate cache)
```

**There is no Redis cache layer.** Socket.IO (and the Redis adapter that would have fanned its
events out across instances) has been removed from the codebase entirely — no gateway files, no
`socket.io`/`socket.io-client` dependency. Convex is the sole realtime transport (see
[overview.md §3.2](./overview.md#32-realtime-convex-only)) and the self-hosted Convex deployment
handles its own WebSocket fan-out (no environment uses Convex Cloud). The throttler
(`ThrottlerModule.forRoot`) uses in-memory storage; there is
no shared throttler state across instances. No Redis container is defined in
`docker/docker-compose.local.yml` and no Redis resource is provisioned in the Azure Bicep infra.

---

## TanStack Query configuration

### Default settings

`QueryClient` uses default options with no global `staleTime` or `gcTime` overrides. Each query
sets its own timing.

### Query timing reference

| Query key                        | Endpoint                               | staleTime | refetchInterval | Notes                                                   |
| -------------------------------- | -------------------------------------- | --------- | --------------- | ------------------------------------------------------- |
| `['current-user']`             | `GET /api/users/me`                  | 60 s      | —              | Loaded at app root, used everywhere                     |
| `['notifications']`            | `GET /api/notifications`             | 30 s      | 30 s (polling)  | Global polling, all authenticated users                 |
| `['dashboard-stats']`          | `GET /api/retros/dashboard`          | 30 s      | —              | Dashboard home                                          |
| `['dashboard-retros']`         | `GET /api/retros/dashboard`          | 30 s      | —              | Recent retro list                                       |
| `['retro', retroId]`           | `GET /api/retros/:id`                | 5 s       | 3 s (active)    | Aggressive polling during active retro                  |
| `['estimate', sessionId]`      | `GET /api/estimates/:id`             | 5 s       | 3 s (active)    | Aggressive polling during active story estimate session |
| `['active-estimate-sessions']` | `GET /api/estimates/active`          | 30 s      | —              | Refetches on window focus                               |
| `['templates', ...]`           | `GET /api/retros/templates`          | 60 s      | —              | Template lists                                          |
| `['teams', ...]`               | `GET /api/teams`                     | 60 s      | —              | Team listings                                           |
| `['organizations']`            | `GET /api/organizations`             | 60 s      | —              | Sidebar + org pages                                     |
| `['team-metrics', teamId]`     | `GET /api/reports/teams/:id/metrics` | 60 s      | —              | Reports tab                                             |
| `['health-score', teamId]`     | `GET /api/reports/teams/:id/health`  | 60 s      | —              | Reports tab                                             |
| `['system-overview']`          | `GET /api/reports/system`            | 60 s      | —              | Admin dashboard                                         |

---

## Polling patterns

### Active polling (high frequency)

Retro boards and estimate sessions poll every 3 seconds while active. Because the backend reads
PostgreSQL directly, each poll at this interval generates a DB read unless the browser has a fresh
in-memory cache entry. Convex realtime (when `VITE_RETROS_REALTIME_BACKEND=convex`) is the
primary mechanism for reducing these reads — see below.

| Query                                    | Interval | When active                           |
| ---------------------------------------- | -------- | ------------------------------------- |
| Retro board (`['retro', id]`)          | 3 s      | During active retro sessions          |
| Estimates session (`['estimate', id]`) | 3 s      | During active story estimate sessions |
| Notifications (`['notifications']`)    | 30 s     | Always (all authenticated users)      |

### Passive polling (low frequency)

| Query            | Behavior                |
| ---------------- | ----------------------- |
| Active estimates | Refetch on window focus |
| Dashboard stats  | Refetch on stale (30 s) |
| Teams / orgs     | Refetch on stale (60 s) |
| Reports          | Refetch on stale (60 s) |

---

## Convex realtime — the primary read-reduction mechanism

When `VITE_RETROS_REALTIME_BACKEND=convex` (or the estimates/notifications equivalents), the
frontend subscribes to Convex projection queries instead of relying on polling alone. Convex
pushes snapshot updates over WebSocket after each NestJS mutation. The 3-second TanStack Query
poll becomes a safety net rather than the primary channel.

See [`docs/architecture/convex.md`](./convex.md) for the full projection topology.

---

## Convex-driven cache hydration

There are no Socket.IO namespaces or event handlers anymore. Instead, per-domain `*ConvexSync`
components (e.g. [`retro-convex-sync.tsx`](../../retro-tool-ui/src/routes/retros/components/retro-convex-sync.tsx),
[`estimate-convex-sync.tsx`](../../retro-tool-ui/src/routes/estimate/components/estimate-convex-sync.tsx),
[`notification-convex-sync.tsx`](../../retro-tool-ui/src/components/notification-convex-sync.tsx))
subscribe to a Convex projection query and call `queryClient.setQueryData()` directly with the
parsed snapshot whenever Convex pushes an update — writing the cache in place rather than
invalidating and triggering a REST refetch. One exception:
`notification-convex-sync.tsx` also calls `queryClient.invalidateQueries({ queryKey: ['teams'] })`
when a `team_join_approved` notification arrives, since membership isn't part of the notification
snapshot itself.

### Convex + polling redundancy

For retro boards and estimate sessions, both the Convex subscription and REST polling run
simultaneously. Convex provides near-instant updates via `setQueryData`; polling is the safety net
if a snapshot is missed or Convex is unreachable (see [Known gaps](#known-gaps)). No Redis is
involved — hydration flows directly through TanStack Query.

---

## Mutation invalidation cascades

When a mutation succeeds, the frontend invalidates related queries to keep the UI consistent:

| Mutation                          | Queries invalidated                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Retro card / vote / comment       | `['retro', retroId]`                                                                                      |
| Retro status change               | `['retro', retroId]`, `['retros']`, `['dashboard-retros']`                                            |
| Retro completed                   | `['retro', retroId]`, `['retros']`, `['dashboard-stats']`, `['team-metrics']`, `['health-score']` |
| Team member add / remove          | `['teams']`, `['sidebar-teams']`, `['org-teams', orgId]`                                              |
| Org member add / remove           | `['organizations']`, `['sidebar-organizations']`, `['organization', orgId]`                           |
| Notification read / delete        | `['notifications']`                                                                                       |
| Template create / update / delete | `['templates']`, `['org-templates', orgId]`                                                             |

---

## Known gaps

| Gap                                 | Detail                                                                                                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No server-side cache**      | Every API request hits PostgreSQL directly. High-frequency polling (retro board at 3 s × N participants) generates proportional DB load. Convex realtime is the architectural answer when`convex` backends are configured. |
| **In-memory throttler**       | `ThrottlerModule.forRoot` stores counters in-process — per-IP limits are per-instance and loosen under horizontal scale.                                                                                                   |
| **REST-only fallback if Convex is unreachable** | Socket.IO (and its cross-instance broadcast question) no longer exists, so there's no other realtime transport to fall back to — if a feature's Convex subscription can't connect, that feature drops to plain REST polling (or, for the always-on estimates backstop, stays on its 15 s poll) until Convex recovers. |
