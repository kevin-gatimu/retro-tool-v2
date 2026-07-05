import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

const CLEARABLE_TABLES = [
  'liveRetroSessions',
  'liveEstimateSessions',
  'liveIcebreakerSessions',
  'liveRetroBoards',
  'liveEstimateBoards',
  'liveIcebreakerBoards',
  'liveStandupEntries',
  'liveStandupBoards',
  'liveNotifications',
  'livePresence',
  'liveTyping',
  'liveReadyStatus',
] as const

type ClearableTable = (typeof CLEARABLE_TABLES)[number]

/**
 * Clears the specified Convex tables. Called from NestJS admin API.
 * Only tables in the CLEARABLE_TABLES allowlist can be cleared.
 *
 * NOTE: For very large tables this may hit Convex mutation execution time limits.
 * In that case, split the clear operation across multiple calls (one table at a time).
 */
export const clearTables = internalMutation({
  args: {
    tableNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const cleared: string[] = []

    for (const name of args.tableNames) {
      if (!(CLEARABLE_TABLES as readonly string[]).includes(name)) {
        continue
      }

      const tableName = name as ClearableTable

      // eslint-disable-next-line no-await-in-loop
      const docs = await ctx.db.query(tableName).collect()
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)))

      cleared.push(name)
    }

    return { cleared }
  },
})
