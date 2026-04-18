import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import type { EstimateSession } from '@/common/types/estimates'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const estimateBoardQuery =
  'liveEstimates:getEstimateBoard' as unknown as FunctionReference<'query'>

type EstimateBoardSnapshot = {
  session: EstimateSession
}

interface EstimateConvexSyncProps {
  sessionId: string
}

export function EstimateConvexSync({ sessionId }: EstimateConvexSyncProps) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const lastUpdatedAtRef = useRef<number | null>(null)
  const board = useConvexQuery(estimateBoardQuery, {
    sessionId,
    userId: currentUser?.id ?? '',
  }) as
    | { sessionId: string; snapshot: string; updatedAt: number }
    | null
    | undefined

  // Hydrate TanStack cache from Convex snapshots to avoid REST polling.
  useEffect(() => {
    if (!board) {
      return
    }

    if (board.snapshot.length === 0) {
      return
    }

    if (lastUpdatedAtRef.current === board.updatedAt) {
      return
    }

    try {
      const parsed = JSON.parse(board.snapshot) as EstimateBoardSnapshot

      queryClient.setQueryData(['estimate-session', sessionId], parsed.session)

      lastUpdatedAtRef.current = board.updatedAt
    } catch {
      // Ignore malformed snapshots and keep the last known cache values.
    }
  }, [board?.updatedAt, board?.snapshot, queryClient, sessionId])

  return null
}
