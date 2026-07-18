import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Config } from '../config/configuration';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { ConvexAdminService } from './convex-admin.service';
import { ProjectionOutboxService } from './projection-outbox.service';
import { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import { NotificationsService } from '../notifications/notifications.service';

const JOB_NAME = 'convex-table-clear';
const RECONCILE_LOCK_ID = 827401;
const TABLE_CLEAR_LOCK_ID = 827402;
const OUTBOX_DISPATCH_LOCK_ID = 827403;

@Injectable()
export class ConvexAdminCronService implements OnModuleInit {
  private readonly logger = new Logger(ConvexAdminCronService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly convexAdminService: ConvexAdminService,
    private readonly projectionOutbox: ProjectionOutboxService,
    private readonly teamsMembersProjectionSync: TeamsMembersProjectionSyncService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Config, true>,
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase,
  ) {}

  /**
   * Nightly self-heal for the Convex `liveTeamMembers` projection. The projection
   * is normally kept in sync by fire-and-forget pushes on each membership
   * mutation, but a dropped push would leave a caller unable to see (or wrongly
   * able to see) a team's realtime data. Rebuilding from PostgreSQL — the source
   * of truth — nightly bounds that drift. No-ops silently when Convex is unset.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async reconcileTeamMemberships(): Promise<void> {
    if (!this.cronEnabled()) {
      this.logger.debug(
        'Skipped Convex reconciliation because cron is disabled',
      );
      return;
    }

    await this.withAdvisoryLock(
      RECONCILE_LOCK_ID,
      'Convex team-membership reconciliation',
      async () => {
        try {
          const { count } =
            await this.teamsMembersProjectionSync.syncAllMemberships();
          this.logger.log(
            `Reconciled Convex team-membership projection (${count} rows)`,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'unknown error';
          this.logger.error(
            `Team-membership projection reconciliation failed: ${message}`,
          );
        }
      },
    );
  }

  /**
   * Deliver buffered projection events to Convex. Runs frequently so the outbox
   * stays close to real-time; gated by `ENABLE_CRON_JOBS` (only the serving API
   * slot dispatches) and a PostgreSQL advisory lock (only one instance at a
   * time). No-ops when the dispatcher is paused or Convex is unconfigured.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchProjectionOutbox(): Promise<void> {
    if (!this.cronEnabled()) {
      return;
    }

    await this.withAdvisoryLock(
      OUTBOX_DISPATCH_LOCK_ID,
      'Projection outbox dispatch',
      async () => {
        try {
          const result = await this.projectionOutbox.dispatchPending();
          if (result.dispatched > 0 || result.failed > 0) {
            this.logger.log(
              `Projection outbox: dispatched=${result.dispatched} failed=${result.failed} superseded=${result.skippedSuperseded} remaining=${result.remaining}`,
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'unknown error';
          this.logger.error(`Projection outbox dispatch failed: ${message}`);
        }
      },
    );
  }

  async onModuleInit(): Promise<void> {
    // Wire the back-reference so the service can call reschedule()
    this.convexAdminService.setCronService(this);

    if (!this.cronEnabled()) {
      this.logger.log('Convex scheduled jobs are disabled for this API slot');
      return;
    }

    const config = await this.convexAdminService.getCronConfig();
    if (config.enabled && config.tablesToClear.length > 0) {
      this.registerJob(config.schedule, config.tablesToClear);
    }
  }

  reschedule(config: {
    enabled: boolean;
    schedule: string;
    tablesToClear: string[];
  }): void {
    // Remove existing job if present
    try {
      this.schedulerRegistry.deleteCronJob(JOB_NAME);
      this.logger.debug('Removed existing Convex table-clear cron job');
    } catch {
      // Job didn't exist — that's fine
    }

    if (
      this.cronEnabled() &&
      config.enabled &&
      config.tablesToClear.length > 0
    ) {
      this.registerJob(config.schedule, config.tablesToClear);
    }
  }

  private registerJob(schedule: string, tablesToClear: string[]): void {
    const job: CronJob = new CronJob(schedule, async () => {
      this.logger.log(
        `Running scheduled Convex table clear for: ${tablesToClear.join(', ')}`,
      );
      await this.withAdvisoryLock(
        TABLE_CLEAR_LOCK_ID,
        'Convex table clear',
        async () => {
          try {
            const result = await this.convexAdminService.runMutation(
              'admin:clearTables',
              {
                tableNames: tablesToClear,
              },
            );
            this.logger.log(
              `Convex table clear completed. Cleared: ${result.cleared.join(', ')}`,
            );
            if (result.cleared.length > 0) {
              void this.notificationsService.notifySuperAdminsOfTableClear(
                result.cleared,
              );
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'unknown error';
            this.logger.error(
              `Scheduled Convex table clear failed: ${message}`,
            );
            void this.notificationsService.notifySuperAdminsOfTableClear(
              [],
              message,
            );
          }
        },
      );
    });

    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Registered Convex table-clear cron job: ${schedule}`);
  }

  private cronEnabled(): boolean {
    return this.configService.get('cronEnabled', { infer: true });
  }

  private async withAdvisoryLock(
    lockId: number,
    jobName: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const result = await this.database.execute(
      sql`SELECT pg_try_advisory_lock(${lockId}) AS acquired`,
    );
    const acquired = result.rows[0]?.acquired === true;

    if (!acquired) {
      this.logger.warn(`${jobName} skipped because another slot owns the lock`);
      return;
    }

    try {
      await operation();
    } finally {
      await this.database.execute(
        sql`SELECT pg_advisory_unlock(${lockId}) AS released`,
      );
    }
  }
}
