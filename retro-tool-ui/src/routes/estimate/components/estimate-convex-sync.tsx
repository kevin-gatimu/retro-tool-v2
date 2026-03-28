import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import { anyApi } from 'convex/server'
import type { EstimateSession } from '@/common/types/estimates'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const estimateBoardQuery = anyApi.liveEstimates.getEstimateBoard

type EstimateBoardSnapshot = {
    session: EstimateSession
}

interface EstimateConvexSyncProps {
    sessionId: string
}

export function EstimateConvexSync({
    sessionId,
}: EstimateConvexSyncProps) {
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
        if (!board?.updatedAt || !board.snapshot) {
            return
        }

        if (lastUpdatedAtRef.current === board.updatedAt) {
            return
        }

        try {
            const parsed = JSON.parse(board.snapshot) as EstimateBoardSnapshot

            if (parsed?.session) {
                queryClient.setQueryData(
                    ['estimate-session', sessionId],
                    parsed.session,
                )
            }

            lastUpdatedAtRef.current = board.updatedAt
        } catch {
            // Ignore malformed snapshots and keep the last known cache values.
        }
    }, [board?.updatedAt, board?.snapshot, queryClient, sessionId])

    return null
}