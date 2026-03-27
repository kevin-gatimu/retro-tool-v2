import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EstimateProjectionPayload } from '@retro-tool/contracts'
import { useQuery as useConvexQuery } from 'convex/react'
import { anyApi } from 'convex/server'

const estimateProjectionQuery = anyApi.liveEstimates.getSessionProjection

interface EstimateConvexSyncProps {
    sessionId: string
}

export function EstimateConvexSync({
    sessionId,
}: EstimateConvexSyncProps) {
    const queryClient = useQueryClient()
    const lastUpdatedAtRef = useRef<string | null>(null)
    const projection = useConvexQuery(estimateProjectionQuery, {
        sessionId,
    }) as EstimateProjectionPayload | null | undefined

    useEffect(() => {
        if (!projection?.updatedAt) {
            return
        }

        if (
            lastUpdatedAtRef.current !== null &&
            lastUpdatedAtRef.current !== projection.updatedAt
        ) {
            void queryClient.refetchQueries({
                queryKey: ['estimate-session', sessionId],
            })
        }

        lastUpdatedAtRef.current = projection.updatedAt
    }, [projection?.updatedAt, queryClient, sessionId])

    return null
}