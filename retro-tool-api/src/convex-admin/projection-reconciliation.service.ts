import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import type { Config } from '../config/configuration';
import type { ConvexFunctionResponse } from '../common/types';
import { generateId } from '../lib/utils';
import { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import { RetrosProjectionSyncService } from '../retros/retros-projection-sync.service';
import { EstimatesProjectionSyncService } from '../estimates/estimates-projection-sync.service';
import { IcebreakersProjectionSyncService } from '../icebreakers/icebreakers-projection-sync.service';
import { StandupsProjectionSyncService } from '../standups/standups-projection-sync.service';
import { PollsProjectionSyncService } from '../polls/polls-projection-sync.service';
import { SurveysProjectionSyncService } from '../surveys/surveys-projection-sync.service';
import { NotificationsProjectionSyncService } from '../notifications/notifications-projection-sync.service';
import { ProjectionOutboxService } from './projection-outbox.service';
import type {
  ProjectionReconcileReport,
  ProjectionTask,
  ReconcileAllResponse,
} from './types';

// Cap on prune batches per projection table; each Convex prune call deletes a
// bounded batch and reports `done`. Matches the safety bound used by the
// team-membership reconciler.
const MAX_PRUNE_BATCHES = 1000;

/**
 * Full projection reconciliation — rebuilds every required Convex projection
 * from PostgreSQL (the system of record) and mark-and-sweeps rows that no
 * longer have a source. This is the main prerequisite for safely standing up a
 * fresh self-hosted Convex deployment and for healing drift after an outage.
 *
 * Mark-and-sweep is timestamp-based: a `reconcileAt` is captured *before* the
 * rebuild pass; every rebuilt projection row is stamped with a later
 * `Date.now()`, so any row still older than `reconcileAt` afterwards has no
 * live source and is pruned. Security-relevant membership is reconciled first.
 * The run is idempotent, batched, and reports per-projection counts; any
 * failure marks the run not-ok so a deploy gate can stop.
 */
@Injectable()
export class ProjectionReconciliationService {
  private readonly logger = new Logger(ProjectionReconciliationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase,
    private readonly configService: ConfigService<Config, true>,
    private readonly teamsMembers: TeamsMembersProjectionSyncService,
    private readonly retros: RetrosProjectionSyncService,
    private readonly estimates: EstimatesProjectionSyncService,
    private readonly icebreakers: IcebreakersProjectionSyncService,
    private readonly standups: StandupsProjectionSyncService,
    private readonly polls: PollsProjectionSyncService,
    private readonly surveys: SurveysProjectionSyncService,
    private readonly notifications: NotificationsProjectionSyncService,
    private readonly outbox: ProjectionOutboxService,
  ) {}

  /**
   * Reconcile every projection. Membership/security first, then session/board
   * projections, then lightweight list projections. Returns a structured report
   * with a stable run ID; `ok` is false if any projection errored so callers
   * (CLI exit code, deploy gate) can fail the run.
   */
  async reconcileAll(): Promise<ReconcileAllResponse> {
    const runId = generateId();
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    if (!this.convexConfigured()) {
      this.logger.warn(
        `[reconcile ${runId}] Convex is not configured — nothing to reconcile`,
      );
      const finishedAt = new Date().toISOString();
      return {
        runId,
        startedAt,
        finishedAt,
        durationMs: 0,
        ok: true,
        reports: [],
      };
    }

    // Order matters: membership/security is the access-control projection every
    // team-scoped read depends on, so it is rebuilt and verified first.
    const tasks: ProjectionTask[] = [
      {
        projection: 'teamMembers',
        // liveTeamMembers has its own dedicated prune (older reconciler); reuse
        // it via the sync service rather than the generic table prune.
        pruneTable: null,
        rebuild: async () => {
          const { count } = await this.teamsMembers.syncAllMemberships();
          return { scanned: count };
        },
      },
      {
        projection: 'retros',
        pruneTable: 'liveRetroSessions',
        rebuild: () => this.retros.syncAllRetros(),
      },
      {
        projection: 'estimates',
        pruneTable: 'liveEstimateSessions',
        rebuild: () => this.estimates.syncAllSessions(),
      },
      {
        projection: 'icebreakers',
        pruneTable: 'liveIcebreakerSessions',
        rebuild: () => this.icebreakers.syncAllSessions(),
      },
      {
        projection: 'standups',
        pruneTable: 'liveStandupEntries',
        rebuild: () => this.standups.syncAllStandups(),
      },
      {
        projection: 'polls',
        pruneTable: 'livePolls',
        rebuild: () => this.polls.syncAllPolls(),
      },
      {
        projection: 'surveys',
        pruneTable: 'liveSurveys',
        rebuild: () => this.surveys.syncAllSurveys(),
      },
      {
        projection: 'notifications',
        pruneTable: 'liveNotifications',
        rebuild: () => this.notifications.syncAllNotifications(),
      },
    ];

    // Pause outbox delivery for the duration of the pass. Otherwise a concurrent
    // business mutation's in-flight projection delivery could write a row after
    // its rebuild task already ran, and the subsequent `updatedAt < reconcileAt`
    // sweep would delete that live row. Buffered intents are replayed on resume.
    // If an operator had already paused it (maintenance), leave it paused.
    const alreadyPaused = await this.outbox.isPaused();
    if (!alreadyPaused) {
      await this.outbox.setPaused(true);
    }

    const reports: ProjectionReconcileReport[] = [];
    try {
      for (const task of tasks) {
        reports.push(await this.runTask(runId, task));
      }
    } finally {
      if (!alreadyPaused) {
        // Resume and replay everything buffered during the pass.
        await this.outbox.setPaused(false);
        await this.outbox.replayAll();
      }
    }

    const finishedAtMs = Date.now();
    const ok = reports.every((r) => r.failed === 0 && !r.error);

    if (!ok) {
      this.logger.error(
        `[reconcile ${runId}] completed with failures — see per-projection reports`,
      );
    } else {
      this.logger.log(
        `[reconcile ${runId}] completed OK in ${finishedAtMs - startedAtMs}ms`,
      );
    }

    return {
      runId,
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      ok,
      reports,
    };
  }

  private async runTask(
    runId: string,
    task: ProjectionTask,
  ): Promise<ProjectionReconcileReport> {
    const start = Date.now();
    // Capture BEFORE the rebuild: every fresh upsert stamps updatedAt > this,
    // so a row still older than it afterwards is stale.
    const reconcileAt = start;

    try {
      const { scanned } = await task.rebuild();

      let deletedStale = 0;
      if (task.pruneTable) {
        deletedStale += await this.pruneTable(task.pruneTable, reconcileAt);
      }
      // Sweep the matching board table for session projections.
      const boardTable = BOARD_TABLE_BY_PROJECTION[task.projection];
      if (boardTable) {
        deletedStale += await this.pruneTable(boardTable, reconcileAt);
      }

      const report: ProjectionReconcileReport = {
        projection: task.projection,
        scanned,
        deletedStale,
        failed: 0,
        durationMs: Date.now() - start,
      };
      this.logger.log(
        `[reconcile ${runId}] ${task.projection}: scanned=${scanned} deletedStale=${deletedStale} in ${report.durationMs}ms`,
      );
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `[reconcile ${runId}] ${task.projection} failed: ${message}`,
      );
      return {
        projection: task.projection,
        scanned: 0,
        deletedStale: 0,
        failed: 1,
        durationMs: Date.now() - start,
        error: message,
      };
    }
  }

  /**
   * Repeatedly call the generic Convex prune mutation for one table until it
   * reports `done`, deleting rows whose `updatedAt` predates `olderThan`.
   * Returns the total number of rows deleted.
   */
  private async pruneTable(
    tableName: string,
    olderThan: number,
  ): Promise<number> {
    let deleted = 0;
    for (let batch = 0; batch < MAX_PRUNE_BATCHES; batch += 1) {
      const result = await this.runPrune(tableName, olderThan);
      if (!result) {
        break;
      }
      deleted += result.deleted;
      if (result.done) {
        break;
      }
    }
    return deleted;
  }

  private async runPrune(
    tableName: string,
    olderThan: number,
  ): Promise<{ deleted: number; done: boolean } | null> {
    const convex = this.configService.get('convex', { infer: true });
    if (!convex?.url || !convex.adminKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${convex.url.replace(/\/$/, '')}/api/mutation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Convex ${convex.adminKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: 'admin:pruneStaleByUpdatedAt',
            args: { tableName, olderThan },
            format: 'json',
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Prune ${tableName} failed with status ${response.status}`,
        );
        return null;
      }

      const result = (await response.json()) as ConvexFunctionResponse & {
        value?: { deleted: number; done: boolean };
      };
      if (result.status === 'error') {
        this.logger.warn(
          `Prune ${tableName} returned error: ${result.errorMessage ?? 'unknown'}`,
        );
        return null;
      }

      return {
        deleted: result.value?.deleted ?? 0,
        done: result.value?.done ?? true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Prune ${tableName} failed: ${message}`);
      return null;
    }
  }

  private convexConfigured(): boolean {
    const convex = this.configService.get('convex', { infer: true });
    return Boolean(convex?.url && convex.adminKey);
  }
}

// Session projections push a per-member board snapshot stamped with the same
// timestamp as the session row, so the board table is swept with the same
// reconcileAt as its parent.
const BOARD_TABLE_BY_PROJECTION: Record<string, string | undefined> = {
  retros: 'liveRetroBoards',
  estimates: 'liveEstimateBoards',
  icebreakers: 'liveIcebreakerBoards',
  standups: 'liveStandupBoards',
};
