import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { TeamReportAccessGuard } from './team-report-access.guard';
import { OrgReportAccessGuard } from './org-report-access.guard';
import { SystemReportAccessGuard } from './system-report-access.guard';

/**
 * Queue-based Drizzle mock: each `select()` chain resolves the next queued
 * result. Chains are self-returning and awaitable at any depth.
 */
function mockDb(results: unknown[][]) {
  let call = 0;
  const chain = () => {
    const rows = results[call++] ?? [];
    const builder: Record<string, unknown> = {};
    const self = () => builder;
    for (const method of [
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'limit',
      'groupBy',
      'orderBy',
      'offset',
    ]) {
      builder[method] = self;
    }
    builder.then = (resolve: (value: unknown) => void) => resolve(rows);
    return builder;
  };
  return { select: jest.fn(chain) };
}

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const sessionFor = (userId: string | undefined) => ({
  session: userId ? { user: { id: userId } } : undefined,
});

describe('TeamReportAccessGuard', () => {
  const request = (userId?: string, teamId?: string) => ({
    ...sessionFor(userId),
    params: teamId ? { teamId } : {},
    reportAccess: undefined as { isLead: boolean } | undefined,
  });

  it('rejects unauthenticated callers', async () => {
    const guard = new TeamReportAccessGuard(mockDb([]) as never);
    await expect(
      guard.canActivate(httpContext(request(undefined, 't1'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('404s when the team does not exist', async () => {
    const guard = new TeamReportAccessGuard(mockDb([[]]) as never);
    await expect(
      guard.canActivate(httpContext(request('u1', 'missing'))),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a non-member with no admin role', async () => {
    const db = mockDb([
      [{ organizationId: 'o1' }], // team lookup
      [{ role: 'member' }], // user role
      [], // org membership
      [], // team membership
    ]);
    const guard = new TeamReportAccessGuard(db as never);
    await expect(
      guard.canActivate(httpContext(request('u1', 't1'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants a plain member without lead access', async () => {
    const db = mockDb([
      [{ organizationId: 'o1' }],
      [{ role: 'member' }],
      [],
      [{ tag: 'member' }],
    ]);
    const guard = new TeamReportAccessGuard(db as never);
    const req = request('u1', 't1');
    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
    expect(req.reportAccess).toEqual({ isLead: false });
  });

  it('grants a team-lead with lead access (tag, not legacy user.role)', async () => {
    const db = mockDb([
      [{ organizationId: 'o1' }],
      [{ role: 'member' }],
      [],
      [{ tag: 'team-lead' }],
    ]);
    const guard = new TeamReportAccessGuard(db as never);
    const req = request('u1', 't1');
    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
    expect(req.reportAccess).toEqual({ isLead: true });
  });

  it('cascades org-admin to lead access even without team membership', async () => {
    const db = mockDb([
      [{ organizationId: 'o1' }],
      [{ role: 'member' }],
      [{ role: 'org-admin' }],
      [],
    ]);
    const guard = new TeamReportAccessGuard(db as never);
    const req = request('u1', 't1');
    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true);
    expect(req.reportAccess).toEqual({ isLead: true });
  });
});

describe('OrgReportAccessGuard', () => {
  const request = (userId?: string, orgId?: string) => ({
    ...sessionFor(userId),
    params: orgId ? { orgId } : {},
  });

  it('rejects a plain org member', async () => {
    const db = mockDb([
      [{ id: 'o1' }], // org lookup
      [{ role: 'member' }], // user role
      [{ role: 'member' }], // org membership
    ]);
    const guard = new OrgReportAccessGuard(db as never);
    await expect(
      guard.canActivate(httpContext(request('u1', 'o1'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants an org-owner', async () => {
    const db = mockDb([
      [{ id: 'o1' }],
      [{ role: 'member' }],
      [{ role: 'org-owner' }],
    ]);
    const guard = new OrgReportAccessGuard(db as never);
    await expect(
      guard.canActivate(httpContext(request('u1', 'o1'))),
    ).resolves.toBe(true);
  });

  it('grants a system-admin without org membership', async () => {
    const db = mockDb([[{ id: 'o1' }], [{ role: 'system-admin' }]]);
    const guard = new OrgReportAccessGuard(db as never);
    await expect(
      guard.canActivate(httpContext(request('u1', 'o1'))),
    ).resolves.toBe(true);
  });
});

describe('SystemReportAccessGuard', () => {
  const request = (userId?: string) => ({ ...sessionFor(userId), params: {} });

  it('rejects a plain member', async () => {
    const db = mockDb([[{ role: 'member' }]]);
    const guard = new SystemReportAccessGuard(db as never);
    await expect(
      guard.canActivate(httpContext(request('u1'))),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants a super-admin', async () => {
    const db = mockDb([[{ role: 'super-admin' }]]);
    const guard = new SystemReportAccessGuard(db as never);
    await expect(guard.canActivate(httpContext(request('u1')))).resolves.toBe(
      true,
    );
  });
});
