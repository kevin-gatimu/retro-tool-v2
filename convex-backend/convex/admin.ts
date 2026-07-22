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
  'livePolls',
  'liveSurveys',
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

// How many stale rows to delete per prune transaction. Keeps each mutation well
// within Convex's per-transaction document-write limit; the NestJS reconcile
// loop repeats the call until the table is clean.
const PRUNE_BATCH_SIZE = 200

// Projection tables eligible for mark-and-sweep pruning: those that carry an
// `updatedAt` stamp AND participate in reconciliation. The ephemeral tables
// (livePresence, liveTyping, liveReadyStatus) start empty and aren't
// reconciled, so they are deliberately excluded.
const PRUNABLE_TABLES = [
  'liveRetroSessions',
  'liveRetroBoards',
  'liveEstimateSessions',
  'liveEstimateBoards',
  'liveIcebreakerSessions',
  'liveIcebreakerBoards',
  'liveStandupEntries',
  'liveStandupBoards',
  'livePolls',
  'liveSurveys',
  'liveNotifications',
  'liveTeamMembers',
] as const

type PrunableTable = (typeof PRUNABLE_TABLES)[number]

/**
 * Generic mark-and-sweep prune for a single projection table, driven in bounded
 * steps so no single mutation does unbounded work (Convex query/mutation
 * guidelines):
 *
 *  1. NestJS stamps every live row with the reconcile timestamp during an
 *     upsert/snapshot pass.
 *  2. NestJS then calls this function repeatedly until `done` is true, deleting
 *     rows whose `updatedAt` predates that timestamp — projections with no
 *     matching source row left in Postgres — one bounded batch per call.
 *
 * Only tables in the PRUNABLE_TABLES allowlist are scanned; any other name
 * returns `{ deleted: 0, done: true }` without touching the database.
 */
export const pruneStaleByUpdatedAt = internalMutation({
  args: {
    tableName: v.string(),
    olderThan: v.number(),
  },
  handler: async (ctx, args) => {
    if (!(PRUNABLE_TABLES as readonly string[]).includes(args.tableName)) {
      return { deleted: 0, done: true }
    }

    const tableName = args.tableName as PrunableTable

    // No index on updatedAt, so filter post-scan — but the .take() keeps each
    // batch bounded regardless, and the caller repeats until `done`.
    const stale = await ctx.db
      .query(tableName)
      .filter((q) => q.lt(q.field('updatedAt'), args.olderThan))
      .take(PRUNE_BATCH_SIZE)

    await Promise.all(stale.map((row) => ctx.db.delete(row._id)))

    // A full batch means there may be more stale rows; the caller calls again.
    return { deleted: stale.length, done: stale.length < PRUNE_BATCH_SIZE }
  },
})
