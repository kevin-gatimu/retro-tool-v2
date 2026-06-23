import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import type { RetroDetail } from '@/common/types/retros'
import { useCurrentUser } from '@/hooks/use-current-user'
import type { CarriedForwardItem } from '../types'

const retroBoardQuery =
  'liveRetros:getRetroBoard' as unknown as FunctionReference<'query'>

type RetroBoardSnapshot = {
  retro: RetroDetail
  previousCarriedItems?: CarriedForwardItem[]
}

interface RetroConvexSyncProps {
  retroId: string
  minAcceptedUpdatedAt?: number
}

export function RetroConvexSync({
  retroId,
  minAcceptedUpdatedAt = 0,
}: RetroConvexSyncProps) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const lastUpdatedAtRef = useRef<number | null>(null)
  const board = useConvexQuery(retroBoardQuery, {
    retroId,
    userId: currentUser?.id ?? '',
  }) as
    | { retroId: string; snapshot: string; updatedAt: number }
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

    if (board.updatedAt < minAcceptedUpdatedAt) {
      return
    }

    if (
      lastUpdatedAtRef.current !== null &&
      board.updatedAt <= lastUpdatedAtRef.current
    ) {
      return
    }

    try {
      const parsed = JSON.parse(board.snapshot) as RetroBoardSnapshot

      queryClient.setQueryData(['retro', retroId], parsed.retro)

      if (Array.isArray(parsed.previousCarriedItems)) {
        queryClient.setQueryData(
          ['retro-previous-carried', retroId],
          parsed.previousCarriedItems,
        )
      }

      lastUpdatedAtRef.current = board.updatedAt
    } catch {
      // Ignore malformed snapshots and keep the last known cache values.
    }
  }, [
    board?.updatedAt,
    board?.snapshot,
    minAcceptedUpdatedAt,
    queryClient,
    retroId,
  ])

  return null
}
