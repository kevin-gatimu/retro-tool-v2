import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'

interface ActiveEstimateProjection {
  sessionId: string
  status: 'waiting' | 'voting' | 'revealed'
  updatedAt: string
}

const activeEstimateProjectionQuery =
  'liveEstimates:listActiveSessionProjections' as unknown as FunctionReference<'query'>

export function EstimateListConvexSync() {
  const queryClient = useQueryClient()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(activeEstimateProjectionQuery, {}) as
    | ActiveEstimateProjection[]
    | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.sessionId,
        projection.status,
        projection.updatedAt,
      ]),
    )

    if (
      lastSnapshotRef.current !== null &&
      lastSnapshotRef.current !== snapshot
    ) {
      void queryClient.invalidateQueries({
        queryKey: ['active-estimate-sessions'],
      })
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
