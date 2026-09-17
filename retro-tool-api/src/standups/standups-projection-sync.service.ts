import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { mapWithConcurrency } from '../lib/concurrency';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as standupsSchema from './schema';
import * as teamSchema from '../teams/schema';
import { StandupsEntriesService } from './standups-entries.service';

type Database = NodePgDatabase<typeof standupsSchema & typeof teamSchema>;

const PROJECTION = 'standups';

@Injectable()
export class StandupsProjectionSyncService implements OnModuleInit {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly convexClient: ConvexMutationClientService,
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
    if (!this.convexClient.isConfigured()) {
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

    await this.convexClient.runMutation('liveStandups:upsertEntryProjection', {
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
    if (!this.convexClient.isConfigured()) {
      return;
    }

    await this.convexClient.runMutation(
      'liveStandups:deleteStandupProjection',
      {
        standupId,
      },
    );
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
    if (!this.convexClient.isConfigured()) {
      return { scanned: 0 };
    }

    const rows = await this.database
      .select({
        standupId: standupsSchema.standupEntry.standupId,
        entryDate: standupsSchema.standupEntry.entryDate,
      })
      .from(standupsSchema.standupEntry);

    for (const row of rows) {
      await this.syncEntryProjection(row.standupId, row.entryDate);
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
    await mapWithConcurrency(members, 2, async ({ userId }) => {
      const entryDetail = await this.standupsEntriesService.getEntryDetail(
        userId,
        standupId,
        date,
      );

      await this.convexClient.runMutation('liveStandups:upsertStandupBoard', {
        standupId,
        entryDate: date,
        userId,
        snapshot: JSON.stringify({ entryDetail }),
        updatedAt,
      });
    });
  }
}
