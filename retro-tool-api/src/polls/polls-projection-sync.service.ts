import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as pollsSchema from './schema';

type Database = NodePgDatabase<typeof pollsSchema>;

const PROJECTION = 'polls';

/**
 * Pushes a lightweight poll projection into Convex after each mutation so the
 * polls list updates in realtime. PostgreSQL remains the source of truth; the
 * UI refetches the REST list (which applies per-viewer authorization) whenever
 * this projection changes. No-ops silently when Convex is not configured.
 */
@Injectable()
export class PollsProjectionSyncService implements OnModuleInit {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly convexClient: ConvexMutationClientService,
    private readonly outbox: ProjectionOutboxService,
  ) {}

  onModuleInit(): void {
    // Deliver outbox intents by recomputing current state from PostgreSQL.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) =>
      operation === 'delete'
        ? this.deletePollProjection(entityKey)
        : this.syncPollProjection(entityKey),
    );
  }

  /**
   * Durably enqueue a poll (re)projection. Replaces the old fire-and-forget
   * push at call-sites: the intent commits to the outbox and is delivered
   * immediately (best-effort) plus guaranteed by the dispatcher.
   */
  async enqueuePollSync(pollId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: pollId,
    });
  }

  /** Durably enqueue removal of a poll projection. */
  async enqueuePollDelete(pollId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: pollId,
    });
  }

  async syncPollProjection(pollId: string): Promise<void> {
    if (!this.convexClient.isConfigured()) {
      return;
    }

    const [record] = await this.database
      .select({
        id: pollsSchema.poll.id,
        teamId: pollsSchema.poll.teamId,
        isClosed: pollsSchema.poll.isClosed,
      })
      .from(pollsSchema.poll)
      .where(eq(pollsSchema.poll.id, pollId))
      .limit(1);

    if (!record) {
      return;
    }

    await this.convexClient.runMutation('livePolls:upsertPollProjection', {
      pollId: record.id,
      teamId: record.teamId,
      isClosed: record.isClosed,
      updatedAt: Date.now(),
    });
  }

  async deletePollProjection(pollId: string): Promise<void> {
    if (!this.convexClient.isConfigured()) {
      return;
    }

    await this.convexClient.runMutation('livePolls:deletePollProjection', {
      pollId,
    });
  }

  /**
   * Rebuild every poll projection from PostgreSQL. Re-uses
   * {@link syncPollProjection} per poll so the projection-shaping logic stays in
   * one place; each upsert stamps `updatedAt` with a fresh `Date.now()`, which
   * the reconciliation orchestrator's mark-and-sweep (prune rows older than a
   * timestamp captured before this pass) relies on. Returns the number of polls
   * scanned. No-ops when Convex is unconfigured.
   */
  async syncAllPolls(): Promise<{ scanned: number }> {
    if (!this.convexClient.isConfigured()) {
      return { scanned: 0 };
    }

    const polls = await this.database
      .select({ id: pollsSchema.poll.id })
      .from(pollsSchema.poll);

    for (const poll of polls) {
      await this.syncPollProjection(poll.id);
    }

    return { scanned: polls.length };
  }
}
