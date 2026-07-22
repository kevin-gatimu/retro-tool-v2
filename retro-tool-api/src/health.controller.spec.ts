import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HealthController } from './health.controller';
import type { JwtAlignmentService } from './auth/jwt-alignment.service';
import type { JwtAlignmentStatus } from './auth/types';

// Test doubles: the controller only calls `database.execute(...)` and
// `jwtAlignment.check()`; the full NodePgDatabase / JwtAlignmentService surfaces
// are too large to stub and irrelevant here, so each helper stubs just the one
// method it uses behind a single documented cast.
function makeDb(execute: jest.Mock): NodePgDatabase {
  return { execute } as unknown as NodePgDatabase;
}

function makeJwtAlignmentCheck(check: jest.Mock): JwtAlignmentService {
  return { check } as unknown as JwtAlignmentService;
}

function makeJwtAlignment(status: JwtAlignmentStatus): JwtAlignmentService {
  return makeJwtAlignmentCheck(
    jest.fn().mockResolvedValue({
      status,
      issuer: 'http://localhost:8000',
      audience: 'convex',
      keyCount: status === 'ok' ? 1 : 0,
    }),
  );
}

const dbOk = () =>
  makeDb(jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }));

describe('HealthController', () => {
  it('returns ready when PostgreSQL and JWT alignment are both healthy', async () => {
    const controller = new HealthController(dbOk(), makeJwtAlignment('ok'));

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'connected', jwt: 'ok' },
    });
  });

  it('returns HTTP 503 semantics when PostgreSQL is unreachable', async () => {
    const database = makeDb(
      jest.fn().mockRejectedValue(new Error('database unavailable')),
    );
    const controller = new HealthController(database, makeJwtAlignment('ok'));

    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'unreachable', jwt: 'ok' },
      },
      status: 503,
    });
  });

  it('fails readiness (503) when JWT/JWKS is misaligned even if the DB is up', async () => {
    const controller = new HealthController(
      dbOk(),
      makeJwtAlignment('misaligned'),
    );

    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'connected', jwt: 'misaligned' },
      },
      status: 503,
    });
  });

  it('reports jwt: unreachable and fails readiness when the check itself throws', async () => {
    const jwtAlignment = makeJwtAlignmentCheck(
      jest.fn().mockRejectedValue(new Error('boom')),
    );
    const controller = new HealthController(dbOk(), jwtAlignment);

    await expect(controller.getReadiness()).rejects.toMatchObject({
      response: {
        status: 'not_ready',
        checks: { database: 'connected', jwt: 'unreachable' },
      },
      status: 503,
    });
  });

  it('liveness stays a pure process check, independent of JWKS', () => {
    const controller = new HealthController(
      makeDb(jest.fn()),
      makeJwtAlignment('ok'),
    );

    expect(controller.getLiveness()).toMatchObject({ status: 'alive' });
  });
});
