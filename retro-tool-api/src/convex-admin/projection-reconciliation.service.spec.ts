import type { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Config } from '../config/configuration';
import { ProjectionReconciliationService } from './projection-reconciliation.service';
import type { TeamsMembersProjectionSyncService } from '../teams/teams-members-projection-sync.service';
import type { RetrosProjectionSyncService } from '../retros/retros-projection-sync.service';
import type { EstimatesProjectionSyncService } from '../estimates/estimates-projection-sync.service';
import type { IcebreakersProjectionSyncService } from '../icebreakers/icebreakers-projection-sync.service';
import type { StandupsProjectionSyncService } from '../standups/standups-projection-sync.service';
import type { PollsProjectionSyncService } from '../polls/polls-projection-sync.service';
import type { SurveysProjectionSyncService } from '../surveys/surveys-projection-sync.service';
import type { NotificationsProjectionSyncService } from '../notifications/notifications-projection-sync.service';
import type { ProjectionOutboxService } from './projection-outbox.service';

describe('ProjectionReconciliationService', () => {
  const build = (over?: {
    convexConfigured?: boolean;
    retrosThrows?: boolean;
  }) => {
    const order: string[] = [];
    const scanned = (name: string) =>
      jest.fn().mockImplementation(() => {
        order.push(name);
        return Promise.resolve({ scanned: 1 });
      });

    const teamsMembers = {
      syncAllMemberships: jest.fn().mockImplementation(() => {
        order.push('teamMembers');
        return Promise.resolve({ count: 3 });
      }),
    } as unknown as TeamsMembersProjectionSyncService;
    const retros = {
      syncAllRetros: over?.retrosThrows
        ? jest.fn().mockRejectedValue(new Error('boom'))
        : scanned('retros'),
    } as unknown as RetrosProjectionSyncService;
    const estimates = {
      syncAllSessions: scanned('estimates'),
    } as unknown as EstimatesProjectionSyncService;
    const icebreakers = {
      syncAllSessions: scanned('icebreakers'),
    } as unknown as IcebreakersProjectionSyncService;
    const standups = {
      syncAllStandups: scanned('standups'),
    } as unknown as StandupsProjectionSyncService;
    const polls = {
      syncAllPolls: scanned('polls'),
    } as unknown as PollsProjectionSyncService;
    const surveys = {
      syncAllSurveys: scanned('surveys'),
    } as unknown as SurveysProjectionSyncService;
    const notifications = {
      syncAllNotifications: scanned('notifications'),
    } as unknown as NotificationsProjectionSyncService;

    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          over?.convexConfigured === false
            ? { url: undefined, adminKey: undefined }
            : { url: 'https://convex.example', adminKey: 'k' },
        ),
    } as unknown as ConfigService<Config, true>;

    const database = {} as unknown as NodePgDatabase;

    // Outbox is paused for the pass and resumed+replayed after; mock both.
    const setPaused = jest.fn().mockResolvedValue(undefined);
    const replayAll = jest.fn().mockResolvedValue(undefined);
    const outbox = {
      isPaused: jest.fn().mockResolvedValue(false),
      setPaused,
      replayAll,
    } as unknown as ProjectionOutboxService;

    const service = new ProjectionReconciliationService(
      database,
      configService,
      teamsMembers,
      retros,
      estimates,
      icebreakers,
      standups,
      polls,
      surveys,
      notifications,
      outbox,
    );

    return { service, order, setPaused, replayAll };
  };

  afterEach(() => jest.restoreAllMocks());

  it('no-ops (ok, empty report) when Convex is unconfigured', async () => {
    const { service, order } = build({ convexConfigured: false });

    const report = await service.reconcileAll();

    expect(report.ok).toBe(true);
    expect(report.reports).toHaveLength(0);
    expect(order).toEqual([]);
  });

  it('reconciles membership/security first, then all projections, and prunes each', async () => {
    // Every Convex prune call succeeds and reports done immediately.
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          value: { deleted: 0, done: true },
        }),
        { status: 200 },
      ),
    );

    const { service, order } = build();
    const report = await service.reconcileAll();

    expect(order[0]).toBe('teamMembers');
    expect(report.ok).toBe(true);
    expect(report.reports.map((r) => r.projection)).toEqual([
      'teamMembers',
      'retros',
      'estimates',
      'icebreakers',
      'standups',
      'polls',
      'surveys',
      'notifications',
    ]);
  });

  it('marks the run not-ok when a projection rebuild throws', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          value: { deleted: 0, done: true },
        }),
        { status: 200 },
      ),
    );

    const { service } = build({ retrosThrows: true });
    const report = await service.reconcileAll();

    expect(report.ok).toBe(false);
    const retrosReport = report.reports.find((r) => r.projection === 'retros');
    expect(retrosReport?.failed).toBe(1);
    expect(retrosReport?.error).toContain('boom');
  });
});
