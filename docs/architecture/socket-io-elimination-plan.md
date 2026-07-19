# Plan — Eliminating the Socket.IO fallback for retros & story estimates

> Status: **IMPLEMENTED** (full teardown). All five realtime features — retros,
> estimates, icebreakers, standups, notifications — now run Convex-only, and the
> shared Socket.IO transport has been removed entirely. What follows is the
> original plan; see the **Implementation outcome** box below for what actually
> shipped and how the scope grew from "retros + estimates" to all five.

> **Implementation outcome (delivered):**
>
> - **Phase 0 resilience:** P1 (degraded-mode banner + retro/estimate backstop polls), P2 (JWKS/JWT `/health/ready` guardrail), P4 (presence clears on disconnect — later moot once the gateway was deleted, superseded by projection state), P5 (single-instance Convex documented — see [../deployment/scaling-self-hosted-convex.md](../deployment/scaling-self-hosted-convex.md)). **P3 (transactional outbox) was NOT done** — see the deferred note in §3; the emit→projection rewire below preserved delivery via the existing outbox, so P3 remains a separate follow-up.
> - **Phase 2 (estimates write path):** REST command endpoints added (the polls pattern), `canControlSession`/`canManageSession` authorization.
> - **Phases 1 & 3 (flip to Convex-only):** all five `VITE_*_REALTIME_BACKEND` defaults set to `convex` (`env.ts`); every UI socket branch removed.
> - **Scope grew to all five features.** Retiring the *shared* `socket-io.adapter` / `WsAuthService` / client `lib/socket.ts` required migrating icebreakers, standups, and notifications too (an audit found all three were EASY — no socket-only write paths; every write already had a REST endpoint). Key subtlety handled across retros/estimates/standups/icebreakers: several gateway `emit*` methods **also** enqueued the Convex projection sync, so each was rewired to call `enqueueRetroSync`/`enqueueSessionSync`/`enqueueEntrySync` directly rather than deleted — otherwise realtime would have silently broken. Notifications' socket handler also fired a toast + `team_join_approved` teams-invalidation; those were ported into `NotificationConvexSync` (with first-load backlog suppression).
> - **Phase 4 (decommission):** deleted all 5 gateways, `adapters/socket-io.adapter.ts`, `auth/ws-auth.ts` + `ws-auth.module.ts`, client `lib/socket.ts`; unwired `useWebSocketAdapter` from `main.ts`; removed `WsAuthModule` from the 3 lagging modules; removed orphan `ClientData`/`EstimatesClientData` types; dropped deps `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `socket.io-client`.
> - **Verified:** API type-check/lint/build + 138 tests pass; UI type-check/lint/build + tests pass; live smoke — a retro comment and estimate activity enqueue `dispatched` Convex projection intents with no socket, `GET /socket.io/` returns **404**, and the API boots with no gateway/adapter code.
> - **Not removed (intentional):** `realtime-config.ts` + the `usesConvexFor*` flags stay — polls/surveys still use them to choose Convex-vs-REST-polling, and they drive the backstop-poll decisions. The `socket-io` enum value remains a settable-but-inert option; consider removing it in a later cleanup.

---

## 1. Why this is safe to consider now

Three facts from the current code change the usual "don't remove your fallback" calculus:

1. **Socket.IO is already single-instance.** `retro-tool-api/src/adapters/socket-io.adapter.ts` sets only CORS and logs *"Redis adapter disabled"* — no `@socket.io/redis-adapter`. Room broadcasts (`server.to('retro:X')`) reach only clients on the same Node process. The `socket-io` mode **cannot scale horizontally today**, so removing it forfeits nothing that currently works at >1 instance.
2. **Every mutation already dual-writes to Convex** via the durable outbox (`ProjectionOutboxService.enqueueAndDispatch`) → per-minute advisory-locked cron → nightly reconciliation. The Socket.IO events are essentially "something changed, refetch" nudges whose underlying data is already mirrored to Convex per-user.
3. **The switch is build-time, per-feature** (`VITE_RETROS_REALTIME_BACKEND` / `VITE_ESTIMATES_REALTIME_BACKEND`, baked into the Vite bundle, default `socket-io`).
4. **Polls and surveys already run exactly this way — Convex-only, no gateway.** This is the shipped proof the target architecture works here, not a hypothesis. `polls` has REST endpoints for **all** writes including the live-mutating ones (`POST /polls/:id/vote`, `DELETE /polls/:id/vote`, `PATCH /polls/:id/closed`), **no `polls.gateway.ts`**, a `polls-projection-sync.service.ts` (`enqueuePollSync` → outbox → `livePolls:upsertPollProjection`), and a UI that renders `PollListConvexSync` with a REST backstop (`refetchInterval: convexRealtime ? false : 15_000` in `routes/polls/index.tsx`). The estimates migration below is essentially **"make estimates look like polls."**

## 2. The asymmetry that drives the whole plan

**Retros** and **estimates** are NOT in the same position:

|                             | Retros                                                                                                                                                                     | Estimates                                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live mutations exposed as… | **REST endpoints** (phase transitions, cards, votes, comments all have `/api/retros/*` routes). The gateway only does `join/leave` + service-invoked broadcasts. | **Socket.IO handlers ONLY.** `cast-vote`, `reveal-votes`, `clear-votes`, `start-round`, `update-story`, `start-timer`, `end-session`, `join/leave` (→ `upsertParticipant`) have **no REST equivalent**. The gateway is the sole write path. |
| Cost to drop Socket.IO      | Low — Convex subscription replaces the invalidation nudge.                                                                                                                | High — the live voting mechanics must be re-implemented ** as REST or Convex mutations first**.                                                                                                                                                                         |

So "eliminate the fallback" means two very different amounts of work. This plan sequences accordingly: **retros first (low risk), estimates second (real migration), decommission last.**

## 3. Prerequisites — resilience before removal

Removing the fallback makes Convex availability + JWT-auth alignment **load-bearing** for a core flow. Do these first, or a Convex/JWKS hiccup becomes "no live data, no fallback."

- **P1 — Degraded-mode UX.** When `useConvexAuth().isAuthenticated` is false or the Convex socket is down, the board must not silently show stale/empty data. Add a visible "reconnecting / live updates paused" banner and keep a **slow REST backstop poll** (e.g. 15–30 s) as the floor even in Convex mode. (Estimates already keep a 15 s backstop in `use-estimate-session.ts`; generalize it to retros.)
- **P2 — JWT alignment guardrail.** The #1 silent failure is a byte-mismatched `JWT_ISSUER` / `JWT_AUDIENCE` / unreachable `JWT_JWKS_URL`. Add a startup/health check that mints a token and verifies it against the live JWKS, and surface `/api/auth/jwks` reachability in `/health/ready`. Fail loud, not silent.
- **P3 — Fix the outbox atomicity gap.** Today the outbox intent is enqueued *after* the business transaction (via `enqueueAndDispatch` on its own connection), not within it — a crash in that window loses the update until nightly reconciliation. Route retro/estimate mutations through `enqueueInTransaction(tx, …)` so the intent commits atomically with the write. This matters more once there's no socket path re-delivering the change.

  > **Scope finding (deferred):** retro/estimate **service mutations don't use `db.transaction` at all today** (verified: 0 `.transaction(` calls in `retros.service.ts` / `estimates.service.ts`; enqueue happens at the controller/gateway layer *after* the service returns). So P3 is not a small rewire — it requires first wrapping every mutation method in a transaction and threading `tx` down to the enqueue, across dozens of hot-path methods. The gap it closes (a crash in the commit→enqueue window) is already healed by nightly reconciliation, and the plan rates P3 lowest-urgency while the socket fallback still re-delivers changes. **Deferred to its own focused change** rather than folded into this branch — doing a sweeping transaction refactor of the hottest write paths without the load-test baseline and live verification would add risk out of proportion to the benefit. Track as a follow-up before the socket fallback is finally removed (Phase 4).
- **P4 — Presence semantics.** `handleDisconnect` never clears `isOnline` (estimates) — a dropped socket leaves stale "online". Reimplement presence on Convex connection state (heartbeat / onDisconnect) so it's correct by construction rather than tied to socket lifecycle.
- **P5 — Single-instance Convex is understood/accepted.** Self-hosted staging Convex is `numberOfWorkers: 1` (no scale-out/slots). Confirm prod (Convex Cloud) fans out, and document that a staging Convex outage pauses live updates until reconcile. Decide whether that's acceptable for staging or whether the backstop poll (P1) is the mitigation.

## 4. Phased migration

### Phase 0 — Prerequisites (P1–P5 above)

No behavior change to the transport yet. Ship degraded-mode UX, the JWKS health check, the transactional-outbox fix, Convex-native presence, and the retro backstop poll. **Gate:** all five in place and observable.

### Phase 1 — Retros to Convex-only

- Flip `VITE_RETROS_REALTIME_BACKEND=convex` everywhere and confirm the Convex path fully serves the board (it already does via `retro-convex-sync.tsx` → `getRetroBoard`).
- Replace the global `retro-list-changed` broadcast with a reactive Convex list query (`listRecentRetroProjections`) instead of "event → invalidate → REST".
- Remove the Socket.IO listeners and the `usesConvexForRetros()` branching in `routes/retros/$retroId.tsx`; delete the retro socket wiring.
- **Keep `retros.gateway.ts` deployed but unused** for one release as a rollback lever (feature-flag off, not deleted).
- **Gate:** a full retro lifecycle (draft→…→completed, cards/votes/comments/discussion pointer) works live for multiple clients with the flag on, degraded-mode banner verified by killing Convex locally.

### Phase 2 — Estimates: port the write path (the real work)

The blocker is that voting/rounds/timer exist only as socket handlers. Two options:

- **Option A (recommended): REST + projection — the polls pattern.** Add `/api/estimates/:id/{vote,reveal,clear,round,story,timer,end,participant}` endpoints that call the existing `estimatesService` methods (which already contain the persistence/validation logic), then `enqueueSessionSync` — **exactly how `polls` already handles live voting** (`POST /polls/:id/vote` → service → `enqueuePollSync` → `livePolls` projection, no gateway). The UI calls REST; Convex projects the result. Lowest new surface, and it's a pattern already in production in this repo, not a new invention. `estimates` already has the projection half (`estimates-projection-sync.service.ts` + `liveEstimates`); this phase adds the REST command half that polls has and estimates lacks.
- **Option B: Convex mutations.** Move the live commands into Convex mutations. Rejected for now — it would put business logic in Convex, violating the "PostgreSQL is source of truth / API owns writes" rule (and diverging from the polls precedent).
- Implement per-command authorization that the gateway did inline (`isSessionMember` / `canManageSession`) as guards on the new endpoints.
- Preserve vote-hiding: votes stay masked (`'?'`) in the projection until `reveal`.
- **Gate:** cast/reveal/clear/round/timer/end all work via REST→Convex for multiple clients, votes hidden until reveal, timer `timerEndsAt` reflected live.

### Phase 3 — Estimates to Convex-only

- Flip `VITE_ESTIMATES_REALTIME_BACKEND=convex`; remove socket listeners + branching in `use-estimate-session.ts`.
- Keep the 15 s backstop poll (P1).
- **Gate:** parity with the old socket flow; rollback still possible via flag.

### Phase 4 — Decommission

- Delete `retros.gateway.ts`, `estimates.gateway.ts`, and their socket wiring.
- If retros/estimates were the only remaining socket consumers among the realtime features, also retire the shared `WsAuthService` + `socket-io.adapter.ts` and the client `socket.ts`. **Check first:** icebreakers, standups, and notifications also have gateways — if any still use `socket-io`, keep the adapter and only remove the two gateways. (Notifications rooms clients by `user:{id}`; standups/icebreakers have their own gateways.)
- Remove the `VITE_*_REALTIME_BACKEND` flags for retros/estimates and the dead `usesConvexForRetros/Estimates` branches.
- **Gate:** no references to the deleted gateways; CI green; one release of soak time on staging.

## 5. Scope / impact inventory

**Delete (eventually):** `retro-tool-api/src/retros/retros.gateway.ts`, `estimates/estimates.gateway.ts`; retro/estimate socket branches in `routes/retros/$retroId.tsx` and `routes/estimate/hooks/use-estimate-session.ts`; possibly `adapters/socket-io.adapter.ts`, `auth/ws-auth.ts`, `lib/socket.ts` (only if no other feature uses them).

**Add:** estimate REST command endpoints + guards (Phase 2); degraded-mode banner + generalized backstop poll; JWKS health check; transactional-outbox wiring for retro/estimate mutations.

**Unchanged:** the Convex projection functions (`liveRetros`, `liveEstimates`) and sync services already exist and are the target — no schema change needed.

## 6. Scaling & load under burst

This is the section that decides whether Convex-only is safe under high load. Short version: **the current projection design does not scale well under burst — but the fix is mostly to stop generating self-inflicted load, not to add a queue.** A queue is a later, optional lever.

> **Note:** this load already runs today on every mutation (dual-write). Removing Socket.IO doesn't create it — it removes the cheap alternate path and makes this fan-out load-bearing. So this work is worth doing **whether or not** the fallback is dropped; it's a prerequisite for the flip.

### 6.1 The quantified problem (from the code)

For one user action on a board with **N** team members:

| Stage | Cost | Where |
|---|---|---|
| Business write | 1 Postgres transaction | source of truth |
| Outbox enqueue | 1 INSERT | `projection-outbox.service.ts` |
| Session projection | 1 Convex POST + ~1 SQL | sync service |
| **Per-member board fan-out** | **N Convex POSTs**, each preceded by `getRetro` (~13 SQL) + `getPreviousCarriedForward` | `retros-projection-sync.service.ts:142-176` |
| **Total per retro sync** | **≈ N+1 Convex POSTs, ≈ 14N+ Postgres queries**, board JSON serialized ×N | |

Estimates: **N+1 POSTs, ~6-8N SQL** (`estimates-projection-sync.service.ts:138-169`).

**Serialization / bottleneck points (each with file:line):**

1. **Outbox delivery loop is serial** — `projection-outbox.service.ts:211` `for (const row of batch)` with `await deliver` at `:218`. Each row is itself N+1 POSTs; rows never overlap.
2. **No retry backoff** — `projection-outbox.service.ts:395-409`: a failed row is retried on the very next tick with zero delay, oldest-first, so a failing row head-of-lines the queue → tight retry storm against an already-struggling Convex.
3. **Single Convex worker, OCC-serial, B1, `numberOfWorkers: 1`** — `infra/modules/convex-app-service.bicep:86`. Hard ceiling; **cannot scale out** — Convex OSS uses a single-writer committer (that's *why* it can't replicate). [convex-backend self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) · [how Convex works](https://stack.convex.dev/how-convex-works)
4. **Fresh `fetch()` per Convex POST, no keep-alive pool / batching** — `retros-projection-sync.service.ts:190`, `estimates-projection-sync.service.ts:183`, `convex-admin.service.ts:320`. Each of the N+1 upserts pays connection setup (~3 RTTs for a fresh TLS 1.2 handshake). [undici Agent defaults](https://github.com/nodejs/undici/blob/main/docs/docs/api/Agent.md)
5. **`getRetro` re-runs ~13 queries per member with no shared caching** — the *same* board is rebuilt N times per sync (`retros.service.ts` getRetro, called at `retros-projection-sync.service.ts:161`).
6. **API pinned to 1 worker; scale-out blocked** by the in-memory Socket.IO adapter (no Redis adapter) — so today neither tier scales horizontally.

**What does NOT contend:** per-member board rows are keyed `(retroId, userId)` / `(sessionId, userId)`, so the concurrent `Promise.all` fan-out has disjoint OCC read/write sets and does **not** self-conflict. Reads (`getRetroBoard`) are point-reads on `by_retro_user` — cheap and fan out natively. The problem is purely **write volume and serial delivery against one worker**, not read scaling.

### 6.2 The key insight: most of this load is self-inflicted

Convex **already fans one write out to every subscriber** — its sync engine tracks each query's read set and pushes recomputed results to all subscribed clients over the WebSocket. Projecting a **separate per-user snapshot for all N members** duplicates work Convex does for free. The Presence pattern recomputes *once per room*, scaling with rooms (shared docs), not users. [how Convex works](https://stack.convex.dev/how-convex-works) · [Convex realtime](https://docs.convex.dev/realtime) · [Presence with Convex](https://stack.convex.dev/presence-with-convex)

So the biggest win is **not** a queue — it's shrinking one action from *N snapshots + N POSTs* to **one delta write** that Convex fans out. That removes the majority of the write volume at the source and makes everything else cheaper.

### 6.3 Solutions, ranked by impact vs effort

**Tier 1 — do these before the estimates flip (high impact, code-only, zero new infra):**

- **S1 — Kill the N-fan-out.** Project **once** per board to a shared document/rows and let Convex fan out to the N subscribers, instead of writing N per-user snapshots. Where per-user differences exist (carried-forward items, permissions), push a shared board + a small per-user overlay, or filter client-side. Turns N+1 POSTs into ~1. *This is the headline fix.* [query caching](https://docs.convex.dev/functions/query-functions)
- **S2 — Delta writes, not snapshots.** Replace whole-board `JSON.stringify` + `db.replace`-style upserts with `db.patch` of only the changed field/row. Cuts payload size and OCC read-set size. [writing data](https://docs.convex.dev/database/writing-data)
- **S3 — Per-entity coalescing (debounce + `maxWait`).** In the dispatcher, keep a per-entity "dirty set" and a trailing-edge debounce with a `maxWait` cap: collapse 10 rapid votes on one board into **one** re-projection per window, while still projecting at least every N ms during a sustained burst. This is the log-compaction / conflation pattern (latest-wins per key, order preserved per key). The existing `dedupeKey` already collapses *identical* pending intents; this extends it to distinct-but-redundant ones. [Event Hubs log compaction](https://learn.microsoft.com/azure/event-hubs/log-compaction) · [materialized view](https://learn.microsoft.com/azure/architecture/patterns/materialized-view)
- **S4 — Bounded keep-alive HTTP pool to Convex.** Replace bare `fetch` with a shared `undici.Pool(CONVEX_URL, { connections: 8–32 })` (or `https.Agent({ keepAlive: true, maxSockets: 16 })`); if the endpoint supports HTTP/2, multiplex over one session. Eliminates per-POST handshake cost and bounds sockets to the one origin so a burst can't exhaust them. [undici Pool](https://github.com/nodejs/undici/blob/main/docs/docs/api/Pool.md)
- **S5 — Bounded-concurrency + backoff in the outbox loop.** Replace the serial `for` loop with a bounded `p-limit` (e.g. 4–8 in flight) **and** add a `nextAttemptAt` backoff column so failing rows don't head-of-line the queue in a tight retry storm. Keep each delivery idempotent (already is). [p-limit](https://www.npmjs.com/package/p-limit) · [queue-based load leveling](https://learn.microsoft.com/azure/architecture/patterns/queue-based-load-leveling)

Tier 1 needs **no new Azure resources**, directly protects the single Convex worker (fewer, coalesced, rate-metered, delta-shaped writes → far fewer OCC conflicts), and fits the cost-conscious staging brief. For realistic retro/estimate team sizes this is very likely **sufficient**.

**Tier 2 — only if queue depth / durability / multi-instance ordering demands it (real infra cost):**

- **S6 — Azure Service Bus (Standard) with sessions keyed on entity id.** Gives durable, cross-instance **per-entity FIFO** (Sequential Convoy: `SessionId = retroId`) plus a duplicate-detection window. Needed only once the **API itself scales to multiple instances** (in-process coalescing/ordering breaks across processes) or projection delivery must survive restarts beyond what the Postgres outbox already gives. Standard is pay-per-op, no monthly floor. **Not** Storage Queue (no FIFO, no dedup); **not** Competing Consumers (multi-consumer breaks ordering and can't help a single-instance backend). [queue comparison](https://learn.microsoft.com/azure/service-bus-messaging/service-bus-azure-and-service-bus-queues-compared-contrasted) · [message sessions](https://learn.microsoft.com/azure/service-bus-messaging/message-sessions) · [sequential convoy](https://learn.microsoft.com/azure/architecture/patterns/sequential-convoy)
- **S7 — Move the dispatcher to a separate Azure Container App, KEDA-scaled on queue length, `maxReplicas` capped at 1.** Decouples projection delivery from the API's lifecycle (today an in-process `kick()` drain dies on recycle and isn't advisory-locked), scales to zero when idle (cost), but **must stay effectively single-consumer** so it never overwhelms the single Convex worker. Microsoft's Web-Queue-Worker style. [background jobs guidance](https://learn.microsoft.com/azure/architecture/best-practices/background-jobs#hosting-environment) · [Container Apps KEDA scaling](https://learn.microsoft.com/azure/container-apps/scale-app#custom)

**Explicitly avoid:** scaling out the projection consumer (breaks per-entity ordering, and a single-instance Convex backend gains nothing); Storage Queue where ordering/dedup matter; running the consumer as an in-process WebJob without Always On + a separate plan.

### 6.4 Caveats

- Convex Cloud's published numeric limits (concurrent-mutation caps, etc.) are **not stated to apply** to the OSS self-hosted backend — don't treat them as guarantees; load-test instead. [Convex limits](https://docs.convex.dev/production/state/limits)
- Service Bus **sessions and duplicate detection are immutable at queue creation** — decide before provisioning.
- Duplicate detection dedupes *identical* re-sends only; distinct-update coalescing must be app-level (the S3 dirty-set + debounce).
- Self-hosted Convex is single-writer by design — **vertical scale only** (bump the B1 App Service SKU) if Tier 1 + Tier 2 still saturate it. Full escalation (vertical ladder → Convex Cloud, and why sharding/ACA are traps): [../deployment/scaling-self-hosted-convex.md](../deployment/scaling-self-hosted-convex.md).

### 6.5 The load-test gate

Before dropping the estimates fallback (Phase 3), **load-test at the 90th-percentile team size** (and a deliberately large team) simulating a voting burst: measure Convex CPU on the B1 worker, OCC retry/error rate ([`OCC` conflict errors](https://docs.convex.dev/error)), outbox queue depth + delivery lag, and end-to-end board-update latency. Ship S1–S4 first; only reach for Tier 2 if the test still saturates the single worker.

A runnable harness for this now lives at [`docker/loadtest/`](../../docker/loadtest/README.md): a Docker override that constrains the local Convex container to ≈B1, a parameterized `db:seed:load` fixture (team of N), a burst driver, and an outbox-depth watcher.

### 6.6 Implementation status (this branch)

Delivered on `feat/projection-load-tier1`:

- **S3 (coalescing), S4 (keep-alive pool), S5 (bounded concurrency + backoff)** — implemented in the outbox dispatcher + `lib/http-dispatcher.ts`. These are self-contained (no data-model or UI-contract change) and safe to ship independently. Tunables are constants at the top of `projection-outbox.service.ts`.
- **Load-test harness** — as above.

**Deferred: S1 + S2 (eliminate the per-member fan-out).** These are the highest-impact levers but change the **Convex projection data model *and* the UI read contract**, so they are a separate change gated on:

1. A **baseline** from the harness (how far do S3–S5 alone get us? — decides how hard S1 must push).
2. The three **open questions** below (esp. the estimates write-path decision), since the shared-projection shape differs for retros vs estimates.

Sketch of the S1/S2 design for that follow-up:

- **Shared board doc + per-user overlay.** Replace the N per-user `liveRetroBoard` / `liveEstimateBoard` snapshots with **one shared board document** the whole team subscribes to (Convex fans it out natively), plus a **small per-user overlay** only for the genuinely user-specific bits (carried-forward items, permission-gated visibility). Most of the board is identical across members and belongs in the shared doc.
- **Client-side filtering** for anything the overlay can't cheaply express, rather than materializing a full snapshot per user server-side.
- **Delta writes (`db.patch`)** on the shared doc — patch the changed card/vote/field instead of re-serializing and replacing the whole board, shrinking payload + OCC read-set.
- **Auth/visibility caveat:** the current per-user snapshot bakes in per-member permission filtering; a shared doc must not leak content a member shouldn't see. This is the main correctness risk and why it's not a mechanical change — resolve it in the S1/S2 design, not here.

> **⚠️ Confirmed blocker (from reading `retros.service.ts` `getRetro`):** a naive single shared doc would introduce a **security bug**, not just a modelling wrinkle. The per-user retro snapshot enforces:
>
> - `shouldHideContent = timerRunning && !isOwn` — during the brainstorm timer a member must not even *receive* other members' card **content**. A shared doc containing all cards leaks private brainstorm content to every subscriber.
> - `author = (shouldHideAuthor && !isOwn) ? null` — **anonymity** masking is per-viewer; a shared doc de-anonymizes cards.
> - `hasVoted` / `isOwn` — per-user flags.
> - Estimates has a lighter version: `isOwnVote ? points : '?'` — a voter sees their own pre-reveal vote, others see `'?'`.
>
> **Therefore S1 must be shared-doc + per-user overlay**, not a single doc: (a) a shared board doc with only non-sensitive, all-members-identical fields; (b) a small per-user overlay doc carrying just `{ hiddenCardIds, ownCardIds, myVotes, hasVoted }`; the client merges them. The shared doc must **omit** content/author for cards the timer/anonymity rules would hide from *anyone*, or (simpler + safe) the shared doc carries only what is safe for all members and the overlay supplies the viewer's own hidden/own items. This is a security-sensitive redesign of both the projection and the UI merge, gated on the load-test baseline (to confirm it's needed) and open-question #1. **Do not ship a single shared doc.**

## 7. Risks & mitigations

| Risk                                                   | Mitigation                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Convex/JWKS outage → no live data, no fallback        | P1 backstop poll + degraded-mode banner; P2 health check; accept staging single-instance with eyes open |
| Estimate write-path reimplementation regressions       | Phase 2 behind the flag with both paths runnable; parity test matrix before flip                        |
| Lost update on crash between commit and outbox enqueue | P3 transactional outbox                                                                                 |
| Stale presence                                         | P4 Convex-native presence                                                                               |
| Removing adapter breaks another feature's sockets      | Phase 4 explicit check of icebreakers/standups/notifications gateways before deleting shared infra      |

## 7. Recommendation

Do **not** remove the fallback as step one. Sequence it: **Phase 0 resilience → retros (Phase 1) → estimate write-path port (Phase 2) → estimates flip (Phase 3) → decommission (Phase 4)**, each behind the existing per-feature flag so every phase is independently reversible. The single largest liability is making JWT-auth alignment and single-instance Convex load-bearing with no safety net — Phase 0 (P1/P2) exists specifically to neutralize that before any fallback is dropped.

---

### Open questions for review

1. Estimate write path — **Option A (REST+projection)** as recommended, or is a Convex-mutation approach preferred despite the ownership-rule tension?
2. Is a staging Convex outage pausing live updates (mitigated by the backstop poll) acceptable, or should staging move off single-instance self-hosted Convex first?
3. Should the shared Socket.IO adapter be retired entirely, or retained because icebreakers/standups/notifications still use it? (Determines whether this is a "two gateways" removal or a full socket teardown.)
