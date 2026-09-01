# Inactivity Logout Flow

> The app ends an authenticated browser session after 30 minutes of inactivity, shows a 2-minute warning, and redirects to sign-in. Better Auth independently enforces a 30-minute rolling server-session expiry.

This workflow complements the security design in [inactivity-logout.md](../security/inactivity-logout.md).

---

## Goal

Protect unattended browser sessions without creating interaction heartbeats. The feature is intended for a signed-in user who leaves a dashboard, retro board, or story estimate board open without interacting with the app. Better Auth separately rejects expired server sessions even if local browser state is stale or manipulated.

The design is intentionally conservative:

- 30-minute inactivity timeout
- 2-minute warning before forced logout
- trusted user interaction resets the timer
- server polling, network retries, and cached API activity do not count as user activity
- no activity heartbeat or database write is sent to keep the session alive

---

## Core behavior

### Activity tracking

The browser tracks a `lastActivityAt` value in `localStorage`. The timestamp is updated only in response to real user interactions, not on background fetches or refreshes.

The app listens for:

- `pointerdown`
- `keydown`
- `scroll`
- `touchstart`

The app also re-evaluates activity on:

- `visibilitychange`
- `focus`
- `pageshow`

This ensures a suspended or hidden tab does not keep the session alive indefinitely after the user has been away.

### Cross-tab synchronization

Whenever a trusted interaction occurs, the app updates the timestamp and emits:

- a `BroadcastChannel` message
- a `storage` event update

This keeps all tabs for the same user synchronized. If the timeout window is reached in any tab, the sign-out event is shared across all tabs so all open app windows behave the same way.

### Warning state

When the remaining time reaches 2 minutes, the app shows a visible warning and offers the user a clear next step. The warning is purely local UI state and is driven by the inactivity deadline, not by server polling.

The deadline is computed from the last trusted interaction, not from background network events. This avoids false activity caused by polling or Convex updates during a story estimate or board refresh.

---

## Logout process

The logout routine is intentionally single-flight and immediate.

1. A tab detects the inactivity deadline or receives a logout broadcast.
2. The tab checks a local lock to ensure only one logout flow runs.
3. The app broadcasts a logout event so other tabs immediately clear local auth state and redirect.
4. The initiating tab starts Better Auth sign-out while its bearer is still available for server revocation.
5. When sign-out settles—or after a 3-second grace limit—the tab clears:
   - `sessionStorage` bearer token
   - TanStack Query cache
   - stale cached user data tied to the session
6. The app redirects to `/auth/sign-in?status=session-expired` and shows an expiration message.

If a REST request later returns `401`, the same centralized unauthorized-session handler triggers the same single-flight logout so stale API errors cannot leave the app in a half-logged-in state.

---

## Why the design ignores network activity

Background traffic is not treated as user activity because it can happen while a user is away from the keyboard. This includes:

- Timed dashboard refreshes
- TanStack Query polling
- Convex subscriptions
- WebSocket pings or background reconnects
- network retries and failed idle requests

Those signals may prove that the browser is still connected to the network, but they do not prove that a human is actively using the app. The feature therefore uses only trusted human interaction as the source of truth for activity.

This is especially important for story estimate work, where the board may be open and polling may continue across the browser lifecycle while the user is away or suspended.

---

## Server/auth relationship

The client and server enforce complementary deadlines:

- Better Auth sessions have a rolling 30-minute expiry.
- Better Auth renews expiry at most once every 5 minutes during normal authenticated requests.
- The client uses trusted interaction to decide when the browser UI is idle.
- Convex JWTs last 15 minutes and refresh only while Better Auth remains valid.
- Every protected operation still depends on server authorization.

The browser does not send an interaction heartbeat. Consequently, mouse or keyboard activity without any authenticated request does not renew the server session. Conversely, background requests may renew Better Auth, but they never reset the stricter client inactivity timer.

---

## Operational configuration

This feature should be configured in one place so the values are visible and explicit:

- `VITE_AUTH_IDLE_TIMEOUT_MINUTES=30`
- `VITE_AUTH_IDLE_WARNING_MINUTES=2`
- `BETTER_AUTH_SESSION_EXPIRES_IN=1800`
- `BETTER_AUTH_SESSION_UPDATE_AGE=300`
- re-check cadence: 5-second local interval plus focus, visibility, and page-show re-evaluation
- redirect target: `/auth/sign-in?status=session-expired`

Configuration should be in the same runtime config used by the auth and API layers; the timer should not be hidden in individual components or route modules.

---

## Acceptance and testing

### Acceptance criteria

- A signed-in browser session expires after 30 minutes of no trusted user interaction.
- A warning appears 2 minutes before the forced logout.
- Polling, network retries, or background session activity do not reset the inactivity timer.
- Returning to the app from a suspended or hidden tab triggers a timeout re-check.
- Multi-tab sessions coordinate through the same last-activity timestamp.
- The redirect target is `/auth/sign-in?status=session-expired`.
- The local bearer token and TanStack Query cache are cleared immediately even if the server sign-out call fails.
- A future `401` from the API resolves through the same single-flight logout path.
- Better Auth uses a 30-minute server expiry and a 5-minute renewal interval.

### Recommended validation cases

1. User stays active on a story estimate page for 29 minutes; no logout occurs.
2. User is idle for 31 minutes; logout occurs and redirect succeeds.
3. User receives the 2-minute warning, then interacts before timeout; timer resets and warning disappears.
4. A background polling loop continues and does not keep the session alive.
5. One tab updates the timestamp and another tab sees the same expiration deadline.
6. The browser is suspended; focus return triggers an expiration check.
7. The Better Auth sign-out call fails; the app still logs the user out locally and redirects.
8. A stale API response returns `401`; the centralized handler initiates the same app logout flow.

---

## Related documentation

- Security design: [inactivity-logout.md](../security/inactivity-logout.md)
- Auth lifecycle: [authentication.md](../security/authentication.md)
- Product flow references: [app-flows.md](./app-flows.md)
