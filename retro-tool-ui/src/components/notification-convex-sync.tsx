import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useConvexAuth, useQuery as useConvexQuery } from 'convex/react'
import { toast } from 'sonner'
import type { Notification } from '@/common/types/notifications'
import { convexApi } from '@/lib/convex-api'

interface NotificationProjection {
  notificationId: string
  userId: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
  updatedAt: string
}

interface NotificationConvexSyncProps {
  userId: string
}

const userNotificationsQuery = convexApi.liveNotifications.listUserNotifications

export function NotificationConvexSync({
  userId,
}: NotificationConvexSyncProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { isAuthenticated } = useConvexAuth()
  const lastSnapshotRef = useRef<string | null>(null)
  // Tracks notification ids already seen so we only fire toasts / side-effects
  // for genuinely new arrivals. `null` marks the first projection load, where
  // we prime the set without surfacing toasts for the existing backlog.
  const seenIdsRef = useRef<Set<string> | null>(null)
  // Convex derives the user from the JWT; don't pass userId. Skip until both a
  // signed-in user exists and the Convex client is authenticated.
  const projections = useConvexQuery(
    userNotificationsQuery,
    isAuthenticated && userId ? { limit: 50 } : 'skip',
  ) as NotificationProjection[] | undefined

  useEffect(() => {
    if (!projections) {
      return
    }

    const snapshot = JSON.stringify(
      projections.map((projection) => [
        projection.notificationId,
        projection.read,
        projection.updatedAt,
      ]),
    )

    if (lastSnapshotRef.current !== snapshot) {
      const nextNotifications: Notification[] = projections.map(
        (projection) => ({
          id: projection.notificationId,
          userId: projection.userId,
          type: projection.type,
          title: projection.title,
          message: projection.message,
          link: projection.link ?? null,
          read: projection.read,
          metadata: null,
          createdAt: new Date(projection.createdAt),
        }),
      )

      queryClient.setQueryData<Notification[]>(
        ['notifications'],
        nextNotifications,
      )

      // Diff against the previously-seen ids to detect genuinely new
      // notifications. On the first load we only prime the set (no toasts for
      // the existing backlog); afterwards we mirror the Socket.IO handler's
      // side-effects for each new arrival.
      if (seenIdsRef.current === null) {
        seenIdsRef.current = new Set(
          projections.map((projection) => projection.notificationId),
        )
      } else {
        const seenIds = seenIdsRef.current
        const newProjections = projections.filter(
          (projection) => !seenIds.has(projection.notificationId),
        )

        let approvedTeamJoin = false
        for (const projection of newProjections) {
          seenIds.add(projection.notificationId)
          // Capture to a local so the closure narrows the optional link without
          // a non-null assertion.
          const link = projection.link
          toast.info(projection.title, {
            description: projection.message,
            action: link
              ? {
                  label: 'View',
                  onClick: () => router.navigate({ to: link }),
                }
              : undefined,
          })
          // Real-time membership update: when the current user is approved to a
          // team, invalidate team queries so their UI reflects membership
          // immediately.
          if (projection.type === 'team_join_approved') {
            approvedTeamJoin = true
          }
        }

        if (approvedTeamJoin) {
          queryClient.invalidateQueries({ queryKey: ['teams'] })
        }
      }
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient, router])

  return null
}
