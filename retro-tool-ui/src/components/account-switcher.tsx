import { Check, LogIn, Loader2, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/user-avatar'
import { authClient } from '@/lib/auth-client'
import {
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

function AccountStatusIcon({
  isSwitching,
  isActive,
}: {
  isSwitching: boolean
  isActive: boolean
}) {
  if (isSwitching) {
    return <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
  }
  if (isActive) {
    return <Check className="h-4 w-4 shrink-0 text-primary" />
  }
  return <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" />
}

export function AccountSwitcher({ currentUserId }: { currentUserId: string }) {
  const [switching, setSwitching] = useState<string | null>(null)

  // listDeviceSessions → GET /api/auth/multi-session/list-device-sessions
  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['multi-device-sessions'],
    queryFn: async () => {
      const res = await authClient.multiSession.listDeviceSessions()
      return res.data ?? []
    },
    retry: false,
  })

  const handleSwitch = async (sessionToken: string) => {
    setSwitching(sessionToken)
    try {
      // setActive → POST /api/auth/multi-session/set-active

      await authClient.multiSession.setActive({ sessionToken })
      window.location.reload()
    } catch {
      toast.error('Failed to switch account')
      setSwitching(null)
    }
  }

  if (isLoading) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts…
        </DropdownMenuItem>
      </>
    )
  }

  if (isError || !sessions || sessions.length <= 1) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.href = '/auth/sign-in'
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add another account
        </DropdownMenuItem>
      </>
    )
  }

  return (
    <>
      <DropdownMenuSeparator />
      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
        Switch account
      </div>
      {sessions.map((s) => {
        const isActive = s.user.id === currentUserId
        return (
          <DropdownMenuItem
            key={s.session.token}
            onClick={() => !isActive && handleSwitch(s.session.token)}
            className="gap-2"
            disabled={switching === s.session.token}
          >
            <UserAvatar
              image={s.user.image ?? null}
              name={s.user.name}
              userId={s.user.id}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{s.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {s.user.email}
              </p>
            </div>
            <AccountStatusIcon
              isSwitching={switching === s.session.token}
              isActive={isActive}
            />
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          window.location.href = '/auth/sign-in'
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add another account
      </DropdownMenuItem>
    </>
  )
}
