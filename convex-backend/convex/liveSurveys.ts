import { query, internalMutation } from './server'
import { v } from 'convex/values'
import { getCallerTeamIds, isAdminRole, requireIdentity } from './lib/authz'
import { LIST_PROJECTION_CAP } from './lib/limits'

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
    const identity = await requireIdentity(ctx)
    const projections = await ctx.db.query('liveSurveys').collect()

    // Team-scoped surveys are filtered to the caller's teams (`null` = admin,
    // pass all). Org/system-scoped surveys stay visible: Convex holds no
    // org-membership data, and this projection is only an invalidation signal —
    // the REST list the UI refetches re-applies full per-viewer authorization.
    // Documented F1 residual.
    const teamIds = isAdminRole(identity.role)
      ? null
      : await getCallerTeamIds(ctx, identity.subject)

    return projections
      .filter((projection) => {
        if (!teamIds || projection.scope !== 'team') return true
        return projection.teamId !== undefined && teamIds.has(projection.teamId)
      })
      .sort((left, right) => left.surveyId.localeCompare(right.surveyId))
      .slice(0, LIST_PROJECTION_CAP)
      .map((projection) => ({
        surveyId: projection.surveyId,
        scope: projection.scope,
        isClosed: projection.isClosed,
        updatedAt: new Date(projection.updatedAt).toISOString(),
      }))
  },
})
