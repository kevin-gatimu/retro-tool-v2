import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import { generateId } from '../lib/utils';
import * as adminSchema from './schema';
import type {
  OutboxDispatchResult,
  OutboxExecutor,
  OutboxStatusResponse,
  ProjectionOutboxEvent,
  ProjectionOutboxHandler,
} from './types';

type Database = NodePgDatabase<typeof adminSchema>;

const CONTROL_ID = 'singleton';
// Bounded per drain pass so a single dispatch tick stays predictable and the
// advisory-locked cron slot never holds the lock for an unbounded time.
const DISPATCH_BATCH_SIZE = 200;
// Give up delivering a row after this many attempts; it is marked `failed` and
// left for reconciliation/drift to heal rather than blocking the queue forever.
const MAX_ATTEMPTS = 10;

/**
 * Transactional projection outbox.
 *
 * Business mutations enqueue a projection **intent** (sync/delete of an entity)
 * in the same PostgreSQL transaction as their durable write (see
 * {@link enqueueInTransaction}). The intent is delivered by handing it to the
 * projection's registered handler, which recomputes current PostgreSQL state
 * and pushes it to Convex. This replaces the previous best-effort
 * fire-and-forget pushes, which could silently drop a projection update when
 * Convex was unreachable (notably during a stop-first backend upgrade).
 *
 * Delivery happens two ways: an immediate best-effort attempt right after
 * enqueue (so realtime latency is unchanged when Convex is healthy), and a
 * durable cron-driven {@link dispatchPending} that guarantees eventual delivery
 * and drives {@link replayAll} after a maintenance pause. Delivery is
 * idempotent — every handler is a full upsert of current state — and a
 * `dedupeKey` collapses superseded intents for the same entity.
 */
@Injectable()
export class ProjectionOutboxService {
  private readonly logger = new Logger(ProjectionOutboxService.name);
  private readonly handlers = new Map<string, ProjectionOutboxHandler>();
  // Single-flight guard for the immediate post-enqueue kick: while one drain is
  // running, concurrent enqueues set this flag instead of launching their own
  // overlapping drain (which would duplicate the batch SELECT + delivery HTTP
  // calls and race the status updates). The running drain loops again if work
  // arrived while it ran; the cron is the durable backstop regardless.
  private draining = false;
  private drainRequested = false;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

  // ───────────────────────── Handler registry ─────────────────────────────

  /**
   * Register the delivery handler for a projection. Called once per projection
   * at startup by each sync service, so the outbox module stays free of imports
   * on the feature modules (which depend on it) — no dependency cycle.
   */
  registerHandler(projection: string, handler: ProjectionOutboxHandler): void {
    this.handlers.set(projection, handler);
  }

  // ───────────────────────────── Enqueue ──────────────────────────────────

  /**
   * Persist a projection intent inside the caller's open transaction, so the
   * intent-to-project commits atomically with the business write. If the
   * transaction rolls back, the outbox row disappears with it. Does NOT attempt
   * immediate delivery (the transaction has not committed yet) — call
   * {@link kick} after commit for low-latency delivery.
   */
  async enqueueInTransaction(
    tx: OutboxExecutor,
    event: ProjectionOutboxEvent,
  ): Promise<void> {
    await tx.insert(adminSchema.projectionOutbox).values({
      id: generateId(),
      projection: event.projection,
      operation: event.operation,
      entityKey: event.entityKey,
      payload: event.payload ?? null,
      dedupeKey: this.dedupeKey(event),
    });
  }

  /**
   * Durably enqueue a projection intent and immediately attempt best-effort
   * delivery, so realtime latency matches the old fire-and-forget path when
   * Convex is healthy. If delivery fails or the dispatcher is paused, the row
   * stays pending for the cron to deliver later. Never throws.
   */
  async enqueueAndDispatch(event: ProjectionOutboxEvent): Promise<void> {
    try {
      await this.enqueueInTransaction(this.database, event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Failed to enqueue projection intent ${this.dedupeKey(event)}: ${message}`,
      );
      return;
    }
    // Best-effort immediate drain, single-flighted; the cron is the backstop.
    this.kick();
  }

  /**
   * Trigger a best-effort drain without overlapping concurrent drains. If a
   * drain is already running, just flag that more work arrived so the running
   * loop does another pass; otherwise start one. Fire-and-forget; never throws.
   */
  private kick(): void {
    if (this.draining) {
      this.drainRequested = true;
      return;
    }
    this.draining = true;
    void (async () => {
      try {
        do {
          this.drainRequested = false;
          await this.dispatchPending();
        } while (this.drainRequested);
      } catch {
        // Swallow — the cron dispatcher is the durable backstop.
      } finally {
        this.draining = false;
      }
    })();
  }

  // ──────────────────────────── Dispatch ──────────────────────────────────

  /**
   * Deliver one bounded batch of pending intents oldest-first. No-ops when
   * Convex is unconfigured or the dispatcher is paused. Superseded rows (an
   * older pending row for a `dedupeKey` that has a newer pending row in the
   * batch) are closed without a delivery, since the newer row reprojects
   * current state anyway.
   */
  async dispatchPending(): Promise<OutboxDispatchResult> {
    const empty: OutboxDispatchResult = {
      dispatched: 0,
      failed: 0,
      skippedSuperseded: 0,
      remaining: 0,
    };

    if (!this.convexConfigured()) {
      return empty;
    }
    if (await this.isPaused()) {
      this.logger.debug('Outbox dispatch skipped — dispatcher is paused');
      return empty;
    }

    const batch = await this.database
      .select()
      .from(adminSchema.projectionOutbox)
      .where(eq(adminSchema.projectionOutbox.status, 'pending'))
      .orderBy(asc(adminSchema.projectionOutbox.createdAt))
      .limit(DISPATCH_BATCH_SIZE);

    if (batch.length === 0) {
      return empty;
    }

    // Only the newest pending row per dedupeKey needs delivery; older ones are
    // superseded and closed without a call. Compute "newest" across ALL pending
    // rows (not just this batch): with a burst larger than DISPATCH_BATCH_SIZE
    // for one entity, the globally-newest row can fall outside the batch, so a
    // batch-local max would deliver a stale row now and the newest later.
    const dedupeKeys = [...new Set(batch.map((row) => row.dedupeKey))];
    const newestRows = await this.database
      .select({
        dedupeKey: adminSchema.projectionOutbox.dedupeKey,
        id: adminSchema.projectionOutbox.id,
        createdAt: adminSchema.projectionOutbox.createdAt,
      })
      .from(adminSchema.projectionOutbox)
      .where(
        and(
          eq(adminSchema.projectionOutbox.status, 'pending'),
          inArray(adminSchema.projectionOutbox.dedupeKey, dedupeKeys),
        ),
      );
    const newestByKey = new Map<string, { id: string; createdAt: Date }>();
    for (const row of newestRows) {
      const current = newestByKey.get(row.dedupeKey);
      if (!current || row.createdAt > current.createdAt) {
        newestByKey.set(row.dedupeKey, {
          id: row.id,
          createdAt: row.createdAt,
        });
      }
    }

    let dispatched = 0;
    let failed = 0;
    let skippedSuperseded = 0;

    for (const row of batch) {
      if (newestByKey.get(row.dedupeKey)?.id !== row.id) {
        await this.markDispatched(row.id);
        skippedSuperseded += 1;
        continue;
      }

      const ok = await this.deliver(row);
      if (ok) {
        await this.markDispatched(row.id);
        dispatched += 1;
      } else {
        await this.markAttemptFailed(row.id, row.attempts + 1 >= MAX_ATTEMPTS);
        failed += 1;
      }
    }

    const remaining = await this.countByStatus('pending');
    return { dispatched, failed, skippedSuperseded, remaining };
  }

  /**
   * Drain the entire pending queue in bounded passes. Used on resume after a
   * maintenance pause and by the reconciliation flow. Stops when no pending
   * rows remain, a pass makes no forward progress, or the safety cap is hit.
   */
  async replayAll(): Promise<OutboxDispatchResult> {
    const total: OutboxDispatchResult = {
      dispatched: 0,
      failed: 0,
      skippedSuperseded: 0,
      remaining: 0,
    };

    const maxPasses = 1000;
    for (let pass = 0; pass < maxPasses; pass += 1) {
      const result = await this.dispatchPending();
      total.dispatched += result.dispatched;
      total.failed += result.failed;
      total.skippedSuperseded += result.skippedSuperseded;
      total.remaining = result.remaining;

      const madeProgress =
        result.dispatched + result.failed + result.skippedSuperseded > 0;
      if (result.remaining === 0 || !madeProgress) {
        break;
      }
    }

    return total;
  }

  // ─────────────────────────── Pause / resume ─────────────────────────────

  async isPaused(): Promise<boolean> {
    const [row] = await this.database
      .select({ paused: adminSchema.projectionOutboxControl.paused })
      .from(adminSchema.projectionOutboxControl)
      .where(eq(adminSchema.projectionOutboxControl.id, CONTROL_ID))
      .limit(1);
    return row?.paused ?? false;
  }

  async setPaused(paused: boolean, userId?: string): Promise<void> {
    await this.database
      .insert(adminSchema.projectionOutboxControl)
      .values({
        id: CONTROL_ID,
        paused,
        updatedAt: new Date(),
        updatedByUserId: userId ?? null,
      })
      .onConflictDoUpdate({
        target: adminSchema.projectionOutboxControl.id,
        set: {
          paused,
          updatedAt: new Date(),
          updatedByUserId: userId ?? null,
        },
      });
    this.logger.log(
      `Projection outbox dispatcher ${paused ? 'paused' : 'resumed'}`,
    );
  }

  // ─────────────────────────────── Status ─────────────────────────────────

  async getStatus(): Promise<OutboxStatusResponse> {
    const [pending, failed, oldest, control] = await Promise.all([
      this.countByStatus('pending'),
      this.countByStatus('failed'),
      this.oldestPending(),
      this.database
        .select({
          paused: adminSchema.projectionOutboxControl.paused,
          updatedAt: adminSchema.projectionOutboxControl.updatedAt,
        })
        .from(adminSchema.projectionOutboxControl)
        .where(eq(adminSchema.projectionOutboxControl.id, CONTROL_ID))
        .limit(1),
    ]);

    const oldestPendingAgeMs =
      oldest === null ? null : Date.now() - oldest.getTime();

    return {
      paused: control[0]?.paused ?? false,
      pending,
      failed,
      oldestPendingAgeMs,
      updatedAt: control[0]?.updatedAt?.toISOString() ?? null,
    };
  }

  /**
   * Delete rows dispatched before `olderThan`. Housekeeping so the table does
   * not grow without bound; returns the number removed.
   */
  async pruneDispatched(olderThan: Date): Promise<number> {
    const removed = await this.database
      .delete(adminSchema.projectionOutbox)
      .where(
        and(
          eq(adminSchema.projectionOutbox.status, 'dispatched'),
          lt(adminSchema.projectionOutbox.dispatchedAt, olderThan),
        ),
      )
      .returning({ id: adminSchema.projectionOutbox.id });
    return removed.length;
  }

  // ─────────────────────────── Private helpers ────────────────────────────

  private dedupeKey(event: ProjectionOutboxEvent): string {
    // Include payload.action in the key when present: some projections encode
    // distinct changes to the SAME entity under the same operation via the
    // payload (e.g. notifications: 'upsert' vs 'markRead' both use operation
    // 'sync' on the same notificationId). Without the action, an upsert and a
    // read-state change to one notification would collapse and one would be
    // dropped as "superseded" without ever being delivered.
    const action =
      typeof event.payload?.action === 'string' ? event.payload.action : '';
    return `${event.projection}:${event.operation}:${action}:${event.entityKey}`;
  }

  private convexConfigured(): boolean {
    const convex = this.configService.get('convex', { infer: true });
    return Boolean(convex?.url && convex.adminKey);
  }

  /**
   * Route one row to its projection handler. Returns true on success, false on
   * any handler error or missing handler (the caller decides retry/fail).
   */
  private async deliver(
    row: adminSchema.ProjectionOutboxRow,
  ): Promise<boolean> {
    const handler = this.handlers.get(row.projection);
    if (!handler) {
      this.logger.warn(
        `No outbox handler registered for projection '${row.projection}'`,
      );
      return false;
    }

    try {
      await handler(row.operation, row.entityKey, row.payload);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Outbox delivery failed for ${row.dedupeKey}: ${message}`,
      );
      return false;
    }
  }

  private async markDispatched(id: string): Promise<void> {
    await this.database
      .update(adminSchema.projectionOutbox)
      .set({ status: 'dispatched', dispatchedAt: new Date() })
      .where(eq(adminSchema.projectionOutbox.id, id));
  }

  private async markAttemptFailed(
    id: string,
    exhausted: boolean,
  ): Promise<void> {
    await this.database
      .update(adminSchema.projectionOutbox)
      .set({
        status: exhausted ? 'failed' : 'pending',
        attempts: sql`${adminSchema.projectionOutbox.attempts} + 1`,
        lastError: exhausted
          ? `Delivery failed after ${MAX_ATTEMPTS} attempts`
          : 'Delivery attempt failed; will retry',
      })
      .where(eq(adminSchema.projectionOutbox.id, id));
  }

  private async countByStatus(
    status: 'pending' | 'dispatched' | 'failed',
  ): Promise<number> {
    const [row] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(adminSchema.projectionOutbox)
      .where(eq(adminSchema.projectionOutbox.status, status));
    return row?.count ?? 0;
  }

  private async oldestPending(): Promise<Date | null> {
    const [row] = await this.database
      .select({ createdAt: adminSchema.projectionOutbox.createdAt })
      .from(adminSchema.projectionOutbox)
      .where(eq(adminSchema.projectionOutbox.status, 'pending'))
      .orderBy(asc(adminSchema.projectionOutbox.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
  }
}
