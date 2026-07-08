import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
  Bell,
  BellOff,
  Building2,
  CheckCheck,
  MessageSquare,
  Spade,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { authClient } from '@/lib/auth-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { getNotificationSocket } from '@/lib/socket'
import { usesConvexForNotifications } from '@/lib/realtime-config'
import { NOTIFICATIONS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Notification } from '@/common/types/notifications'
import { NotificationConvexSync } from '@/components/notification-convex-sync'

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const currentUserId = session ? session.user.id : null
  const usesConvexRealtime = usesConvexForNotifications()
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>(NOTIFICATIONS_ENDPOINTS.LIST),
    staleTime: 30_000,
    refetchInterval: usesConvexRealtime ? false : 30_000,
  })

  const unreadNotifications = notifications.filter((n) => !n.read)
  const unreadCount = unreadNotifications.length

  useEffect(() => {
    if (usesConvexRealtime) {
      return
    }

    const socket = getNotificationSocket()

    const onNotification = (notification: Notification) => {
      queryClient.setQueryData<Notification[]>(
        ['notifications'],
        (prev = []) => [notification, ...prev],
      )
      toast.info(notification.title, {
        description: notification.message,
        action: notification.link
          ? {
              label: 'View',
              onClick: () => router.navigate({ to: notification.link! }),
            }
          : undefined,
      })
      // Real-time membership update: when the current user is approved to a team,
      // invalidate team queries so their UI reflects membership immediately.
      if (notification.type === 'team_join_approved') {
        queryClient.invalidateQueries({ queryKey: ['teams'] })
      }
    }

    socket.on('notification', onNotification)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('notification', onNotification)
    }
  }, [queryClient, router, usesConvexRealtime])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(NOTIFICATIONS_ENDPOINTS.MARK_READ(id)),
    onMutate: (id: string) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (prev = []) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
    },
    onError: invalidate,
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch(NOTIFICATIONS_ENDPOINTS.READ_ALL),
    onMutate: () => {
      queryClient.setQueryData<Notification[]>(['notifications'], (prev = []) =>
        prev.map((n) => ({ ...n, read: true })),
      )
    },
    onError: invalidate,
  })

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'user_signup':
        return <UserPlus className="h-4 w-4 text-blue-500" />
      case 'team_join_request':
      case 'team_join_approved':
      case 'team_join_rejected':
        return <Users className="h-4 w-4 text-green-500" />
      case 'org_invite':
        return <Building2 className="h-4 w-4 text-purple-500" />
      case 'estimate_session_created':
        return <Spade className="h-4 w-4 text-amber-500" />
      case 'retro_created':
      case 'retro_started':
        return <MessageSquare className="h-4 w-4 text-pink-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const formatTime = (date: string | Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <>
      {usesConvexRealtime && currentUserId ? (
        <NotificationConvexSync userId={currentUserId} />
      ) : null}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-75">
            {unreadNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No unread notifications
                </p>
              </div>
            ) : (
              unreadNotifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer ${!notif.read ? 'bg-muted/50' : ''}`}
                  onClick={() => {
                    if (!notif.read) markReadMutation.mutate(notif.id)
                    if (notif.link) {
                      setIsOpen(false)
                      router.navigate({ to: notif.link })
                    }
                  }}
                >
                  <div className="shrink-0 mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notif.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(notif.createdAt)}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="shrink-0">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>

          {pushSupported && (
            <>
              <DropdownMenuSeparator />
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-auto py-1.5 text-xs text-muted-foreground"
                  onClick={() =>
                    pushSubscribed ? unsubscribePush() : subscribePush()
                  }
                  disabled={pushLoading}
                >
                  {pushSubscribed ? (
                    <>
                      <BellOff className="mr-2 h-3 w-3" />
                      Disable browser notifications
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-3 w-3" />
                      Enable browser notifications
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
