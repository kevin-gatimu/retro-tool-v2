import { ForbiddenException } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import type { DashboardsService } from './dashboards.service';
import type { ReportsRequestSession } from './types';

describe('DashboardsController', () => {
  const service = {
    getPersonalReport: jest.fn().mockResolvedValue({ ok: 'me' }),
    getTeamReport: jest.fn().mockResolvedValue({ ok: 'team' }),
    getOrgReport: jest.fn().mockResolvedValue({ ok: 'org' }),
    getPlatformReport: jest.fn().mockResolvedValue({ ok: 'platform' }),
    getTeamMembersLeague: jest.fn().mockResolvedValue({ rows: [] }),
    getOrgTeamsLeague: jest.fn().mockResolvedValue({ rows: [] }),
    getPlatformOrgsLeague: jest.fn().mockResolvedValue({ rows: [] }),
  };
  const controller = new DashboardsController(
    service as unknown as DashboardsService,
  );

  const requestWith = (isLead: boolean | undefined): ReportsRequestSession =>
    ({
      session: { user: { id: 'u1' } },
      reportAccess: isLead === undefined ? undefined : { isLead },
      params: {},
    }) as ReportsRequestSession;

  beforeEach(() => jest.clearAllMocks());

  it('scopes /me to the session user', async () => {
    await controller.getMyReport({}, { user: { id: 'u1' } });
    expect(service.getPersonalReport).toHaveBeenCalledWith('u1', {});
  });

  it('passes the guard-derived isLead flag to the team report', async () => {
    await controller.getTeamReport('t1', {}, requestWith(true));
    expect(service.getTeamReport).toHaveBeenCalledWith('t1', {}, true);
  });

  it('defaults isLead to false when the guard attached nothing', async () => {
    await controller.getTeamReport('t1', {}, requestWith(undefined));
    expect(service.getTeamReport).toHaveBeenCalledWith('t1', {}, false);
  });

  it('rejects the member league for non-leads (server-side shaping)', async () => {
    const query = { page: 1, pageSize: 20 };
    await expect(
      controller.getTeamMembersLeague('t1', query, requestWith(false)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getTeamMembersLeague).not.toHaveBeenCalled();
  });

  it('serves the member league to leads', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.getTeamMembersLeague('t1', query, requestWith(true));
    expect(service.getTeamMembersLeague).toHaveBeenCalledWith('t1', query);
  });
});
