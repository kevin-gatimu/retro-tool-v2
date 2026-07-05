import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import type { StandupEntryDetail } from '@/common/types/standups'

const standupBoardQuery =
  'liveStandups:getStandupBoard' as unknown as FunctionReference<'query'>

type StandupBoardSnapshot = {
  entryDetail: StandupEntryDetail
}

interface StandupConvexSyncProps {
  standupId: string
  date: string
}

export function StandupConvexSync({ standupId, date }: StandupConvexSyncProps) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useConvexAuth()
  const lastUpdatedAtRef = useRef<number | null>(null)

  // Convex derives the user from the JWT. Skip until the Convex client is
  // authenticated so the query doesn't throw Unauthenticated.
  const board = useConvexQuery(
    standupBoardQuery,
    isAuthenticated ? { standupId, entryDate: date } : 'skip',
  ) as
    | {
        standupId: string
        entryDate: string
        snapshot: string
        updatedAt: number
      }
    | null
    | undefined

  // Reset staleness tracking when navigating between dates.
  useEffect(() => {
    lastUpdatedAtRef.current = null
  }, [standupId, date])

  // Hydrate TanStack cache from Convex snapshots to avoid REST polling.
  useEffect(() => {
    if (!board || board.snapshot.length === 0) {
      return
    }

    if (
      lastUpdatedAtRef.current !== null &&
      board.updatedAt <= lastUpdatedAtRef.current
    ) {
      return
    }

    try {
      const parsed = JSON.parse(board.snapshot) as StandupBoardSnapshot

      queryClient.setQueryData(
        ['standup-entry', standupId, date],
        parsed.entryDetail,
      )

      lastUpdatedAtRef.current = board.updatedAt
    } catch {
      // Ignore malformed snapshots and keep the last known cache values.
    }
  }, [board?.updatedAt, board?.snapshot, queryClient, standupId, date])

  return null
}
