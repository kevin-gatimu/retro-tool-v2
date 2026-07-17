import { Test, TestingModule } from '@nestjs/testing';
import { RetrosService } from './retros.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

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

describe('RetrosService', () => {
  async function buildService(database: unknown): Promise<RetrosService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrosService,
        { provide: DATABASE_CONNECTION, useValue: database },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn(),
            sendNotifications: jest.fn(),
          },
        },
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    return module.get<RetrosService>(RetrosService);
  }

  it('should be defined', async () => {
    const service = await buildService({});
    expect(service).toBeDefined();
  });

  describe('isRetroMember (SECURITY-ASSESSMENT F2)', () => {
    it('returns true when the user belongs to the retro team', async () => {
      // 1st query: retro lookup → teamId; 2nd query: membership → found.
      const service = await buildService(
        createDatabaseMock([[{ teamId: 'team-1' }], [{ id: 'member-1' }]]),
      );

      await expect(service.isRetroMember('retro-1', 'user-1')).resolves.toBe(
        true,
      );
    });

    it('returns false when the user is not a member of the retro team', async () => {
      // 1st query: retro lookup → teamId; 2nd query: membership → empty.
      const service = await buildService(
        createDatabaseMock([[{ teamId: 'team-1' }], []]),
      );

      await expect(service.isRetroMember('retro-1', 'outsider')).resolves.toBe(
        false,
      );
    });

    it('returns false when the retro does not exist', async () => {
      // 1st query: retro lookup → empty, so no membership query runs.
      const service = await buildService(createDatabaseMock([[]]));

      await expect(
        service.isRetroMember('missing-retro', 'user-1'),
      ).resolves.toBe(false);
    });
  });
});
