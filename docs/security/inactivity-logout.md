# Secure Inactivity Logout

> Browser inactivity ends the local signed-in experience after 30 minutes, while Better Auth independently enforces a 30-minute rolling server session and refreshes its expiry at most once every 5 minutes.

This document defines the security design for the inactivity logout feature. For the end-user flow and acceptance checks, see [inactivity-logout.md](../workflows/inactivity-logout.md).

---

## Scope and intent

The app uses two complementary controls:

- A client inactivity guard protects unattended browser tabs, warns the user, clears private cached state, and coordinates tabs for the same Better Auth session.
- Better Auth is the authoritative boundary. Its server session expires after 30 minutes without authenticated server activity and rolls forward at most once every 5 minutes while requests continue.

Convex JWTs retain their 15-minute lifetime and can only be refreshed while the Better Auth session remains valid. The browser sends no mouse/keyboard heartbeat; server expiry refresh occurs through normal authenticated requests.

---

## Security model

### Inactivity window

- Idle timeout: 30 minutes of inactivity in a browser tab or across tabs for the same authenticated user.
- Warning window: 2 minutes before forced sign-out, show a warning banner and allow the user to take one final action, if the app is still active.
- Only trusted user interactions reset the timer.
- Polling, background refresh, server pushes, websocket activity, Convex subscriptions, and network traffic do not count as active user interaction.

### Trusted activity sources

The inactivity timer resets only when the browser receives user-originated input that indicates a live user is present. Examples include:

- pointer presses, key presses, scrolling, and touch starts
- focus, visibility, and page-show events re-check expiry before any later interaction can reset the timer

The system intentionally ignores:

- periodic polling from TanStack Query or other client-side fetch loops
- network retries or failed API calls
- Convex or Socket.IO updates
- background tab visibility changes alone while the browser remains idle

This keeps the timer aligned with actual user presence rather than server-side or background traffic. The feature is intentionally conservative: if the app does not see a trusted interaction, it treats the session as idle.

### Cross-tab synchronization

The app stores a last-activity timestamp in `localStorage` and emits a `BroadcastChannel` event plus a `storage` event whenever a trusted user interaction occurs. All tabs for the same user share the same inactivity state and will keep the same deadline.

Tabs carrying the same Better Auth session intentionally share one deadline: trusted activity in any one of those tabs keeps that browser session active. Messages include the Better Auth session ID, so unrelated sessions are ignored. Local browser coordination avoids interaction heartbeats and their associated request and database-write load.

When a logout is triggered, every tab receives the same signal, performs the same local cleanup, and redirects to:

- `/auth/sign-in?status=session-expired`

### Visibility and focus safeguards

A suspended or hidden tab may not fire user interaction events while the browser is technically inactive. To catch this, the app re-evaluates the last activity timestamp on:

- `visibilitychange`
- `focus`
- `pageshow`
- timed re-checks when the app is foregrounded

If the browser was hidden or suspended and the idle window has expired, the app forces logout as soon as the user returns. This reduces the chance that a background tab stays signed in beyond the enforced idle policy.

### Centralized 401 signal

All REST requests made through the central API client use an error-handling layer that recognizes unauthorized responses (`401`). It dispatches one browser session-expiry event, which triggers the same logout path for protected API calls that lose authorization.

This avoids hidden branches where one API call signs the user out but another continues to keep stale data in the cache or local state.

### Single-flight logout

The logout routine is guarded by a single-flight lock so that multiple tabs, API errors, or duplicate signals cannot race and produce inconsistent state. Only one tab performs the active sign-out flow at a time; the others observe the broadcasted logout and exit immediately.

All tabs must clear the same state:

- `sessionStorage` bearer token
- TanStack Query cache
- app-level auth state
- any queued one-time messages or private state tied to the session

The logout path gives Better Auth up to 3 seconds to revoke the server session, then guarantees local cleanup and redirect even if the request is unavailable or still pending.

### Best-effort server sign-out

The browser starts `Better Auth` sign-out while the bearer credential is still available so the server can revoke the HttpOnly cookie and server-side session. Client cleanup runs in a `finally` path, and the inactivity manager applies a 3-second grace limit before forcing cleanup and redirect.

This preserves server-side revocation when possible without allowing a failed or stalled network request to leave private browser state visible. The server remains responsible for rejecting any server session that has expired or was revoked independently.

### Authoritative server expiry

Better Auth applies a rolling server-side expiry independently of browser state:

- `expiresIn` is 1,800 seconds (30 minutes).
- `updateAge` is 300 seconds (5 minutes).
- The signed cookie cache remains limited to 5 minutes.
- Normal authenticated requests may renew expiry, but renewal is throttled by `updateAge` rather than writing on every request.
- Convex JWTs retain their 15-minute lifetime and cannot be refreshed after Better Auth rejects the session.

The client never extends the server session merely because pointer or keyboard input occurred. Consequently, a user who interacts with a long local form without making any authenticated request may be required to sign in again when submitting after the server window.

---

## Security boundaries and limitations

1. **The server is authoritative.** Browser-state manipulation can bypass the warning or local redirect, but cannot make an expired or revoked Better Auth session valid. Every protected API operation must continue to use server authorization.

2. **Server and browser activity have different meanings.** The browser counts only trusted user input. Better Auth can observe only authenticated requests, including background requests. The local 30-minute timer therefore remains necessary to prevent background traffic from being treated as proof of human presence.

3. **Sessions are isolated per device/session.** Activity on one device does not renew a separate Better Auth session on another device. Tabs that share the same session coordinate locally.

4. **Offline pages cannot be remotely changed.** A stale offline tab may remain visually open, but it cannot access protected server data. On return, the local deadline check clears it; any request using an expired server session receives `401`.

5. **Human presence cannot be proven from ordinary browser events.** A scripted client can imitate interaction or requests. Stronger assurance requires explicit reauthentication, WebAuthn user verification, or another step-up challenge—not an inactivity timer.

6. **Background realtime channels require bounded credentials.** Convex JWTs remain short-lived and refresh requires a valid Better Auth session. Any future long-lived transport must revalidate or disconnect when its credential expires.

---

## Operational configuration

The feature should be configured centrally and documented in the UI runtime configuration, with safe defaults that are easy to change in staging or production without code changes.

Recommended defaults:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `VITE_AUTH_IDLE_TIMEOUT_MINUTES` | `30` | Client inactivity deadline |
| `VITE_AUTH_IDLE_WARNING_MINUTES` | `2` | Client warning window |
| `BETTER_AUTH_SESSION_EXPIRES_IN` | `1800` | Rolling server-session lifetime in seconds |
| `BETTER_AUTH_SESSION_UPDATE_AGE` | `300` | Minimum interval between server expiry renewals in seconds |

The server update age must be shorter than the server expiration; startup configuration validation rejects an invalid relationship. Keep the client and server timeout at 30 minutes unless a deliberate policy change is being deployed to both layers.

The local manager checks every 5 seconds and on focus, visibility, and page-show recovery. It does not make an API request or write to the database. Better Auth performs any required session read or throttled renewal as part of normal authenticated server traffic. The redirect target is `/auth/sign-in?status=session-expired`.

---

## Flow summary

1. The app initializes the inactivity guard at sign-in and tracks the last trusted user activity timestamp.
2. Trusted interactions update `localStorage` and emit the cross-tab broadcast event.
3. The app compares the current time with the last activity timestamp and shows a 2-minute warning when the TTL is nearly exhausted.
4. On expiry, the app triggers a single-flight logout.
5. The initiating tab starts Better Auth sign-out with its bearer still available for server revocation.
6. Client cleanup runs when that request settles, or after the 3-second grace limit, whichever happens first.
7. Cross-tab receivers immediately perform local cleanup and redirect to `/auth/sign-in?status=session-expired`.
8. A centralized `401` handler resolves any later unauthorized API call into the same single-flight logout path.

---

## Acceptance and testing

### Acceptance criteria

- A browser session without user interaction logs out after 30 minutes.
- The app warns the user 2 minutes before the forced sign-out.
- Only user-originated events reset activity; polling and background sync do not.
- A user return after background suspension triggers a re-check and forces logout if the timeout elapsed.
- All tabs share the same logout and redirect behavior.
- `sessionStorage` bearer state is removed immediately, even when the server sign-out call fails.
- TanStack Query cache is cleared before the redirect.
- Redirect destination is `/auth/sign-in?status=session-expired`.
- Better Auth rejects a server session after its 30-minute rolling expiry and renews active sessions no more often than every 5 minutes.
- Convex JWT refresh succeeds only while the Better Auth session remains valid.

### Test cases

- Idle timer expires while the tab remains open.
- Warning appears exactly as the 2-minute threshold is reached.
- Pointer press or keyboard input resets the timer and suppresses logout.
- React Query polling does not refresh the timer.
- A background tab remains open but hidden; focus return triggers re-evaluation and logout if expired.
- Two tabs are open; activity in one tab updates the shared timestamp for both tabs.
- A 401 from a stale API call triggers the same logout path as the idle timeout.
- Sign-out fails on the network; local session cleanup still completes and redirect still happens.
- A user is active in one tab and then moves to another tab; the shared event still respects the same session deadline.
- A story estimate board remains visible in a background tab but no human interaction occurs; the timer still expires as required.

---

## Related documentation

- Workflow reference: [inactivity-logout.md](../workflows/inactivity-logout.md)
- Auth lifecycle reference: [authentication.md](./authentication.md)
- API hardening and unauthorized-session handling: [backend-api.md](./backend-api.md)
