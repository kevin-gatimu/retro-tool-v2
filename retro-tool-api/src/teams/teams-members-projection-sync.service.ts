import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import * as teamSchema from './schema';

type Database = NodePgDatabase<typeof teamSchema>;

const PROJECTION = 'teamMembers';
const MAX_PRUNE_BATCHES = 1000;

/**
 * Projects (userId, teamId) team memberships into Convex. Convex holds no team
 * data of its own, so its team-scoped read queries use this projection to filter
 * results to teams the authenticated caller actually belongs to
 * (SECURITY-ASSESSMENT F1). PostgreSQL remains the source of truth.
 *
 * Live membership changes are enqueued through the transactional outbox (durable
 * + replayable across a Convex maintenance window); the nightly reconcile and
 * `syncAllMemberships` mark-and-sweep heal any residual drift.
 */
@Injectable()
export class TeamsMembersProjectionSyncService implements OnModuleInit {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly convexClient: ConvexMutationClientService,
    private readonly outbox: ProjectionOutboxService,
  ) {}

  onModuleInit(): void {
    // entityKey is `<userId>:<teamId>`; sync upserts, delete removes.
    this.outbox.registerHandler(PROJECTION, (operation, entityKey) => {
      const sep = entityKey.indexOf(':');
      const userId = entityKey.slice(0, sep);
      const teamId = entityKey.slice(sep + 1);
      return operation === 'delete'
        ? this.removeMembership(userId, teamId)
        : this.syncMembership(userId, teamId);
    });
  }

  /** Durably enqueue a membership upsert (userId joined teamId). */
  async enqueueMembershipSync(userId: string, teamId: string): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'sync',
      entityKey: `${userId}:${teamId}`,
    });
  }

  /** Durably enqueue a membership removal (userId left teamId). */
  async enqueueMembershipRemoval(
    userId: string,
    teamId: string,
  ): Promise<void> {
    await this.outbox.enqueueAndDispatch({
      projection: PROJECTION,
      operation: 'delete',
      entityKey: `${userId}:${teamId}`,
    });
  }

  async syncMembership(userId: string, teamId: string): Promise<void> {
    await this.convexClient.runMutation('liveTeamMembers:upsertMembership', {
      userId,
      teamId,
      updatedAt: Date.now(),
    });
  }

  async removeMembership(userId: string, teamId: string): Promise<void> {
    await this.convexClient.runMutation('liveTeamMembers:deleteMembership', {
      userId,
      teamId,
    });
  }

  /**
   * Reconcile the whole projection from PostgreSQL — used to backfill existing
   * memberships on first deploy and to heal drift from the cron. Mark-and-sweep:
   * upsert every `team_member` row stamped with a single reconcile timestamp,
   * then prune rows older than it (memberships that no longer exist in Postgres).
   * Each Convex call is bounded — per-row upserts and repeated fixed-size prune
   * batches — so no single mutation does unbounded work.
   */
  async syncAllMemberships(): Promise<{ count: number }> {
    if (!this.convexClient.isConfigured()) {
      return { count: 0 };
    }

    const rows = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        teamId: teamSchema.teamMember.teamId,
      })
      .from(teamSchema.teamMember);

    const reconcileAt = Date.now();

    for (const row of rows) {
      await this.convexClient.runMutation('liveTeamMembers:upsertMembership', {
        userId: row.userId,
        teamId: row.teamId,
        updatedAt: reconcileAt,
      });
    }

    // Sweep rows not touched by this reconcile (stale memberships). The Convex
    // side deletes one bounded batch per call and reports `done`; loop until the
    // table is clean. The iteration cap is a safety bound against a stuck server.
    for (let batch = 0; batch < MAX_PRUNE_BATCHES; batch += 1) {
      const result = await this.convexClient.runMutationForResult<{
        done: boolean;
      }>('liveTeamMembers:pruneStaleMemberships', { olderThan: reconcileAt });
      if (!result) {
        throw new Error('Membership prune returned no result');
      }
      if (result.done) {
        return { count: rows.length };
      }
    }

    throw new Error(`Membership prune exceeded ${MAX_PRUNE_BATCHES} batches`);
  }
}
