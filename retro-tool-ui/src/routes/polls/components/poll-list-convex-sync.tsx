import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'

interface PollProjection {
  pollId: string
  isClosed: boolean
  updatedAt: string
}

const pollProjectionsQuery =
  'livePolls:listPollProjections' as unknown as FunctionReference<'query'>

/**
 * Headless subscriber to the Convex poll projection. On any change it
 * invalidates the REST-backed `['polls']` query, which re-applies per-viewer
 * authorization. Replaces the previous 15s `refetchInterval` polling.
 */
export function PollListConvexSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(
    pollProjectionsQuery,
    isAuthenticated ? {} : 'skip',
  ) as PollProjection[] | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.pollId,
        projection.isClosed,
        projection.updatedAt,
      ]),
    )

    if (
      lastSnapshotRef.current !== null &&
      lastSnapshotRef.current !== snapshot
    ) {
      void queryClient.invalidateQueries({ queryKey: ['polls'] })
      void queryClient.invalidateQueries({ queryKey: ['polls-active-count'] })
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
