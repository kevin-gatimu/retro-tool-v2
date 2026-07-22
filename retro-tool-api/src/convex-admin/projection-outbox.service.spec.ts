import type { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Config } from '../config/configuration';
import { ProjectionOutboxService } from './projection-outbox.service';
import type { ProjectionOutboxRow } from './schema';

/**
 * Unit tests for the transactional projection outbox dispatch logic:
 * dedupe/supersede, pause gating, and retry-vs-exhaust. The Drizzle query
 * builder and `fetch` are stubbed so the tests exercise the service's own
 * decision-making without a database or network.
 */
describe('ProjectionOutboxService', () => {
  const convex = { url: 'https://convex.example', adminKey: 'k' };

  const makeRow = (
    over: Partial<ProjectionOutboxRow>,
  ): ProjectionOutboxRow => ({
    id: 'id',
    projection: 'retros',
    operation: 'sync',
    entityKey: 'r1',
    payload: null,
    dedupeKey: 'retros:sync:r1',
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(0),
    // Old timestamp so per-entity coalescing treats the row as past its debounce
    // + maxWait window and delivers immediately; tests that exercise coalescing
    // timing override createdAt explicitly.
    createdAt: new Date(0),
    dispatchedAt: null,
    ...over,
  });

  /**
   * Build a service whose DB `select ... limit` resolves to `pendingBatch`,
   * whose `count` reads resolve to 0, and whose update/insert are captured.
   */
  const createService = (params: {
    pendingBatch: ProjectionOutboxRow[];
    paused?: boolean;
    pausedUpdatedAt?: Date;
  }) => {
    const updates: Array<{ status?: string; nextAttemptAt?: Date }> = [];

    // A select chain that dispatches based on which table/columns are queried.
    const database = {
      select: jest.fn((columns?: Record<string, unknown>) => {
        const isPausedRead = columns && 'paused' in columns;
        const isCountRead = columns && 'count' in columns;
        // The global newest-per-key query selects dedupeKey+id+createdAt and is
        // awaited directly on .where() (no .limit) — resolve it to the batch's
        // (id, dedupeKey, createdAt) so newest-per-key resolves to the batch.
        const isNewestRead =
          columns && 'dedupeKey' in columns && 'id' in columns;
        const newestRows = params.pendingBatch.map((r) => ({
          dedupeKey: r.dedupeKey,
          id: r.id,
          createdAt: r.createdAt,
        }));
        const chain = {
          from: () => chain,
          where: () => chain,
          orderBy: () => chain,
          limit: (n: number) => {
            if (isPausedRead) {
              return Promise.resolve([
                {
                  paused: params.paused ?? false,
                  // Fresh by default so existing "currently paused" tests are
                  // unaffected by the staleness check; override to exercise it.
                  updatedAt: params.pausedUpdatedAt ?? new Date(),
                },
              ]);
            }
            if (n === 1) {
              // oldestPending / control single-row reads
              return Promise.resolve([]);
            }
            return Promise.resolve(params.pendingBatch);
          },
          // Reads awaited directly on .where(): count, and newest-per-key.
          then: (resolve: (rows: unknown[]) => void) =>
            resolve(
              isCountRead ? [{ count: 0 }] : isNewestRead ? newestRows : [],
            ),
        };
        return chain;
      }),
      update: jest.fn(() => ({
        set: (patch: { status?: string; nextAttemptAt?: Date }) => ({
          where: () => {
            updates.push(patch);
            return Promise.resolve();
          },
        }),
      })),
      // Only exercised by setPaused's upsert (e.g. the stale-pause auto-heal).
      insert: jest.fn(() => ({
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      })),
    } as unknown as NodePgDatabase<never>;

    const configService = {
      get: jest.fn().mockReturnValue(convex),
    } as unknown as ConfigService<Config, true>;

    const service = new ProjectionOutboxService(
      database as never,
      configService,
    );
    return { service, updates };
  };

  afterEach(() => jest.restoreAllMocks());

  it('does not dispatch when the dispatcher is paused', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { service } = createService({ pendingBatch: [], paused: true });
    service.registerHandler('retros', jest.fn());

    const result = await service.dispatchPending();

    expect(result.dispatched).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('auto-resumes and dispatches when the pause is stale (older than 15min)', async () => {
    const row = makeRow({});
    const { service } = createService({
      pendingBatch: [row],
      paused: true,
      pausedUpdatedAt: new Date(Date.now() - 20 * 60_000),
    });
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerHandler('retros', handler);

    const result = await service.dispatchPending();

    expect(result.dispatched).toBe(1);
    expect(handler).toHaveBeenCalled();
  });

  it('stays paused when the pause is recent (within 15min)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { service } = createService({
      pendingBatch: [],
      paused: true,
      pausedUpdatedAt: new Date(Date.now() - 5 * 60_000),
    });
    service.registerHandler('retros', jest.fn());

    const result = await service.dispatchPending();

    expect(result.dispatched).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('delivers the newest row per dedupeKey and supersedes older ones', async () => {
    const older = makeRow({ id: 'a', createdAt: new Date(1) });
    const newer = makeRow({ id: 'b', createdAt: new Date(2) });
    const { service, updates } = createService({
      pendingBatch: [older, newer],
    });

    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerHandler('retros', handler);

    const result = await service.dispatchPending();

    // Only one real delivery (the newest); the older is closed as superseded.
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('sync', 'r1', null);
    expect(result.dispatched).toBe(1);
    expect(result.skippedSuperseded).toBe(1);
    // Both rows get marked dispatched.
    expect(updates.filter((u) => u.status === 'dispatched')).toHaveLength(2);
  });

  it('retries a failed delivery (stays pending) until attempts are exhausted', async () => {
    const row = makeRow({ id: 'a', attempts: 0 });
    const { service, updates } = createService({ pendingBatch: [row] });
    service.registerHandler(
      'retros',
      jest.fn().mockRejectedValue(new Error('convex down')),
    );

    const result = await service.dispatchPending();

    expect(result.failed).toBe(1);
    // Not exhausted yet → remains pending for the next dispatch tick.
    expect(updates.at(-1)?.status).toBe('pending');
  });

  it('marks a delivery failed once attempts are exhausted', async () => {
    const row = makeRow({ id: 'a', attempts: 9 }); // 9 + 1 === MAX_ATTEMPTS (10)
    const { service, updates } = createService({ pendingBatch: [row] });
    service.registerHandler(
      'retros',
      jest.fn().mockRejectedValue(new Error('convex down')),
    );

    const result = await service.dispatchPending();

    expect(result.failed).toBe(1);
    expect(updates.at(-1)?.status).toBe('failed');
  });

  it('fails a row whose projection has no registered handler', async () => {
    const row = makeRow({ id: 'a', projection: 'unknown' });
    const { service } = createService({ pendingBatch: [row] });

    const result = await service.dispatchPending();

    expect(result.failed).toBe(1);
    expect(result.dispatched).toBe(0);
  });

  it('pushes nextAttemptAt into the future with backoff on a failed delivery', async () => {
    const row = makeRow({ id: 'a', attempts: 0 });
    const { service, updates } = createService({ pendingBatch: [row] });
    service.registerHandler(
      'retros',
      jest.fn().mockRejectedValue(new Error('convex down')),
    );

    const before = Date.now();
    await service.dispatchPending();

    const failUpdate = updates.at(-1);
    expect(failUpdate?.status).toBe('pending');
    // Backoff base is 2s; the retry must be scheduled at least ~1s out (allowing
    // for clock skew) rather than being immediately re-eligible.
    const nextAttemptAt = failUpdate?.nextAttemptAt;
    expect(nextAttemptAt).toBeInstanceOf(Date);
    expect((nextAttemptAt as Date).getTime()).toBeGreaterThan(before + 1_000);
  });

  it('holds a freshly-created row for coalescing instead of delivering immediately', async () => {
    // createdAt = now → inside the debounce window, so it should be held back
    // (not delivered, not superseded) this pass.
    const fresh = makeRow({ id: 'a', createdAt: new Date() });
    const { service } = createService({ pendingBatch: [fresh] });
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerHandler('retros', handler);

    const result = await service.dispatchPending();

    expect(handler).not.toHaveBeenCalled();
    expect(result.dispatched).toBe(0);
    expect(result.skippedSuperseded).toBe(0);
  });
});
