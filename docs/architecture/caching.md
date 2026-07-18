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

**There is no Redis cache layer.** The Socket.IO adapter in
`retro-tool-api/src/adapters/socket-io.adapter.ts` logs `"Redis adapter disabled"` at startup —
no `@socket.io/redis-adapter` is wired in. The throttler (`ThrottlerModule.forRoot`) uses
in-memory storage; there is no shared throttler state across instances. No Redis container is
defined in `docker/docker-compose.local.yml` and no Redis resource is provisioned in the Azure
Bicep infra.

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

## WebSocket real-time cache invalidation

Three Socket.IO namespaces (used when `VITE_*_REALTIME_BACKEND=socket-io`) trigger
`queryClient.invalidateQueries()` on incoming events.

### `/notifications`

| Event                  | Action                     | Query invalidated                    |
| ---------------------- | -------------------------- | ------------------------------------ |
| `notification`       | New notification received  | `['notifications']`                |
| `team_join_approved` | Team join request approved | `['notifications']`, `['teams']` |

### `/retros`

| Event                       | Action                      | Query invalidated      |
| --------------------------- | --------------------------- | ---------------------- |
| `retro-changed`           | Card / vote / comment added | `['retro', retroId]` |
| `retro-status-changed`    | Retro phase changed         | `['retro', retroId]` |
| `discussion-card-changed` | Discussion focus changed    | `['retro', retroId]` |

### `/estimates`

| Event                       | Action             | Query invalidated                                             |
| --------------------------- | ------------------ | ------------------------------------------------------------- |
| `vote-cast`               | Participant voted  | `['estimate', sessionId]`                                   |
| `votes-revealed`          | Votes revealed     | `['estimate', sessionId]`                                   |
| `votes-cleared`           | Votes cleared      | `['estimate', sessionId]`                                   |
| `participant-joined/left` | Participant change | `['estimate', sessionId]`                                   |
| `session-ended`           | Session completed  | `['estimate', sessionId]`, `['active-estimate-sessions']` |

### WebSocket + polling redundancy

For retro boards and estimate sessions, both WebSocket events and polling run simultaneously.
WebSocket provides near-instant updates; polling is the safety net if a WebSocket event is missed
(connection drop, reconnection delay). No Redis is involved — invalidation flows directly through
TanStack Query.

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
| **Single-instance Socket.IO** | The Redis adapter is disabled; broadcast events only reach clients connected to the same API instance. Convex-backed features mask this in staging/production.                                                                |
