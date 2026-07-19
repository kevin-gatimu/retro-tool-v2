import { Test, TestingModule } from '@nestjs/testing';
import { EstimatesService } from './estimates.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

/**
 * A Drizzle select chain (`select().from().where().limit()`) that resolves to
 * the next queued row set. Each call to `select()` shifts one result off the
 * queue, so a method issuing two sequential queries reads two queued arrays.
 */
interface SelectChainMock {
  select: () => SelectChainMock;
  from: () => SelectChainMock;
  where: () => SelectChainMock;
  leftJoin: () => SelectChainMock;
  limit: () => Promise<unknown[]>;
}

function createDatabaseMock(resultQueue: unknown[][]): SelectChainMock {
  const results = [...resultQueue];
  const chain: SelectChainMock = {
    select: jest.fn((): SelectChainMock => chain),
    from: jest.fn((): SelectChainMock => chain),
    where: jest.fn((): SelectChainMock => chain),
    leftJoin: jest.fn((): SelectChainMock => chain),
    limit: jest.fn(
      (): Promise<unknown[]> => Promise.resolve(results.shift() ?? []),
    ),
  };
  return chain;
}

describe('EstimatesService', () => {
  async function buildService(database: unknown): Promise<EstimatesService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimatesService,
        { provide: DATABASE_CONNECTION, useValue: database },
        {
          provide: NotificationsService,
          useValue: { notifyTeamOfEstimateSession: jest.fn() },
        },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
      ],
    }).compile();

    return module.get<EstimatesService>(EstimatesService);
  }

  it('should be defined', async () => {
    const service = await buildService({});
    expect(service).toBeDefined();
  });

  describe('isSessionMember (SECURITY-ASSESSMENT F2)', () => {
    it('returns true when the user belongs to the session team', async () => {
      // 1st query: session record → teamId; 2nd query: membership → found.
      const service = await buildService(
        createDatabaseMock([
          [{ id: 'session-1', teamId: 'team-1' }],
          [{ id: 'member-1' }],
        ]),
      );

      await expect(
        service.isSessionMember('session-1', 'user-1'),
      ).resolves.toBe(true);
    });

    it('returns false when the user is not a member of the session team', async () => {
      // 1st query: session record → teamId; 2nd query: membership → empty.
      const service = await buildService(
        createDatabaseMock([[{ id: 'session-1', teamId: 'team-1' }], []]),
      );

      await expect(
        service.isSessionMember('session-1', 'outsider'),
      ).resolves.toBe(false);
    });
  });

  describe('canControlSession (creator OR team-lead only)', () => {
    it('returns true for the session creator', async () => {
      // 1st query: session row → createdById matches userId (short-circuits).
      const service = await buildService(
        createDatabaseMock([[{ createdById: 'creator-1', teamId: 'team-1' }]]),
      );

      await expect(
        service.canControlSession('session-1', 'creator-1'),
      ).resolves.toBe(true);
    });

    it('returns true for a non-creator team lead', async () => {
      // 1st query: session row; 2nd query: teamMember tag → team-lead.
      const service = await buildService(
        createDatabaseMock([
          [{ createdById: 'creator-1', teamId: 'team-1' }],
          [{ tag: 'team-lead' }],
        ]),
      );

      await expect(
        service.canControlSession('session-1', 'lead-1'),
      ).resolves.toBe(true);
    });

    it('returns false for a plain team member', async () => {
      const service = await buildService(
        createDatabaseMock([
          [{ createdById: 'creator-1', teamId: 'team-1' }],
          [{ tag: 'member' }],
        ]),
      );

      await expect(
        service.canControlSession('session-1', 'member-1'),
      ).resolves.toBe(false);
    });

    it('returns false for an org-admin who is not creator or team lead', async () => {
      // canControlSession never consults org/system role — only the team-member
      // row is read, which for an org-admin outsider is empty.
      const service = await buildService(
        createDatabaseMock([
          [{ createdById: 'creator-1', teamId: 'team-1' }],
          [],
        ]),
      );

      await expect(
        service.canControlSession('session-1', 'org-admin-1'),
      ).resolves.toBe(false);
    });
  });

  describe('canManageSession (broad set — end/delete session)', () => {
    it('returns true for an org-admin (allowed to end the session)', async () => {
      // 1st: session+team row (orgId); 2nd: user role (plain member);
      // 3rd: org membership → org-admin ⇒ true.
      const service = await buildService(
        createDatabaseMock([
          [{ createdById: 'creator-1', teamId: 'team-1', orgId: 'org-1' }],
          [{ role: 'member' }],
          [{ role: 'org-admin' }],
        ]),
      );

      await expect(
        service.canManageSession('session-1', 'org-admin-1'),
      ).resolves.toBe(true);
    });

    it('returns false for a plain member (cannot end the session)', async () => {
      const service = await buildService(
        createDatabaseMock([
          [{ createdById: 'creator-1', teamId: 'team-1', orgId: 'org-1' }],
          [{ role: 'member' }],
          [{ role: 'member' }],
          [{ tag: 'member' }],
        ]),
      );

      await expect(
        service.canManageSession('session-1', 'member-1'),
      ).resolves.toBe(false);
    });
  });
});
