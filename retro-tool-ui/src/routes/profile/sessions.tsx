import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  LogOut,
  MapPin,
  Monitor,
} from 'lucide-react'
import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth-client'
import { useSessionActions } from './hooks/useSessionActions'
import type { SessionData } from './types'
import { getDeviceIcon, getBrowserInfo, getOSInfo } from './helpers'

function SessionsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/profile/sessions')({
  pendingComponent: SessionsSkeleton,
  component: SessionsPage,
})

function SessionsPage() {
  const { data: currentSession } = authClient.useSession()
  const [revokeSuccess, setRevokeSuccess] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const { revokeSessionMutation, revokeOtherSessionsMutation } =
    useSessionActions()

  const { data: sessions } = useSuspenseQuery({
    queryKey: ['device-sessions'],
    queryFn: async () => {
      const response = await authClient.listSessions()
      return (response.data ?? []).map((item) => ({
        token: item.token,
        userAgent: item.userAgent ?? undefined,
        ipAddress: item.ipAddress ?? undefined,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
      })) as SessionData[]
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
  })

  const handleRevokeSession = (sessionToken: string) => {
    setRevokeError(null)
    revokeSessionMutation.mutate(sessionToken, {
      onSuccess: () => {
        setRevokeSuccess(true)
        setTimeout(() => setRevokeSuccess(false), 3000)
      },
      onError: (err) =>
        setRevokeError(err.message || 'Failed to revoke session'),
    })
  }

  const handleRevokeAllOtherSessions = () => {
    setRevokeError(null)
    revokeOtherSessionsMutation.mutate(undefined, {
      onSuccess: () => {
        setRevokeSuccess(true)
        setTimeout(() => setRevokeSuccess(false), 3000)
      },
      onError: (err) =>
        setRevokeError(err.message || 'Failed to revoke sessions'),
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Active Sessions
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your active sessions across all devices.
          </p>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleRevokeAllOtherSessions}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out All Others
        </Button>
      </div>

      {revokeSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-600 dark:text-green-400">
            Session(s) revoked successfully!
          </span>
        </div>
      )}

      {revokeError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <span className="text-destructive">{revokeError}</span>
        </div>
      )}

      <div className="space-y-4">
        {sessions.map((session) => {
          const isCurrentSession =
            session.token === currentSession?.session.token
          const DeviceIcon = getDeviceIcon(session.userAgent || '')
          const browser = getBrowserInfo(session.userAgent || '')
          const os = getOSInfo(session.userAgent || '')

          return (
            <div
              key={session.token}
              className={`bg-card rounded-xl border p-6 transition-colors ${
                isCurrentSession
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-border/80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isCurrentSession ? 'bg-primary/10' : 'bg-muted'
                    }`}
                  >
                    <DeviceIcon
                      className={`w-6 h-6 ${
                        isCurrentSession
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {browser} on {os}
                      </h3>
                      {isCurrentSession && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Current Session
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span>{session.ipAddress || 'IP not captured'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          Last active:{' '}
                          {session.updatedAt
                            ? new Date(session.updatedAt).toLocaleString(
                                'en-US',
                                { hour12: true },
                              )
                            : 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>
                          Created:{' '}
                          {new Date(session.createdAt).toLocaleString('en-US', {
                            hour12: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {!isCurrentSession && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRevokeSession(session.token)}
                    disabled={
                      revokeSessionMutation.isPending &&
                      revokeSessionMutation.variables === session.token
                    }
                  >
                    {revokeSessionMutation.isPending &&
                    revokeSessionMutation.variables === session.token ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 mr-1" />
                        Revoke
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            No active sessions
          </h3>
          <p className="text-muted-foreground mt-1">
            Your session information will appear here.
          </p>
        </div>
      )}

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-2">About Sessions</h3>
        <p className="text-sm text-muted-foreground">
          Each time you sign in on a new device or browser, a new session is
          created. If you don't recognize a session, revoke it immediately and
          change your password to secure your account.
        </p>
      </div>
    </div>
  )
}
