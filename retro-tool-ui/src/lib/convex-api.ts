import { makeFunctionReference } from 'convex/server'

/**
 * Typed references to the Convex functions the UI subscribes to.
 *
 * The UI can't import the backend's generated `api` object (it lives in the
 * separate `convex-backend` package and would pull the whole backend module
 * graph into the UI's strict `tsc` program), so we build the references here
 * with Convex's official `makeFunctionReference(name)` helper. It returns a
 * properly-typed `FunctionReference` from a `module:function` name — the same
 * mechanism `anyApi` uses at runtime — with no `as unknown as` cast.
 *
 * Keep the names in sync with `convex-backend/convex/*.ts`. If a name drifts,
 * the Convex query/mutation call fails at runtime (there is no compile-time
 * check across the package boundary), so treat this file as the single source
 * of truth and update it alongside backend renames.
 */
export const convexApi = {
  liveRetros: {
    getRetroBoard: makeFunctionReference<'query'>('liveRetros:getRetroBoard'),
    listRecentRetroProjections: makeFunctionReference<'query'>(
      'liveRetros:listRecentRetroProjections',
    ),
    startTyping: makeFunctionReference<'mutation'>('liveRetros:startTyping'),
    stopTyping: makeFunctionReference<'mutation'>('liveRetros:stopTyping'),
    getTypingUsers: makeFunctionReference<'query'>('liveRetros:getTypingUsers'),
    setReadyStatus: makeFunctionReference<'mutation'>(
      'liveRetros:setReadyStatus',
    ),
    clearAllReady: makeFunctionReference<'mutation'>(
      'liveRetros:clearAllReady',
    ),
    getReadyStatus: makeFunctionReference<'query'>('liveRetros:getReadyStatus'),
  },
  liveEstimates: {
    getEstimateBoard: makeFunctionReference<'query'>(
      'liveEstimates:getEstimateBoard',
    ),
    listActiveSessionProjections: makeFunctionReference<'query'>(
      'liveEstimates:listActiveSessionProjections',
    ),
    setPresence: makeFunctionReference<'mutation'>('liveEstimates:setPresence'),
    getSessionPresence: makeFunctionReference<'query'>(
      'liveEstimates:getSessionPresence',
    ),
    listOnlineCounts: makeFunctionReference<'query'>(
      'liveEstimates:listOnlineCounts',
    ),
  },
  liveIcebreakers: {
    getIcebreakerBoard: makeFunctionReference<'query'>(
      'liveIcebreakers:getIcebreakerBoard',
    ),
    getSessionProjection: makeFunctionReference<'query'>(
      'liveIcebreakers:getSessionProjection',
    ),
    listActiveSessionProjections: makeFunctionReference<'query'>(
      'liveIcebreakers:listActiveSessionProjections',
    ),
    sendReaction: makeFunctionReference<'mutation'>(
      'liveIcebreakers:sendReaction',
    ),
    getRecentReactions: makeFunctionReference<'query'>(
      'liveIcebreakers:getRecentReactions',
    ),
  },
  liveStandups: {
    getStandupBoard: makeFunctionReference<'query'>(
      'liveStandups:getStandupBoard',
    ),
  },
  livePolls: {
    listPollProjections: makeFunctionReference<'query'>(
      'livePolls:listPollProjections',
    ),
  },
  liveSurveys: {
    listSurveyProjections: makeFunctionReference<'query'>(
      'liveSurveys:listSurveyProjections',
    ),
  },
  liveNotifications: {
    listUserNotifications: makeFunctionReference<'query'>(
      'liveNotifications:listUserNotifications',
    ),
  },
} as const
