import type { PropsWithChildren } from 'react'
import { ConvexProvider } from 'convex/react'
import { getConvexClient } from './convex-client'

export function RealtimeProviders({ children }: PropsWithChildren) {
    const convexClient = getConvexClient()

    if (!convexClient) {
        return children
    }

    return <ConvexProvider client={convexClient}>{children}</ConvexProvider>
}