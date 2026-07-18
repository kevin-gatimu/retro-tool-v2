import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as standupsSchema from './schema';
import * as teamSchema from '../teams/schema';
import { StandupsEntriesService } from './standups-entries.service';

type Database = NodePgDatabase<typeof standupsSchema & typeof teamSchema>;

const PROJECTION = 'standups';

@Injectable()
export class StandupsProjectionSyncService implements OnModuleInit {
  private readonly logger = new Logger(StandupsProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
    private readonly outbox: ProjectionOutboxService,
    private readonly standupsEntriesService: StandupsEntriesService,
  ) {}

  onModuleInit(): void {
    // Deliver outbox intents by recomputing current state from PostgreSQL.
    // Standups are composite-keyed: a sync intent's entityKey is
    // `${standupId}:${date}` and a delete intent's entityKey is the bare
    // standupId. entryDate ('YYYY-MM-DD') and standup ids contain no colon, so
    // splitting on the first colon cleanly recovers the pair.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) => {
      if (operation === 'delete') {
        return this.deleteStandupProjection(entityKey);
      }
      const idx = entityKey.indexOf(':');
      if (idx === -1) {
        // Malformed sync key with no date component — should never happen;
        // skip rather than risk a destructive projection write.
        return Promise.resolve();
      }
      const standupId = entityKey.slice(0, idx);
      const date = entityKey.slice(idx + 1);
      return this.syncEntryProjection(standupId, date);
    });
  }

  /**
   * Durably enqueue a standup entry (re)projection. Replaces the old
   * fire-and-forget push at call-sites: the intent commits to the outbox and is
   * delivered immediately (best-effort) plus guaranteed by the dispatcher.
   */
  async enqueueEntrySync(standupId: string, date: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: `${standupId}:${date}`,
    });
  }

  /** Durably enqueue removal of a standup projection. */
  async enqueueStandupDelete(standupId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: standupId,
    });
  }

  async syncEntryProjection(standupId: string, date: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    const [standup] = await this.database
      .select({
        id: standupsSchema.standup.id,
        teamId: standupsSchema.standup.teamId,
      })
      .from(standupsSchema.standup)
      .where(eq(standupsSchema.standup.id, standupId))
      .limit(1);

    if (!standup) {
      return;
    }

    const updatedAt = Date.now();

    await this.runMutation('liveStandups:upsertEntryProjection', {
      standupId: standup.id,
      entryDate: date,
      teamId: standup.teamId,
      updatedAt,
    });

    await this.syncEntryBoardSnapshots(
      standup.id,
      date,
      standup.teamId,
      updatedAt,
    );
  }

  async deleteStandupProjection(standupId: string): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    await this.runMutation('liveStandups:deleteStandupProjection', {
      standupId,
    });
  }

  /**
   * Rebuild every standup entry projection (entry room + per-member board
   * snapshots) from PostgreSQL. Iterates the `standupEntry` rows — each is a
   * (standupId, date) pair — and re-uses {@link syncEntryProjection} per entry
   * so the board fan-out logic stays in one place; each upsert stamps
   * `updatedAt` with a fresh `Date.now()`, which the reconciliation
   * orchestrator's mark-and-sweep (prune rows older than a timestamp captured
   * before this pass) relies on. Returns the number of entries scanned. No-ops
   * when Convex is unconfigured.
   */
  async syncAllStandups(): Promise<{ scanned: number }> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return { scanned: 0 };
    }

    const rows = await this.database
      .select({
        standupId: standupsSchema.standupEntry.standupId,
        entryDate: standupsSchema.standupEntry.entryDate,
      })
      .from(standupsSchema.standupEntry);

    for (const row of rows) {
      try {
        await this.syncEntryProjection(row.standupId, row.entryDate);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(
          `Reconcile: standup entry ${row.standupId}:${row.entryDate} projection failed: ${message}`,
        );
      }
    }

    return { scanned: rows.length };
  }

  private async syncEntryBoardSnapshots(
    standupId: string,
    date: string,
    teamId: string,
    updatedAt: number,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    if (members.length === 0) {
      return;
    }

    // Push every member's board snapshot. A failure propagates so the outbox
    // retries the whole (idempotent) delivery — re-pushing all members is safe.
    await Promise.all(
      members.map(async ({ userId }) => {
        const entryDetail = await this.standupsEntriesService.getEntryDetail(
          userId,
          standupId,
          date,
        );

        await this.runMutation('liveStandups:upsertStandupBoard', {
          standupId,
          entryDate: date,
          userId,
          snapshot: JSON.stringify({ entryDetail }),
          updatedAt,
        });
      }),
    );
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
        `Convex standup projection mutation ${path} failed with status ${response.status}`,
      );
    }

    const result = (await response.json()) as ConvexFunctionResponse;
    if (result.status === 'error') {
      throw new Error(
        `Convex standup projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
      );
    }
  }
}
