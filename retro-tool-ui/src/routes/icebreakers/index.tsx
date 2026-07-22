import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type { IcebreakerSessionSummary } from '@/common/types/icebreakers'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'
import { IcebreakerListConvexSync } from './components/icebreaker-list-convex-sync'
import { IcebreakerListSkeleton } from './skeleton'
import { STATUS_LABELS } from './helpers'

// Icebreaker sessions are ephemeral — ending one deletes it, so there is no
// history. This page therefore lists only the (always small) set of active
// sessions across the current user's teams, with a client-side search.

async function fetchActiveIcebreakers(): Promise<IcebreakerSessionSummary[]> {
  return api.get<IcebreakerSessionSummary[]>(ICEBREAKERS_ENDPOINTS.ACTIVE)
}

export const Route = createFileRoute('/icebreakers/')({
  component: IcebreakerIndexPage,
})

function IcebreakerIndexPage() {
  const usesConvexRealtime = usesConvexForIcebreakers()
  const queryClient = useQueryClient()

  // Debounced client-side search over the active list (always a small set).
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const {
    data: sessions,
    isLoading,
    isFetching,
  } = useQuery({
    // Keep this key so IcebreakerListConvexSync keeps invalidating it.
    queryKey: ['active-icebreaker-sessions'],
    queryFn: fetchActiveIcebreakers,
    staleTime: 30_000,
  })

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const all = sessions ?? []
    if (!q) return all
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.team.name.toLowerCase().includes(q),
    )
  }, [sessions, q])

  const refresh = () =>
    void queryClient.invalidateQueries({
      queryKey: ['active-icebreaker-sessions'],
    })

  // First load (nothing fetched yet) → structure-matching skeleton.
  if (isLoading) {
    return (
      <>
        {usesConvexRealtime ? <IcebreakerListConvexSync /> : null}
        <IcebreakerListSkeleton />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {usesConvexRealtime ? <IcebreakerListConvexSync /> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            Icebreakers
          </h1>
          <p className="text-muted-foreground">
            Warm up the team before standups and retros
          </p>
        </div>
        <Button asChild>
          <Link to="/icebreakers/new">
            <Plus className="mr-2 h-4 w-4" />
            Start Icebreaker
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search sessions…"
            className="pl-9 h-8"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 shrink-0"
          onClick={refresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mb-2">
              {q ? 'No matching sessions' : 'No icebreaker sessions'}
            </CardTitle>
            <CardDescription className="text-center max-w-sm">
              {q
                ? 'No active session matches your search.'
                : 'Start an icebreaker to break the ice with your team before the real work begins.'}
            </CardDescription>
            {!q && (
              <Button asChild className="mt-4">
                <Link to="/icebreakers/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Start Icebreaker
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((session) => (
            <ActiveSessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActiveSessionCard({ session }: { session: IcebreakerSessionSummary }) {
  return (
    <Card className="h-full border-primary/20 transition-all hover:border-primary/50 hover:shadow-md">
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {session.name}
          </CardTitle>
          <Badge
            variant="secondary"
            className="shrink-0 gap-1.5 whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            {STATUS_LABELS[session.status]}
          </Badge>
        </div>
        <CardDescription className="truncate">
          {session.team.emoji ? `${session.team.emoji} ` : ''}
          {session.team.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {new Date(session.updatedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
          <Button asChild size="sm" className="gap-1">
            <Link
              to="/icebreakers/$sessionId"
              params={{ sessionId: session.id }}
            >
              Join session
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
