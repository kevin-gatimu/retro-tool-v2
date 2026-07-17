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
});
