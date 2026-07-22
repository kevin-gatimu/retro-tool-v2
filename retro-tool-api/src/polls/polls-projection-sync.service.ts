import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
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
  private readonly logger = new Logger(PollsProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
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
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
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

    await this.runMutation('livePolls:upsertPollProjection', {
      pollId: record.id,
      teamId: record.teamId,
      isClosed: record.isClosed,
      updatedAt: Date.now(),
    });
  }

  async deletePollProjection(pollId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('livePolls:deletePollProjection', { pollId });
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
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return { scanned: 0 };
    }

    const polls = await this.database
      .select({ id: pollsSchema.poll.id })
      .from(pollsSchema.poll);

    for (const poll of polls) {
      try {
        await this.syncPollProjection(poll.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Reconcile: poll ${poll.id} projection failed: ${message}`,
        );
      }
    }

    return { scanned: polls.length };
  }

  /**
   * POST a projection mutation to Convex. Throws on any transport or
   * Convex-side error so the outbox dispatcher (which wraps delivery) can retry;
   * no-ops silently only when Convex is unconfigured. Reconciliation catches
   * per-entity so one failure does not abort a full rebuild.
   */
  private async runMutation(path: string, args: object): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const response = await fetch(
      `${convexConfig.url.replace(/\/$/, '')}/api/mutation`,
      {
        method: 'POST',
        headers: {
          Authorization: `Convex ${convexConfig.adminKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          args,
          format: 'json',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Convex poll projection mutation ${path} failed with status ${response.status}`,
      );
    }

    const result = (await response.json()) as ConvexFunctionResponse;
    if (result.status === 'error') {
      throw new Error(
        `Convex poll projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }
}
