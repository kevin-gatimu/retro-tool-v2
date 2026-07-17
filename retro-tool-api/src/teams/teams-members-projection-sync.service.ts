import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import * as teamSchema from './schema';

type Database = NodePgDatabase<typeof teamSchema>;

/**
 * Pushes a (userId, teamId) membership projection into Convex after each team
 * membership mutation. Convex holds no team data of its own, so its team-scoped
 * read queries use this projection to filter results to teams the authenticated
 * caller actually belongs to (SECURITY-ASSESSMENT F1). PostgreSQL remains the
 * source of truth; this is a fire-and-forget projection that no-ops silently
 * when Convex is not configured, and the reconciliation path heals any drift.
 */
@Injectable()
export class TeamsMembersProjectionSyncService {
  private readonly logger = new Logger(TeamsMembersProjectionSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config, true>,
  ) {}

  async syncMembership(userId: string, teamId: string): Promise<void> {
    await this.runMutation('liveTeamMembers:upsertMembership', {
      userId,
      teamId,
      updatedAt: Date.now(),
    });
  }

  async removeMembership(userId: string, teamId: string): Promise<void> {
    await this.runMutation('liveTeamMembers:deleteMembership', {
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
    const rows = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        teamId: teamSchema.teamMember.teamId,
      })
      .from(teamSchema.teamMember);

    const reconcileAt = Date.now();

    for (const row of rows) {
      await this.runMutation('liveTeamMembers:upsertMembership', {
        userId: row.userId,
        teamId: row.teamId,
        updatedAt: reconcileAt,
      });
    }

    // Sweep rows not touched by this reconcile (stale memberships). The Convex
    // side deletes one bounded batch per call and reports `done`; loop until the
    // table is clean. The iteration cap is a safety bound against a stuck server.
    const maxPruneBatches = 1000;
    for (let batch = 0; batch < maxPruneBatches; batch += 1) {
      const result = await this.runMutationForResult(
        'liveTeamMembers:pruneStaleMemberships',
        { olderThan: reconcileAt },
      );
      if (!result || result.done) {
        break;
      }
    }

    return { count: rows.length };
  }

  private async runMutation(path: string, args: object): Promise<void> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return;
    }

    try {
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
        this.logger.warn(
          `Convex team-member projection mutation ${path} failed with status ${response.status}`,
        );
        return;
      }

      const result = (await response.json()) as ConvexFunctionResponse;
      if (result.status === 'error') {
        this.logger.warn(
          `Convex team-member projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex team-member projection mutation ${path} failed: ${message}`,
      );
    }
  }

  /**
   * Like {@link runMutation} but returns the prune batch's `{ done }` result so
   * the reconcile loop knows when to stop. Returns `null` when Convex is unset or
   * the call fails (the loop then stops — a failed sweep is retried next cron).
   */
  private async runMutationForResult(
    path: string,
    args: object,
  ): Promise<{ done: boolean } | null> {
    const convexConfig = this.configService.get('convex', { infer: true });
    if (!convexConfig?.url || !convexConfig.adminKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${convexConfig.url.replace(/\/$/, '')}/api/mutation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Convex ${convexConfig.adminKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path, args, format: 'json' }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Convex team-member projection mutation ${path} failed with status ${response.status}`,
        );
        return null;
      }

      const result = (await response.json()) as ConvexFunctionResponse & {
        value?: { deleted: number; done: boolean };
      };
      if (result.status === 'error') {
        this.logger.warn(
          `Convex team-member projection mutation ${path} returned an error: ${result.errorMessage ?? 'unknown error'}`,
        );
        return null;
      }

      return { done: result.value?.done ?? true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Convex team-member projection mutation ${path} failed: ${message}`,
      );
      return null;
    }
  }
}
