import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from '../../auth/schema';

/**
 * Singleton config row for the admin-triggered Convex table-clear cron job.
 * Only one row exists with id = 'singleton'.
 */
export const convexCronConfig = pgTable('convex_cron_config', {
  id: varchar('id', { length: 36 }).primaryKey().default('singleton'),
  schedule: varchar('schedule', { length: 100 }).notNull().default('0 0 * * 0'),
  enabled: boolean('enabled').notNull().default(false),
  tablesToClear: jsonb('tables_to_clear')
    .notNull()
    .$type<string[]>()
    .default([]),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedByUserId: varchar('updated_by_user_id', { length: 255 }).references(
    () => user.id,
    { onDelete: 'set null' },
  ),
});

export type ConvexCronConfig = typeof convexCronConfig.$inferSelect;
export type NewConvexCronConfig = typeof convexCronConfig.$inferInsert;

/**
 * Transactional projection outbox. Each business mutation that changes a
 * Convex-projected entity enqueues one row here **inside the same PostgreSQL
 * transaction** as the durable write. An asynchronous dispatcher then delivers
 * each row to Convex and marks it dispatched.
 *
 * Why: projection pushes used to be best-effort fire-and-forget after commit,
 * so a mutation accepted by PostgreSQL while Convex was stopped/unreachable
 * (e.g. a stop-first backend upgrade) could be lost from the projection. The
 * outbox makes the intent-to-project durable and replayable: pause the
 * dispatcher during maintenance, keep committing business writes + outbox rows,
 * then resume and replay in order after Convex returns.
 *
 * The outbox stores a **sync intent** — the logical `projection`, an
 * `operation` ('sync' | 'delete'), and the `entityKey` (e.g. a retroId, or
 * `<standupId>:<date>`). The dispatcher hands the intent to the matching
 * projection-sync service, which recomputes current PostgreSQL state and pushes
 * it to Convex. This keeps the rich per-member board fan-out logic in one place
 * and means a replayed event always converges to current truth rather than a
 * stale point-in-time snapshot. Rows are processed oldest-first; a `dedupeKey`
 * (`<projection>:<operation>:<entityKey>`) collapses superseded intents so only
 * the newest pending row per entity is delivered.
 */
export const projectionOutbox = pgTable(
  'projection_outbox',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    // Logical projection this event belongs to, e.g. 'retros', 'notifications'.
    projection: varchar('projection', { length: 64 }).notNull(),
    // What to do with the entity when delivering.
    operation: varchar('operation', { length: 16 })
      .notNull()
      .$type<'sync' | 'delete'>(),
    // Identifies the source entity. Usually its id; composite keys are
    // colon-joined (e.g. standups use `<standupId>:<entryDate>`).
    entityKey: varchar('entity_key', { length: 512 }).notNull(),
    // Optional extra JSON the dispatcher passes to the sync method (e.g. the
    // per-user read-state for notifications). Null for the common id-only case.
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    // Collapses superseded events: newest pending row per key wins. Shape is
    // `<projection>:<operation>:<entityKey>`.
    dedupeKey: varchar('dedupe_key', { length: 512 }).notNull(),
    // pending → dispatched, or → failed after exhausting attempts.
    status: varchar('status', { length: 16 })
      .notNull()
      .$type<'pending' | 'dispatched' | 'failed'>()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    // Earliest time this row is eligible for (re)delivery. Set to now() on
    // enqueue and pushed into the future with exponential backoff after a failed
    // attempt, so a persistently-failing row stops head-of-lining the
    // oldest-first queue and hammering an already-struggling Convex backend.
    nextAttemptAt: timestamp('next_attempt_at')
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: timestamp('created_at')
      .notNull()
      .$defaultFn(() => new Date()),
    dispatchedAt: timestamp('dispatched_at'),
  },
  (table) => [
    // Dispatcher scans pending rows that are due, oldest-first.
    index('projection_outbox_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('projection_outbox_dedupe_idx').on(table.dedupeKey),
    index('projection_outbox_projection_idx').on(table.projection),
  ],
);

export type ProjectionOutboxRow = typeof projectionOutbox.$inferSelect;
export type NewProjectionOutboxRow = typeof projectionOutbox.$inferInsert;

/**
 * Singleton control row for the outbox dispatcher. `paused` lets a stop-first
 * Convex maintenance window keep buffering projection events durably without
 * delivering them; the release step flips it back and the dispatcher replays.
 * Only one row exists with id = 'singleton'.
 */
export const projectionOutboxControl = pgTable('projection_outbox_control', {
  id: varchar('id', { length: 36 }).primaryKey().default('singleton'),
  paused: boolean('paused').notNull().default(false),
  updatedAt: timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
  updatedByUserId: varchar('updated_by_user_id', { length: 255 }).references(
    () => user.id,
    { onDelete: 'set null' },
  ),
});

export type ProjectionOutboxControl =
  typeof projectionOutboxControl.$inferSelect;
