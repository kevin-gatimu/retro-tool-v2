import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'

declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>
  }
}

const modules = import.meta.glob('./**/*.ts')

describe('live team-membership projection', () => {
  it('upserts idempotently and rejects stale updates', async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.mutation(internal.liveTeamMembers.upsertMembership, {
        teamId: 'team-1',
        userId: 'user-1',
        updatedAt: 200,
      }),
    ).resolves.toEqual({ operation: 'created' })

    await expect(
      t.mutation(internal.liveTeamMembers.upsertMembership, {
        teamId: 'team-1',
        userId: 'user-1',
        updatedAt: 100,
      }),
    ).resolves.toEqual({ operation: 'noop' })

    const memberships = await t.run((ctx) =>
      ctx.db.query('liveTeamMembers').collect(),
    )
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toMatchObject({
      teamId: 'team-1',
      userId: 'user-1',
      updatedAt: 200,
    })
  })

  it('deletes memberships idempotently', async () => {
    const t = convexTest(schema, modules)
    const membership = { teamId: 'team-1', userId: 'user-1' }

    await t.mutation(internal.liveTeamMembers.upsertMembership, {
      ...membership,
      updatedAt: 100,
    })

    await expect(
      t.mutation(internal.liveTeamMembers.deleteMembership, membership),
    ).resolves.toEqual({ operation: 'deleted' })
    await expect(
      t.mutation(internal.liveTeamMembers.deleteMembership, membership),
    ).resolves.toEqual({ operation: 'noop' })
  })

  it('prunes only memberships older than the reconciliation timestamp', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.liveTeamMembers.upsertMembership, {
      teamId: 'team-1',
      userId: 'stale-user',
      updatedAt: 100,
    })
    await t.mutation(internal.liveTeamMembers.upsertMembership, {
      teamId: 'team-1',
      userId: 'current-user',
      updatedAt: 200,
    })

    await expect(
      t.mutation(internal.liveTeamMembers.pruneStaleMemberships, {
        olderThan: 200,
      }),
    ).resolves.toEqual({ deleted: 1, done: true })

    const memberships = await t.run((ctx) =>
      ctx.db.query('liveTeamMembers').collect(),
    )
    expect(memberships).toHaveLength(1)
    expect(memberships[0]?.userId).toBe('current-user')
  })
})
