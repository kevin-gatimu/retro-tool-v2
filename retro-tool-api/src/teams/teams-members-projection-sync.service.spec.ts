import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ConvexMutationClientService } from '../convex-admin/convex-mutation-client.service';
import type { ProjectionOutboxService } from '../convex-admin/projection-outbox.service';
import { TeamsMembersProjectionSyncService } from './teams-members-projection-sync.service';
import type * as teamSchema from './schema';

type Database = NodePgDatabase<typeof teamSchema>;

describe('TeamsMembersProjectionSyncService', () => {
  const rows = [
    { userId: 'user-1', teamId: 'team-1' },
    { userId: 'user-2', teamId: 'team-1' },
  ];

  const build = () => {
    const from = jest.fn().mockResolvedValue(rows);
    const database = {
      select: jest.fn().mockReturnValue({ from }),
    } as unknown as Database;
    const isConfigured = jest.fn().mockReturnValue(true);
    const runMutation = jest.fn().mockResolvedValue(undefined);
    const runMutationForResult = jest
      .fn()
      .mockResolvedValue({ done: true, deleted: 0 });
    const convexClient = {
      isConfigured,
      runMutation,
      runMutationForResult,
    } as unknown as ConvexMutationClientService;
    const outbox = {
      registerHandler: jest.fn(),
    } as unknown as ProjectionOutboxService;

    return {
      service: new TeamsMembersProjectionSyncService(
        database,
        convexClient,
        outbox,
      ),
      isConfigured,
      runMutation,
      runMutationForResult,
    };
  };

  it('does not prune when an upsert fails', async () => {
    const { service, runMutation, runMutationForResult } = build();
    runMutation.mockRejectedValueOnce(new Error('upsert failed'));

    await expect(service.syncAllMemberships()).rejects.toThrow('upsert failed');
    expect(runMutationForResult).not.toHaveBeenCalled();
  });

  it('throws when pruning does not finish within the safety bound', async () => {
    const { service, runMutationForResult } = build();
    runMutationForResult.mockResolvedValue({ done: false });

    await expect(service.syncAllMemberships()).rejects.toThrow(
      'Membership prune exceeded 1000 batches',
    );
  });

  it('does nothing when Convex is not configured', async () => {
    const { service, isConfigured, runMutation, runMutationForResult } =
      build();
    isConfigured.mockReturnValue(false);

    await expect(service.syncAllMemberships()).resolves.toEqual({ count: 0 });
    expect(runMutation).not.toHaveBeenCalled();
    expect(runMutationForResult).not.toHaveBeenCalled();
  });
});
