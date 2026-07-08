import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { requireIdentity } from './lib/authz'

// ── Lightweight projection (used by the surveys list + active-count badge) ───
//
// PostgreSQL is the source of truth. NestJS pushes this projection after each
// survey mutation; the UI subscribes to `listSurveyProjections`, and on any
// change invalidates the REST-backed `['surveys']`, `['surveys-active-count']`,
// and `['survey', id]` queries (which re-apply per-viewer authorization, keep
// anonymity, and gate results). No response/answer data is stored here.

const surveyScope = v.union(
  v.literal('team'),
  v.literal('org'),
  v.literal('system'),
)

export const upsertSurveyProjection = internalMutation({
  args: {
    surveyId: v.string(),
    scope: surveyScope,
    teamId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    isClosed: v.boolean(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('liveSurveys')
      .withIndex('by_survey_id', (q) => q.eq('surveyId', args.surveyId))
      .unique()

    const next = {
      surveyId: args.surveyId,
      scope: args.scope,
      teamId: args.teamId,
      organizationId: args.organizationId,
      isClosed: args.isClosed,
      updatedAt: args.updatedAt,
    }

    if (existing) {
      // Stale-guard: ignore an out-of-order sync that predates what we have.
      if (args.updatedAt < existing.updatedAt) {
        return { surveyId: args.surveyId, operation: 'noop' as const }
      }
      await ctx.db.patch(existing._id, next)
      return { surveyId: args.surveyId, operation: 'updated' as const }
    }

    await ctx.db.insert('liveSurveys', next)
    return { surveyId: args.surveyId, operation: 'created' as const }
  },
})

export const deleteSurveyProjection = internalMutation({
  args: {
    surveyId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('liveSurveys')
      .withIndex('by_survey_id', (q) => q.eq('surveyId', args.surveyId))
      .unique()

    if (!existing) {
      return { surveyId: args.surveyId, operation: 'noop' as const }
    }

    await ctx.db.delete(existing._id)
    return { surveyId: args.surveyId, operation: 'deleted' as const }
  },
})

export const listSurveyProjections = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    const projections = await ctx.db.query('liveSurveys').collect()

    return projections
      .sort((left, right) => left.surveyId.localeCompare(right.surveyId))
      .map((projection) => ({
        surveyId: projection.surveyId,
        scope: projection.scope,
        isClosed: projection.isClosed,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})
