# Caching Strategy — Frontend

The frontend uses **TanStack Query** for client-side data caching, while the backend uses **Redis** for server-side caching. This document explains how the two layers interact, the current query configuration, and how cache invalidation flows through the system.

---

## Two-Layer Caching Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Browser                            │
│                                                      │
│  ┌────────────────┐     ┌────────────────────────┐   │
│  │  TanStack Query │     │   WebSocket (Socket.IO) │   │
│  │  In-Memory Cache│     │   Real-Time Updates     │   │
│  └───────┬────────┘     └──────────┬─────────────┘   │
│          │ staleTime expired        │ event received  │
│          │ or invalidateQueries     │                 │
│          ▼                          ▼                 │
│     HTTP Request              queryClient.            │
│     GET /api/...            invalidateQueries()       │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│                    API Server                         │
│                                                      │
│  ┌──────────┐    hit    ┌───────┐                    │
│  │  Service  │ ────────►│ Redis │  (TTL-based cache) │
│  │          │ ◄─────────│       │                    │
│  └──────────┘    miss   └───────┘                    │
│       │                                              │
│       ▼                                              │
│  ┌──────────┐                                        │
│  │PostgreSQL │                                        │
│  └──────────┘                                        │
└──────────────────────────────────────────────────────┘
```

**Request path**: TanStack Query cache (memory) → API → Redis cache → PostgreSQL.

When TanStack Query considers data stale (past `staleTime`) or when `invalidateQueries()` is called, it makes an HTTP request to the API. The API checks Redis first — if the data is cached, PostgreSQL is never hit.

---

## TanStack Query Configuration

### Default Settings

The QueryClient uses default options (no global `staleTime` or `gcTime` overrides). Each query sets its own timing.

### Query Timing Reference

| Query Key                      | Endpoint                             | staleTime | refetchInterval | Notes                                         |
| ------------------------------ | ------------------------------------ | --------- | --------------- | --------------------------------------------- |
| `['current-user']`             | `GET /api/users/me`                  | 60s       | —               | Loaded on app root, used everywhere           |
| `['notifications']`            | `GET /api/notifications`             | 30s       | 30s (polling)   | Global polling, all users                     |
| `['dashboard-stats']`          | `GET /api/retros/dashboard`          | 30s       | —               | Dashboard home                                |
| `['dashboard-retros']`         | `GET /api/retros/dashboard`          | 30s       | —               | Recent retro list                             |
| `['retro', retroId]`           | `GET /api/retros/:id`                | 5s        | 3s (active)     | Very aggressive polling during active retro   |
| `['estimate', sessionId]`      | `GET /api/estimates/:id`             | 5s        | 3s (active)     | Very aggressive polling during active session |
| `['active-estimate-sessions']` | `GET /api/estimates/active`          | 30s       | —               | Refetches on window focus                     |
| `['templates', ...]`           | `GET /api/retros/templates`          | 60s       | —               | Template lists                                |
| `['teams', ...]`               | `GET /api/teams`                     | 60s       | —               | Team listings                                 |
| `['organizations']`            | `GET /api/organizations`             | 60s       | —               | Sidebar + org pages                           |
| `['team-metrics', teamId]`     | `GET /api/reports/teams/:id/metrics` | 60s       | —               | Reports tab                                   |
| `['health-score', teamId]`     | `GET /api/reports/teams/:id/health`  | 60s       | —               | Reports tab                                   |
| `['system-overview']`          | `GET /api/reports/system`            | 60s       | —               | Admin dashboard                               |

---

## Polling Patterns

### Active Polling (High Frequency)

| Query                                  | Interval | When Active                      | Server-Side Redis TTL |
| -------------------------------------- | -------- | -------------------------------- | --------------------- |
| Retro board (`['retro', id]`)          | 3s       | During active retro sessions     | 5s                    |
| Estimates session (`['estimate', id]`) | 3s       | During poker planning            | 5s                    |
| Notifications (`['notifications']`)    | 30s      | Always (all authenticated users) | 30s                   |

**How Redis helps**: The retro board frontend polls every 3 seconds, but Redis caches the response for 5 seconds. This means the database is queried at most once per 5 seconds per user, regardless of poll frequency. For 8 participants in a retro, this reduces DB queries from 160/min to ~96/min.

### Passive Polling (Low Frequency)

| Query            | Behavior                | Server-Side Redis TTL |
| ---------------- | ----------------------- | --------------------- |
| Active estimates | Refetch on window focus | 30s                   |
| Dashboard stats  | Refetch on stale (30s)  | 300s                  |
| Teams/orgs       | Refetch on stale (60s)  | 120s                  |
| Reports          | Refetch on stale (60s)  | 300s                  |

---

## WebSocket Real-Time Events

Three Socket.IO namespaces handle real-time updates:

### `/notifications`

| Event                | Action                     | Query Invalidated                |
| -------------------- | -------------------------- | -------------------------------- |
| `notification`       | New notification received  | `['notifications']`              |
| `team_join_approved` | Team join request approved | `['notifications']`, `['teams']` |

### `/retros`

| Event                     | Action                   | Query Invalidated    |
| ------------------------- | ------------------------ | -------------------- |
| `retro-changed`           | Card/vote/comment added  | `['retro', retroId]` |
| `retro-status-changed`    | Retro phase changed      | `['retro', retroId]` |
| `discussion-card-changed` | Discussion focus changed | `['retro', retroId]` |

### `/estimates`

| Event                     | Action             | Query Invalidated                                         |
| ------------------------- | ------------------ | --------------------------------------------------------- |
| `vote-cast`               | Participant voted  | `['estimate', sessionId]`                                 |
| `votes-revealed`          | Votes revealed     | `['estimate', sessionId]`                                 |
| `votes-cleared`           | Votes cleared      | `['estimate', sessionId]`                                 |
| `participant-joined/left` | Participant change | `['estimate', sessionId]`                                 |
| `session-ended`           | Session completed  | `['estimate', sessionId]`, `['active-estimate-sessions']` |

### WebSocket + Polling Redundancy

For retro boards and estimate sessions, **both** WebSocket events and polling are active simultaneously. This is intentional:

- **WebSocket**: Provides near-instant updates when events fire.
- **Polling**: Acts as a safety net if a WebSocket event is missed (connection drops, reconnection delays).
- **Redis**: Ensures the poll requests are cheap (cache hit) rather than triggering full DB queries.

---

## Cache Invalidation Flow

When a mutation occurs (e.g., user creates a card on the retro board):

```
1. Frontend calls mutation (POST /api/retros/:id/cards)
2. API creates card in PostgreSQL
3. API deletes Redis cache: retro-tool:retro:{retroId}:*
4. API emits WebSocket event: retro-changed
5. Frontend receives WS event → calls queryClient.invalidateQueries(['retro', retroId])
6. TanStack Query refetches GET /api/retros/:id
7. API checks Redis (miss — just deleted) → queries PostgreSQL → caches result
8. Frontend renders updated board
```

On subsequent polls (within Redis TTL), the cached response is returned without hitting PostgreSQL.

---

## Mutation Invalidation Cascades

When a mutation succeeds, the frontend invalidates related queries to keep the UI consistent:

| Mutation                      | Queries Invalidated                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Retro card/vote/comment       | `['retro', retroId]`                                                                              |
| Retro status change           | `['retro', retroId]`, `['retros']`, `['dashboard-retros']`                                        |
| Retro completed               | `['retro', retroId]`, `['retros']`, `['dashboard-stats']`, `['team-metrics']`, `['health-score']` |
| Team member add/remove        | `['teams']`, `['sidebar-teams']`, `['org-teams', orgId]`                                          |
| Org member add/remove         | `['organizations']`, `['sidebar-organizations']`, `['organization', orgId]`                       |
| Notification read/delete      | `['notifications']`                                                                               |
| Template create/update/delete | `['templates']`, `['org-templates', orgId]`                                                       |

---

## Which Queries Benefit Most from Server-Side Caching?

### High Impact (Frequent + Expensive)

1. **Notifications** — polled by every user every 30s. Redis turns this from "1 DB query per poll" to "1 DB query per 30s per user."
2. **Retro board** — polled every 3s with 8-10 DB queries per load. Redis reduces this to 1 DB hit per 5s per user.
3. **Report metrics** — 5-10 aggregation queries each. Redis caches for 5 minutes, making dashboard loads instant after the first request.

### Medium Impact (Frequent + Light)

4. **Templates** — queried on every "create retro" flow. Cached for 10 minutes.
5. **Org/team lists** — loaded on sidebar render (every navigation). Cached for 2 minutes.
6. **Current user** — loaded on every authenticated page. Already has 60s client staleTime; server caches for 2 minutes.

### Low Impact (Already Optimized Client-Side)

7. **Estimates history** — paginated, infrequently accessed.
8. **Admin logs** — admin-only, low traffic.

---

## Development Tips

### Checking If Redis Caching Is Active

Open the browser DevTools Network tab and compare response times:

- **Without Redis**: API responses for reports/retro boards take 50-200ms (multiple DB queries).
- **With Redis**: Cache-hit responses return in 5-15ms.

### Forcing a Cache Miss

During development, you can clear all Redis caches:

```bash
docker exec retro-tool-redis redis-cli FLUSHDB
```

Or clear specific keys:

```bash
# Clear all retro caches
docker exec retro-tool-redis redis-cli --scan --pattern "retro-tool:retro:*" | xargs docker exec retro-tool-redis redis-cli DEL

# Clear all report caches
docker exec retro-tool-redis redis-cli --scan --pattern "retro-tool:reports:*" | xargs docker exec retro-tool-redis redis-cli DEL
```

### Without Redis

If `REDIS_URL` is not set on the API server, caching is disabled entirely. The frontend works exactly the same — TanStack Query still caches client-side, but every API request goes straight to PostgreSQL.
