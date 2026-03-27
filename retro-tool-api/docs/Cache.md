# Redis Caching Strategy

The API uses Redis as an optional caching layer to reduce database load and improve response times. The caching system is designed with **graceful degradation** — if Redis is unavailable or not configured, the application works identically, just without caching.

---

## Why Redis Caching?

Without caching, every API request hits PostgreSQL directly:

- **RBAC permission checks** run 2–4 DB queries per authenticated request (`buildOrgContext`, `buildTeamContext`)
- **Notification polling** from every user every 30 seconds
- **Report endpoints** execute 5–10 complex aggregation queries each
- **Retro board loading** runs 8–10 queries with nested joins — and the frontend polls every 3 seconds during active sessions
- **Template lists** are fetched on every "create retro" flow despite rarely changing

Redis eliminates redundant queries by caching results with short TTLs and invalidating on writes.

---

## Architecture

### Cache-Aside Pattern

```
  Client Request
       │
       ▼
  ┌─────────┐    cache hit     ┌───────┐
  │ Service  │ ───────────────► │ Redis │
  │  Method  │ ◄─────────────── │       │
  └─────────┘    return data    └───────┘
       │
       │ cache miss
       ▼
  ┌──────────┐
  │ PostgreSQL│ ──► store in Redis with TTL ──► return data
  └──────────┘
```

1. **Read**: Check Redis first. On hit, return cached data. On miss, query the database, store the result in Redis with a TTL, then return.
2. **Write**: After a successful database mutation, delete the affected cache keys. The next read will populate fresh data.
3. **Expiry**: All cache entries have a TTL. Even without explicit invalidation, stale data is automatically evicted.

### Graceful Degradation

The `CacheService` wraps every Redis operation in try-catch:

- If `REDIS_URL` is not set, `CacheService` operates as a no-op (all `get` returns `null`, `set`/`del` are silent).
- If Redis goes down at runtime, cache operations fail silently with logged warnings — the app falls through to the database on every request.
- No code paths depend on Redis being available. It is a pure performance optimization layer.

---

## Cache Key Convention

All keys follow the pattern:

```
retro-tool:{scope}:{entity}:{identifier}[:{sub-entity}]
```

### Key Reference

| Key Pattern                                                  | Description                                           | TTL     |
| ------------------------------------------------------------ | ----------------------------------------------------- | ------- |
| `retro-tool:user:{userId}:role`                              | User system role (for `isSystemAdmin`/`isSuperAdmin`) | 120s    |
| `retro-tool:rbac:org:{orgId}:user:{userId}`                  | OrgContext from `buildOrgContext()`                   | 120s    |
| `retro-tool:rbac:team:{teamId}:user:{userId}`                | TeamContext from `buildTeamContext()`                 | 120s    |
| `retro-tool:notifications:{userId}:list`                     | User's notification list                              | 30s     |
| `retro-tool:session:ws:{token}`                              | Validated WebSocket session                           | 300s    |
| `retro-tool:retro:{retroId}:detail:{userId}`                 | Full retro board (user-scoped)                        | 5–3600s |
| `retro-tool:reports:team:{teamId}:metrics:{period}:{userId}` | Team metrics for a period                             | 300s    |
| `retro-tool:reports:team:{teamId}:health`                    | Team health score                                     | 300s    |
| `retro-tool:reports:team:{teamId}:action-items`              | Action item analytics                                 | 300s    |
| `retro-tool:reports:org:{orgId}:template-usage`              | Template usage metrics                                | 600s    |
| `retro-tool:reports:org:{orgId}:overview:{period}`           | Org-wide overview                                     | 300s    |
| `retro-tool:reports:system`                                  | System-wide overview                                  | 300s    |
| `retro-tool:reports:user:{userId}:stats`                     | Personal user stats                                   | 300s    |
| `retro-tool:templates:user:{userId}`                         | Template list (user-scoped)                           | 600s    |
| `retro-tool:template:{templateId}`                           | Individual template with columns                      | 600s    |
| `retro-tool:orgs:user:{userId}`                              | User's organization list                              | 120s    |
| `retro-tool:org:{orgId}:teams:user:{userId}`                 | Org's team list (user-scoped)                         | 120s    |

---

## TTL Rationale

| Category              | TTL   | Reasoning                                                                                                      |
| --------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| RBAC contexts         | 120s  | Security-sensitive but roles change rarely. Short enough that permission changes take effect within 2 minutes. |
| Notifications         | 30s   | Matches the frontend polling interval. DB is hit at most once per 30s per user instead of on every poll.       |
| WebSocket sessions    | 300s  | Matches Better Auth's `cookieCache.maxAge` of 5 minutes.                                                       |
| Active retro board    | 5s    | Frontend polls every 3s. This rate-limits DB queries to 1 per 5s per user while keeping data near-real-time.   |
| Completed retro board | 3600s | Immutable after completion — safe to cache for a long time.                                                    |
| Reports               | 300s  | Analytics data. Users expect dashboard metrics to be approximate, not real-time.                               |
| Templates             | 600s  | Rarely modified. A 10-minute cache dramatically reduces queries on the "create retro" flow.                    |
| Org/team lists        | 120s  | Changes only on membership mutations, which trigger explicit invalidation.                                     |

---

## Invalidation Strategy

### Principle

On writes, **delete** the affected cache keys (don't update them). The next read will lazily populate fresh data. This avoids cache-database inconsistencies from partial updates.

### Invalidation Map

| Mutation                                                                             | Cache Keys Invalidated                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| User role change (`updateRole`, `promoteToSystemAdmin`, `demoteSystemAdminToMember`) | `retro-tool:user:{userId}:role`, `retro-tool:rbac:*:user:{userId}` (pattern)                |
| Org member add/remove/role change                                                    | `retro-tool:rbac:org:{orgId}:user:{userId}`, `retro-tool:orgs:user:{userId}`                |
| Team member add/remove/tag change                                                    | `retro-tool:rbac:team:{teamId}:user:{userId}`, `retro-tool:org:{orgId}:teams:user:{userId}` |
| Notification created/read/deleted                                                    | `retro-tool:notifications:{userId}:list`                                                    |
| Retro card/vote/comment/status mutation                                              | `retro-tool:retro:{retroId}:*` (pattern)                                                    |
| Template create/update/delete                                                        | `retro-tool:templates:*` (pattern), `retro-tool:template:{id}`                              |
| Report endpoints                                                                     | No explicit invalidation — TTL-only expiry (analytics are approximate)                      |

### Pattern Deletion

For broad invalidation (e.g., clearing all retro caches for a board), `CacheService.delPattern()` uses Redis `SCAN` with glob matching to find and delete keys. This is non-blocking and safe for production use.

---

## Setup

### Local Development (Docker)

Redis is included in the project's `docker-compose.yml`:

```bash
# Start both PostgreSQL and Redis
docker compose up -d

# Verify Redis is running
docker exec retro-tool-redis redis-cli ping
# Expected output: PONG
```

Set the environment variable in `.env`:

```env
REDIS_URL=redis://localhost:6379
```

### Production (Azure Cache for Redis)

1. Create an Azure Cache for Redis instance (Basic C0 is sufficient for most workloads).
2. Copy the connection string from the Azure Portal (Access Keys blade).
3. Set the environment variable:

```env
REDIS_URL=rediss://:<access-key>@<hostname>.redis.cache.windows.net:6380
```

Note the `rediss://` scheme (with double `s`) — this enables TLS, which Azure requires.

### Without Redis

Simply omit `REDIS_URL` from your environment. The `CacheService` will operate in no-op mode and the application will work exactly as before — all queries go directly to PostgreSQL.

---

## Environment Variables

| Variable    | Required | Default                        | Description                                                                 |
| ----------- | -------- | ------------------------------ | --------------------------------------------------------------------------- |
| `REDIS_URL` | No       | `undefined` (caching disabled) | Redis connection string. Supports `redis://` (plain) and `rediss://` (TLS). |

---

## Verifying Cache Behavior

### Check Stored Keys

```bash
# Connect to Redis CLI
docker exec -it retro-tool-redis redis-cli

# List all cache keys
KEYS retro-tool:*

# Check a specific key's TTL
TTL retro-tool:reports:team:abc123:health

# View a cached value
GET retro-tool:user:abc123:role
```

### Monitor Real-Time Cache Activity

```bash
# Watch all Redis commands in real time
docker exec -it retro-tool-redis redis-cli MONITOR
```

This shows every `GET`, `SET`, `DEL`, and `SCAN` command as they happen — useful for verifying that cache hits are occurring and invalidation is working correctly.

### Confirm Graceful Degradation

1. Stop Redis: `docker compose stop redis`
2. Make API requests — they should still work (hitting the database directly).
3. Check API logs for cache warning messages.
4. Restart Redis: `docker compose start redis`
5. Verify caching resumes automatically.

---

## Socket.IO Redis Adapter

For horizontal scaling (multiple API instances behind a load balancer), the Socket.IO Redis adapter ensures WebSocket events are broadcast across all instances via Redis pub/sub.

When `REDIS_URL` is set, the `SocketIoAdapter` automatically uses the Redis adapter. This means:

- A WebSocket event emitted on Instance A reaches clients connected to Instance B.
- No sticky sessions are required for WebSocket connections (though they improve HTTP session cache hit rates).
- The adapter creates dedicated pub/sub connections separate from the caching client.

---

## Memory Footprint

Estimated Redis memory usage at scale:

| Users | Concurrent | Estimated Memory |
| ----- | ---------- | ---------------- |
| 100   | 10         | ~500KB           |
| 1,000 | 100        | ~5MB             |
| 5,000 | 500        | ~25MB            |

Redis memory usage is trivially small for this application. The default Azure Cache for Redis Basic C0 tier (250MB) is more than sufficient.

---

## Implementation Files

| File                          | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `src/cache/cache.module.ts`   | Global NestJS module providing `REDIS_CLIENT` token and `CacheService` |
| `src/cache/cache.service.ts`  | Typed Redis wrapper with graceful degradation                          |
| `src/cache/cache-keys.ts`     | Centralized cache key builder functions                                |
| `src/config/configuration.ts` | Config schema with optional `redis.url`                                |
