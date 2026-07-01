import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clock, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  IcebreakerHistoryResponse,
  IcebreakerSessionSummary,
} from '@/common/types/icebreakers'
import type { Team } from '@/common/types/teams'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'
import { SpaceSwitcher } from '@/components/spaces/space-switcher'
import { ViewConfigToolbar } from '@/components/spaces/view-config-toolbar'
import { GroupedSessionView } from '@/components/spaces/grouped-session-view'
import { LoadMoreFooter } from '@/components/spaces/load-more-footer'
import type { CompletedPage } from '@/components/spaces/use-session-list'
import { useSessionList } from '@/components/spaces/use-session-list'
import type { StatusBucket } from '@/components/spaces/utils'
import {
  SPACE_ALL,
  deriveSpaces,
  icebreakerStatusBucket,
  nextCollapsedGroups,
  toggleFavorite,
} from '@/components/spaces/utils'
import { useSessionViewPreferences } from '@/hooks/use-session-view-preferences'
import { IcebreakerListConvexSync } from './components/icebreaker-list-convex-sync'
import { IcebreakerListSkeleton } from './skeleton'
import { STATUS_LABELS } from './helpers'

const COMPLETED_PAGE_SIZE = 12

// ─── Normalized list item ─────────────────────────────────────────────────────
// Ongoing (live session) and completed (history aggregate) have different
// shapes; both are normalized into this single item so one GroupedSessionView
// can render them via a kind-branching renderItem.
type IcebreakerListItem = {
  id: string
  name: string
  teamId: string
  teamName: string
  teamEmoji: string | null
  statusBucket: StatusBucket
  timestamp: number
  kind: 'ongoing' | 'completed'
  ongoing?: { status: IcebreakerSessionSummary['status'] }
  completed?: {
    promptCount: number
    keptCount: number
    canDelete: boolean
  }
}

function ongoingToItem(s: IcebreakerSessionSummary): IcebreakerListItem {
  return {
    id: s.id,
    name: s.name,
    teamId: s.teamId,
    teamName: s.team.name,
    teamEmoji: s.team.emoji ?? null,
    statusBucket: icebreakerStatusBucket(s.status),
    timestamp: new Date(s.updatedAt).getTime(),
    kind: 'ongoing',
    ongoing: { status: s.status },
  }
}

function completedToItem(
  s: IcebreakerHistoryResponse['sessions'][number],
): IcebreakerListItem {
  return {
    id: s.id,
    name: s.name,
    teamId: s.teamId,
    teamName: s.teamName ?? 'Unknown team',
    teamEmoji: s.teamEmoji,
    statusBucket: 'completed',
    timestamp: new Date(s.updatedAt).getTime(),
    kind: 'completed',
    completed: {
      promptCount: s.promptCount,
      keptCount: s.keptCount,
      canDelete: s.canDelete,
    },
  }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchOngoingIcebreakers(): Promise<IcebreakerListItem[]> {
  const sessions = await api.get<IcebreakerSessionSummary[]>(
    ICEBREAKERS_ENDPOINTS.ACTIVE,
  )
  return sessions.map(ongoingToItem)
}

async function fetchCompletedIcebreakers(
  page: number,
  teamId: string | undefined,
  search: string,
): Promise<CompletedPage<IcebreakerListItem>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(COMPLETED_PAGE_SIZE),
  })
  if (teamId) params.set('teamId', teamId)
  const trimmed = search.trim()
  if (trimmed) params.set('search', trimmed)

  const data = await api.get<IcebreakerHistoryResponse>(
    `${ICEBREAKERS_ENDPOINTS.HISTORY}?${params.toString()}`,
  )
  return {
    items: data.sessions.map(completedToItem),
    total: data.total,
    page: data.page,
    limit: data.limit,
  }
}

function teamsQueryOptions() {
  return {
    queryKey: ['teams'] as const,
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/icebreakers/')({
  component: IcebreakerIndexPage,
})

function IcebreakerIndexPage() {
  const usesConvexRealtime = usesConvexForIcebreakers()
  const { view, setView } = useSessionViewPreferences('icebreakers')
  const { data: teamsData } = useQuery(teamsQueryOptions())

  // Debounced search (scoped to completed/history server-side).
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const teamScope = view.space !== SPACE_ALL ? view.space : undefined

  const {
    ongoing,
    completed,
    completedTotal,
    completedLoaded,
    hasMore,
    isLoading,
    isFetching,
    isFetchingNextPage,
    loadMore,
    refetch,
  } = useSessionList<IcebreakerListItem, IcebreakerListItem>({
    // Keep this key exactly so IcebreakerListConvexSync keeps invalidating it.
    ongoingKey: ['active-icebreaker-sessions'],
    fetchOngoing: fetchOngoingIcebreakers,
    completedKey: ['icebreaker-history', teamScope ?? null, search],
    fetchCompleted: (page) =>
      fetchCompletedIcebreakers(page, teamScope, search),
    completedEnabled: view.showCompleted,
  })

  const items = [...ongoing, ...completed]
  const totalCount = ongoing.length + completedTotal
  const spaces = deriveSpaces(teamsData?.teams ?? [], items)

  const renderItem = (item: IcebreakerListItem) =>
    item.kind === 'ongoing' ? (
      <ActiveSessionCard item={item} />
    ) : (
      <SessionHistoryCard item={item} />
    )

  // First load (nothing fetched yet) → structure-matching skeleton.
  if (isLoading && items.length === 0) {
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

      <SpaceSwitcher
        spaces={spaces}
        value={view.space}
        onChange={(space) => setView({ space })}
        favorites={view.favorites}
        onToggleFavorite={(teamId) =>
          setView({ favorites: toggleFavorite(view.favorites, teamId) })
        }
        totalCount={totalCount}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ViewConfigToolbar view={view} setView={setView} />
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search completed…"
              className="pl-9 h-8"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 shrink-0"
            onClick={refetch}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <GroupedSessionView
        items={items}
        view={view}
        spaces={spaces}
        getId={(s) => s.id}
        getTeamId={(s) => s.teamId}
        getTeamName={(s) => s.teamName}
        getTeamEmoji={(s) => s.teamEmoji}
        getStatusBucket={(s) => s.statusBucket}
        getSortName={(s) => s.name}
        getTimestamp={(s) => s.timestamp}
        renderItem={renderItem}
        defaultCollapsedBucket="completed"
        onToggleGroup={(key, open, defaultCollapsed) =>
          setView({
            collapsedGroups: nextCollapsedGroups(
              view.collapsedGroups,
              key,
              open,
              defaultCollapsed,
            ),
          })
        }
        emptyState={
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="mb-2">No icebreaker sessions</CardTitle>
              <CardDescription className="text-center max-w-sm">
                Start an icebreaker to break the ice with your team before the
                real work begins.
              </CardDescription>
            </CardContent>
          </Card>
        }
      />

      {view.showCompleted && (
        <LoadMoreFooter
          loaded={completedLoaded}
          total={completedTotal}
          hasMore={hasMore}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={loadMore}
          label="completed sessions"
        />
      )}
    </div>
  )
}

// ─── Cards ─────────────────────────────────────────────────────────────────────

function ActiveSessionCard({ item }: { item: IcebreakerListItem }) {
  const status = item.ongoing?.status
  return (
    <Card className="hover:border-primary/50 transition-colors h-full">
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {item.name}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
            {status ? STATUS_LABELS[status] : 'Ongoing'}
          </Badge>
        </div>
        <CardDescription className="truncate">{item.teamName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link to="/icebreakers/$sessionId" params={{ sessionId: item.id }}>
              Join Session
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SessionHistoryCard({ item }: { item: IcebreakerListItem }) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const c = item.completed

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(ICEBREAKERS_ENDPOINTS.PERMANENT_DELETE(item.id)),
    onSuccess: () => {
      toast.success('Session deleted')
      queryClient.invalidateQueries({ queryKey: ['icebreaker-history'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete session')
    },
  })

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <Link
              to="/icebreakers/$sessionId"
              params={{ sessionId: item.id }}
              className="min-w-0 flex-1"
            >
              <CardTitle className="text-base truncate">{item.name}</CardTitle>
              <CardDescription className="truncate">
                {item.teamName}
              </CardDescription>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="whitespace-nowrap">
                Completed
              </Badge>
              {c?.canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete session</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <Link to="/icebreakers/$sessionId" params={{ sessionId: item.id }}>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{c?.promptCount ?? 0} prompts</span>
              <span>{c?.keptCount ?? 0} discussed</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Link>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Icebreaker Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{item.name}&rdquo;? This
              action cannot be undone. All prompts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
