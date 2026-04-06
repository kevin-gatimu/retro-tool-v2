# Plan: Fix WebSocket 1011 InternalServerError on Retro Board

## Context

Users on the retro board page see a repeating WebSocket disconnect/reconnect loop with close code `1011: InternalServerError`. The connection reconnects, fails again, and repeats indefinitely. REST API appears to work (the page loads), so the database is reachable — but something in the WebSocket `handleConnection` path is throwing an unhandled exception.

The core problem is that all three gateways have a `catch {}` block that **swallows the error silently**:
```typescript
} catch {
  client.disconnect();  // no logging — we can't see what failed
}
```
When `client.disconnect()` is called from inside a failing async `handleConnection`, Socket.IO sends close code 1011 (not 1000). The client retries, hits the same error, and loops.

## Root Cause (most likely)

Without server logs, we can't be 100% certain, but the top candidates are:

1. **Unapplied DB migration in prod** — Migration `0003_long_sunfire.sql` adds `'retro_created'` to the `notification_type` enum. If not yet applied, any query that scans or touches the `notification` table with an enum column can fail.
2. **DB query error on session lookup** — The WebSocket auth queries `authSchema.session` — if the connection pool exhausts or there's a transient error, `handleConnection` throws without logging.
3. **Better Auth session cookie mismatch** — If the deployed version of Better Auth changed cookie encoding, the regex `better-auth\.session_token=([^;]+)` wouldn't match → `token` is `null` → `client.disconnect()` is called cleanly (not a 1011, so less likely).

## Fix

### Step 1 — Add error logging to all three gateway catch blocks

The logging change is the immediate fix that will reveal the actual error in production Azure Container logs.

**Files to edit:**
- `retro-tool-api/src/retros/retros.gateway.ts` — line 66
- `retro-tool-api/src/notifications/notifications.gateway.ts` — line 64
- `retro-tool-api/src/estimates/estimates.gateway.ts` — find the catch block in `handleConnection`

Change each `catch {}` to:
```typescript
} catch (error) {
  this.logger.error('WS handleConnection failed', error instanceof Error ? error.stack : String(error));
  client.disconnect();
}
```

### Step 2 — Apply pending migration in production

Migration `0003_long_sunfire.sql` is unapplied:
```sql
ALTER TYPE "public"."notification_type" ADD VALUE 'retro_created' BEFORE 'retro_lobby_open';
```
This must be run against the production PostgreSQL database. If the API code references `'retro_created'` as a notification type and the enum doesn't have it yet, certain queries will fail.

### Step 3 — Deploy and check Azure Container logs

After deploying with the logging fix, open the Azure Container Instance logs (or ACI log stream) and reproduce the issue. The `this.logger.error(...)` will now show the actual error message and stack trace.

## Critical Files

| File | What to change |
|------|---------------|
| `retro-tool-api/src/retros/retros.gateway.ts:66` | `catch {}` → `catch (error) { logger.error(...); client.disconnect(); }` |
| `retro-tool-api/src/notifications/notifications.gateway.ts:64` | Same |
| `retro-tool-api/src/estimates/estimates.gateway.ts` | Same (find catch in handleConnection) |

## Verification

1. Deploy the logging change
2. Open the retro board URL — the WS reconnect loop should still happen (we haven't fixed root cause yet, just added logging)
3. Check Azure Container Logs → look for `WS handleConnection failed` → the error message will tell you the exact cause
4. Based on the error:
   - If it's a Drizzle/PostgreSQL error: apply migration 0003 and/or check DB connectivity from the container
   - If it's "invalid enum value": run the `ALTER TYPE` migration
   - If it's another error: fix accordingly
5. After applying the actual fix, the WS reconnect loop should stop and "Client connected: userId=…" should appear in logs
