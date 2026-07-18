import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Config } from '../config/configuration';
import type { NotificationsService } from '../notifications/notifications.service';
import type { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import type { ConvexAdminService } from './convex-admin.service';
import type { ProjectionOutboxService } from './projection-outbox.service';
import { ConvexAdminCronService } from './convex-admin-cron.service';

describe('ConvexAdminCronService', () => {
  const createService = (cronEnabled: boolean) => {
    const setCronService = jest.fn();
    const getCronConfig = jest.fn();
    const runMutation = jest.fn();
    const syncAllMemberships = jest.fn().mockResolvedValue({ count: 2 });
    const dispatchPending = jest.fn().mockResolvedValue({
      dispatched: 0,
      failed: 0,
      skippedSuperseded: 0,
      remaining: 0,
    });
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValue({ rows: [{ released: true }] });
    const schedulerRegistry = {
      deleteCronJob: jest.fn(),
      addCronJob: jest.fn(),
    } as unknown as SchedulerRegistry;
    const convexAdminService = {
      setCronService,
      getCronConfig,
      runMutation,
    } as unknown as ConvexAdminService;
    const projectionOutbox = {
      dispatchPending,
    } as unknown as ProjectionOutboxService;
    const teamsMembersProjectionSync = {
      syncAllMemberships,
    } as unknown as TeamsMembersProjectionSyncService;
    const notificationsService = {
      notifySuperAdminsOfTableClear: jest.fn(),
    } as unknown as NotificationsService;
    const configService = {
      get: jest.fn().mockReturnValue(cronEnabled),
    } as unknown as ConfigService<Config, true>;
    const database = {
      execute,
    } as unknown as NodePgDatabase;

    return {
      service: new ConvexAdminCronService(
        schedulerRegistry,
        convexAdminService,
        projectionOutbox,
        teamsMembersProjectionSync,
        notificationsService,
        configService,
        database,
      ),
      setCronService,
      getCronConfig,
      syncAllMemberships,
      dispatchPending,
      execute,
    };
  };

  it('does not register or execute scheduled work when cron is disabled', async () => {
    const {
      service,
      setCronService,
      getCronConfig,
      syncAllMemberships,
      dispatchPending,
      execute,
    } = createService(false);

    await service.onModuleInit();
    await service.reconcileTeamMemberships();
    await service.dispatchProjectionOutbox();

    expect(setCronService).toHaveBeenCalledWith(service);
    expect(getCronConfig).not.toHaveBeenCalled();
    expect(syncAllMemberships).not.toHaveBeenCalled();
    expect(dispatchPending).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('coordinates reconciliation with a PostgreSQL advisory lock', async () => {
    const { service, syncAllMemberships, execute } = createService(true);

    await service.reconcileTeamMemberships();

    expect(syncAllMemberships).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('dispatches the projection outbox under an advisory lock when cron is enabled', async () => {
    const { service, dispatchPending, execute } = createService(true);

    await service.dispatchProjectionOutbox();

    expect(dispatchPending).toHaveBeenCalledTimes(1);
    // lock acquire + release
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
