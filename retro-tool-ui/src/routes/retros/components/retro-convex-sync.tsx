import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RetroProjectionPayload } from '@retro-tool/contracts'
import { useQuery as useConvexQuery } from 'convex/react'
import { anyApi } from 'convex/server'

const retroProjectionQuery = anyApi.liveRetros.getRetroProjection

interface RetroConvexSyncProps {
    retroId: string
}

export function RetroConvexSync({ retroId }: RetroConvexSyncProps) {
    const queryClient = useQueryClient()
    const lastUpdatedAtRef = useRef<string | null>(null)
    const projection = useConvexQuery(retroProjectionQuery, {
        retroId,
    }) as RetroProjectionPayload | null | undefined

    useEffect(() => {
        if (!projection?.updatedAt) {
            return
        }

        if (
            lastUpdatedAtRef.current !== null &&
            lastUpdatedAtRef.current !== projection.updatedAt
        ) {
            void queryClient.refetchQueries({
                queryKey: ['retro', retroId],
            })
            void queryClient.invalidateQueries({
                queryKey: ['retro-previous-carried', retroId],
            })
        }

        lastUpdatedAtRef.current = projection.updatedAt
    }, [projection?.updatedAt, queryClient, retroId])

    return null
}