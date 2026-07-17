import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import type { IcebreakerSession } from '@/common/types/icebreakers'
import { convexApi } from '@/lib/convex-api'

const icebreakerBoardQuery = convexApi.liveIcebreakers.getIcebreakerBoard

type IcebreakerBoardSnapshot = {
  session: IcebreakerSession
}

interface IcebreakerConvexSyncProps {
  sessionId: string
}

export function IcebreakerConvexSync({ sessionId }: IcebreakerConvexSyncProps) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastUpdatedAtRef = useRef<number | null>(null)
  // Convex derives the user from the JWT; don't pass userId. Skip until the
  // Convex client is authenticated so the query doesn't throw Unauthenticated.
  const board = useConvexQuery(
    icebreakerBoardQuery,
    isAuthenticated ? { sessionId } : 'skip',
  ) as
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

    // Reject stale snapshots: a concurrent syncSessionProjection call that
    // started before a more-recent one can finish later and carry an older
    // updatedAt. Applying it would overwrite the fresher data already in cache.
    if (
      lastUpdatedAtRef.current !== null &&
      board.updatedAt <= lastUpdatedAtRef.current
    ) {
      return
    }

    try {
      const parsed = JSON.parse(board.snapshot) as IcebreakerBoardSnapshot

      queryClient.setQueryData(
        ['icebreaker-session', sessionId],
        parsed.session,
      )

      lastUpdatedAtRef.current = board.updatedAt
    } catch {
      // Ignore malformed snapshots and keep the last known cache values.
    }
  }, [board?.updatedAt, board?.snapshot, queryClient, sessionId])

  return null
}
