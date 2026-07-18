import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ready when PostgreSQL is reachable', async () => {
    const database = {
      execute: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    } as unknown as NodePgDatabase;
    const controller = new HealthController(database);

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'connected' },
    });
  });

  it('returns HTTP 503 semantics when PostgreSQL is unreachable', async () => {
    const database = {
      execute: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as NodePgDatabase;
    const controller = new HealthController(database);

    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'unreachable' },
      },
      status: 503,
    });
  });
});
