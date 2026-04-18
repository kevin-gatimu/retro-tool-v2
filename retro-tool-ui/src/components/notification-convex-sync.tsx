import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import type { FunctionReference } from 'convex/server'
import type { Notification } from '@/common/types/notifications'

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

const userNotificationsQuery =
  'liveNotifications:listUserNotifications' as unknown as FunctionReference<'query'>

export function NotificationConvexSync({
  userId,
}: NotificationConvexSyncProps) {
  const queryClient = useQueryClient()
  const lastSnapshotRef = useRef<string | null>(null)
  const projections = useConvexQuery(userNotificationsQuery, {
    userId,
    limit: 50,
  }) as NotificationProjection[] | undefined

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
    }

    lastSnapshotRef.current = snapshot
  }, [projections, queryClient])

  return null
}
