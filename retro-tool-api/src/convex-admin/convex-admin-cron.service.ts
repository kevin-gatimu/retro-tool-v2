import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConvexAdminService } from './convex-admin.service';
import { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import { NotificationsService } from '../notifications/notifications.service';

const JOB_NAME = 'convex-table-clear';

@Injectable()
export class ConvexAdminCronService implements OnModuleInit {
  private readonly logger = new Logger(ConvexAdminCronService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly convexAdminService: ConvexAdminService,
    private readonly teamsMembersProjectionSync: TeamsMembersProjectionSyncService,
    private readonly notificationsService: NotificationsService,
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
    try {
      const { count } =
        await this.teamsMembersProjectionSync.syncAllMemberships();
      this.logger.log(
        `Reconciled Convex team-membership projection (${count} rows)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Team-membership projection reconciliation failed: ${message}`,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    // Wire the back-reference so the service can call reschedule()
    this.convexAdminService.setCronService(this);

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

    if (config.enabled && config.tablesToClear.length > 0) {
      this.registerJob(config.schedule, config.tablesToClear);
    }
  }

  private registerJob(schedule: string, tablesToClear: string[]): void {
    const job: CronJob = new CronJob(schedule, async () => {
      this.logger.log(
        `Running scheduled Convex table clear for: ${tablesToClear.join(', ')}`,
      );
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
        void this.notificationsService.notifySuperAdminsOfTableClear(
          result.cleared,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.error(`Scheduled Convex table clear failed: ${message}`);
        void this.notificationsService.notifySuperAdminsOfTableClear(
          [],
          message,
        );
      }
    });

    this.schedulerRegistry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Registered Convex table-clear cron job: ${schedule}`);
  }
}
