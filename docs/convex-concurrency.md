# Concurrency in the Convex projection layer

> How this app stays correct — and avoids retry storms — when many writes hit
> the Convex realtime layer at once. Read this before adding or editing any
> `convex-backend/convex/*.ts` mutation, alongside
> [convex-backend/convex/_generated/ai/guidelines.md](../convex-backend/convex/_generated/ai/guidelines.md).

## TL;DR — the one rule

**Point-read for a point-write.** A mutation that writes one row must read only
that one row, by its **full composite index key** + `.unique()` — never a broad
index range scanned with `.collect().find(...)`. Everything below is why.

## Where concurrency actually lives

PostgreSQL (through NestJS) is the system of record and uses ordinary SQL
transactions; a Convex conflict can never corrupt durable business data. Convex
holds only the **realtime projection layer** — per-user board snapshots plus one
lightweight session/list projection row per entity. So the only place we manage
concurrency *in Convex* is the write path that NestJS drives after each business
mutation.

## Convex's model: OCC (optimistic concurrency control)

Every Convex mutation is a **serializable transaction**. Convex records the exact
set of documents and index ranges the mutation **read**, and at commit time, if
any of them changed underneath it, Convex **automatically retries the whole
mutation**. It only raises an error (`Documents read from or written to the "X"
table changed while this mutation was being run and on every subsequent retry…`)
after retries keep losing — i.e. a sustained hot-spot.

Consequences:

- **Correctness is free.** Serializability means we never reason about torn reads
  or lost updates.
- **Performance is not free.** It depends entirely on keeping each mutation's
  **read-set small and disjoint** from concurrent writers. A mutation that reads
  more than it writes is the entire failure mode.

## The failure we hit (and fixed)

The projection-sync services in NestJS fan out **one board write per team member,
concurrently** (`Promise.all`), after every retro/estimate/icebreaker/standup
mutation. The board upserts originally read the *whole session's* board range to
find one user's row:

```ts
// BAD — read-set = every board row for the session
const existing = (
  await ctx.db
    .query('liveEstimateBoards')
    .withIndex('by_session_id', (q) => q.eq('sessionId', args.sessionId))
    .collect()
).find((b) => b.userId === args.userId)
```

With N members writing at once, all N mutations read the same range, so each
commit invalidates the others → they retry, re-read the (now larger) range, and
conflict again → the OCC errors flood the Convex logs and updates stall.

### The fix: read exactly the row you write

```ts
// GOOD — read-set = one row; concurrent per-user writes are disjoint
const existing = await ctx.db
  .query('liveEstimateBoards')
  .withIndex('by_session_user', (q) =>
    q.eq('sessionId', args.sessionId).eq('userId', args.userId),
  )
  .unique()
```

Because each writer now touches a single, distinct `(sessionId, userId)` row,
their read/write sets don't overlap and OCC never triggers.

### Enabling typing: schema-bound server builders

Chained `.eq().eq()` on a composite index only type-checks against the real
`DataModel`. [convex/server.ts](../convex-backend/convex/server.ts) therefore
re-exports the **schema-bound** builders from `./_generated/server` (not the
schema-generic `*Generic` ones). This is what makes the point-read pattern
expressible everywhere; without it, code fell back to the very
`.collect().find()` scan that causes the conflict.

## The four principles, applied app-wide

1. **Point reads for point writes.** Full composite key + `.unique()`. Applied to
   the board upserts/getters in
   [liveEstimates.ts](../convex-backend/convex/liveEstimates.ts),
   [liveRetros.ts](../convex-backend/convex/liveRetros.ts),
   [liveIcebreakers.ts](../convex-backend/convex/liveIcebreakers.ts),
   [liveStandups.ts](../convex-backend/convex/liveStandups.ts); to
   `upsertMembership`/`deleteMembership` in
   [liveTeamMembers.ts](../convex-backend/convex/liveTeamMembers.ts); to the
   ephemeral `startTyping`/`stopTyping`/`setReadyStatus` writes in
   [liveRetros.ts](../convex-backend/convex/liveRetros.ts); and to
   `assertTeamMembership` in [lib/authz.ts](../convex-backend/convex/lib/authz.ts)
   (a hot auth path called by many team-scoped queries with a client-supplied
   `teamId`).

2. **No contended aggregates in Convex.** Vote tallies, counts, and analytics are
   computed in PostgreSQL and read through `/api/**`. Convex stores no shared
   counter for concurrent writers to fight over, so there is no aggregate
   hot-row. (This is also why the `@convex-dev/aggregate` component was retired —
   see [REPORTS-REDESIGN-PLAN.md](./REPORTS-REDESIGN-PLAN.md).)

3. **Idempotent, last-writer-wins.** Every projection upsert re-applies the
   current state and is stamped with `updatedAt`, so a retry — or an
   out-of-order delivery from the outbox — converges to truth rather than
   corrupts. Membership and board reconciliation are mark-and-sweep by
   `updatedAt`, which is safe to run repeatedly.

4. **Bounded mutations.** Never `.collect()` an unbounded range inside a write.
   Bulk sweeps/prunes (`admin:pruneStaleByUpdatedAt`,
   `liveTeamMembers:pruneStaleMemberships`) read one bounded `.take(n)` batch per
   call and repeat until done, per the Convex guidelines.

## Two concurrency layers outside Convex

- **Delivery (NestJS → Convex).** Live projection writes go through a
  transactional **outbox** ([projection-outbox.service.ts](../retro-tool-api/src/convex-admin/projection-outbox.service.ts)):
  the intent commits in the same PostgreSQL transaction as the business write,
  and an asynchronous dispatcher delivers it. The dispatcher runs under a
  **PostgreSQL advisory lock** (`OUTBOX_DISPATCH_LOCK_ID` in
  [convex-admin-cron.service.ts](../retro-tool-api/src/convex-admin/convex-admin-cron.service.ts)),
  so with multiple API instances only one dispatches at a time. Delivery is
  idempotent and retryable, and a `dedupeKey` collapses superseded intents for
  the same entity. See [convex-architecture.md](./convex-architecture.md).

- **Business writes (PostgreSQL).** Standard SQL transactions on the system of
  record. Convex is strictly downstream; its concurrency is never on the
  critical path for durable data.

## When NOT to apply the point-read rule

`.collect()` is correct — and must stay — where a query genuinely returns many
rows:

- **List projections** (`listRecent*`, `listActive*`, `listPollProjections`,
  `listSurveyProjections`) that collect then `.slice(0, LIST_PROJECTION_CAP)`.
- **Delete-all cleanup loops** (e.g. `deleteRetroProjection` removing every board
  row for a session).
- **Per-user collections** (`listUserNotifications`, `getUnreadCount`,
  `getTypingUsers`, `getReadyStatus`).

Never convert a query that can legitimately match more than one row to
`.unique()` — it throws at runtime when a second row exists.

## Checklist for a new Convex mutation

- [ ] Does it write one row? Then read that one row by its **full composite key**
      + `.unique()` — not a prefix scan + `.find()`.
- [ ] Is any value it reads a shared/aggregate counter? Move that to PostgreSQL.
- [ ] Is the upsert idempotent and `updatedAt`-stamped?
- [ ] Any `.collect()` — is it bounded, or genuinely multi-row and off the
      concurrent-fan-out path?
- [ ] Deliver it through the outbox from NestJS, not a direct fire-and-forget
      push.
