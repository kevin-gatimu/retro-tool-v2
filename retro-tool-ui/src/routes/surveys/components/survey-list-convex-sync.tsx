import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import { convexApi } from '@/lib/convex-api'

interface SurveyProjection {
  surveyId: string
  scope: 'team' | 'org' | 'system'
  isClosed: boolean
  updatedAt: string
}

const surveyProjectionsQuery = convexApi.liveSurveys.listSurveyProjections

/**
 * Headless subscriber to the Convex survey projection. On any change it
 * invalidates the REST-backed survey queries (which re-apply per-viewer
 * authorization, keep anonymity, and gate results). Replaces the previous
 * `refetchInterval` polling on the list, active-count badge, and detail views.
 *
 * Mounted anywhere a survey view is visible (list, detail, sidebar) so the
 * badge and open lists stay live app-wide.
 */
export function SurveyListConvexSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(
    surveyProjectionsQuery,
    isAuthenticated ? {} : 'skip',
  ) as SurveyProjection[] | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.surveyId,
        projection.isClosed,
        projection.updatedAt,
      ]),
    )

    if (
      lastSnapshotRef.current !== null &&
      lastSnapshotRef.current !== snapshot
    ) {
      void queryClient.invalidateQueries({ queryKey: ['surveys'] })
      void queryClient.invalidateQueries({
        queryKey: ['surveys-active-count'],
      })
      // Detail views are keyed ['survey', id] — refresh any that are mounted.
      void queryClient.invalidateQueries({ queryKey: ['survey'] })
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
