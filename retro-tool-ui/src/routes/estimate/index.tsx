import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Clock,
  Plus,
  RefreshCw,
  Search,
  Spade,
  Trash2,
  Users,
} from 'lucide-react'
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
import { ESTIMATES_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { EstimateSession } from '@/common/types/estimates'
import type { Team } from '@/common/types/teams'
import { usesConvexForEstimates } from '@/lib/realtime-config'
import { EstimateListConvexSync } from './components/estimate-list-convex-sync'
import type { HistoryResponse } from './types'
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
  nextCollapsedGroups,
  toggleFavorite,
} from '@/components/spaces/utils'
import { useSessionViewPreferences } from '@/hooks/use-session-view-preferences'
import { EstimateListSkeleton } from './skeleton'

const COMPLETED_PAGE_SIZE = 12

// ─── Normalized list item ─────────────────────────────────────────────────────
// Ongoing (live session) and completed (history aggregate) have different
// shapes; both are normalized into this single item so one GroupedSessionView
// can render them via a kind-branching renderItem.
type EstimateListItem = {
  id: string
  name: string
  teamId: string
  teamName: string
  teamEmoji: string | null
  statusBucket: StatusBucket
  timestamp: number
  kind: 'ongoing' | 'completed'
  ongoing?: { status: EstimateSession['status']; onlineCount: number }
  completed?: {
    currentStory: string | null
    participantCount: number
    roundCount: number
    totalVotes: number
    canDelete: boolean
  }
}

function ongoingToItem(s: EstimateSession): EstimateListItem {
  return {
    id: s.id,
    name: s.name,
    teamId: s.teamId,
    teamName: s.team.name,
    teamEmoji: s.team.emoji ?? null,
    statusBucket: 'ongoing',
    timestamp: new Date(s.updatedAt).getTime(),
    kind: 'ongoing',
    ongoing: {
      status: s.status,
      onlineCount: s.participants.filter((p) => p.isOnline).length,
    },
  }
}

function completedToItem(
  s: HistoryResponse['sessions'][number],
): EstimateListItem {
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
      currentStory: s.currentStory,
      participantCount: s.participantCount,
      roundCount: s.roundCount,
      totalVotes: s.totalVotes,
      canDelete: s.canDelete,
    },
  }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchOngoingEstimates(): Promise<EstimateListItem[]> {
  const sessions = await api.get<EstimateSession[]>(ESTIMATES_ENDPOINTS.ACTIVE)
  return sessions.map(ongoingToItem)
}

async function fetchCompletedEstimates(
  page: number,
  teamId: string | undefined,
  search: string,
): Promise<CompletedPage<EstimateListItem>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(COMPLETED_PAGE_SIZE),
  })
  if (teamId) params.set('teamId', teamId)
  const trimmed = search.trim()
  if (trimmed) params.set('search', trimmed)

  const data = await api.get<HistoryResponse>(
    `${ESTIMATES_ENDPOINTS.HISTORY}?${params.toString()}`,
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

export const Route = createFileRoute('/estimate/')({
  component: EstimateIndexPage,
})

function EstimateIndexPage() {
  const usesConvexRealtime = usesConvexForEstimates()
  const { view, setView } = useSessionViewPreferences('estimates')
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
  } = useSessionList<EstimateListItem, EstimateListItem>({
    // Keep this key exactly so EstimateListConvexSync keeps invalidating it.
    ongoingKey: ['active-estimate-sessions'],
    fetchOngoing: fetchOngoingEstimates,
    completedKey: ['estimate-history', teamScope ?? null, search],
    fetchCompleted: (page) => fetchCompletedEstimates(page, teamScope, search),
    completedEnabled: view.showCompleted,
  })

  const items = [...ongoing, ...completed]
  const totalCount = ongoing.length + completedTotal
  const spaces = deriveSpaces(teamsData?.teams ?? [], items)

  const renderItem = (item: EstimateListItem) =>
    item.kind === 'ongoing' ? (
      <ActiveSessionCard item={item} />
    ) : (
      <SessionHistoryCard item={item} />
    )

  // First load (nothing fetched yet) → structure-matching skeleton.
  if (isLoading && items.length === 0) {
    return (
      <>
        {usesConvexRealtime ? <EstimateListConvexSync /> : null}
        <EstimateListSkeleton />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {usesConvexRealtime ? <EstimateListConvexSync /> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Spade className="h-8 w-8 text-primary" />
            Stories Estimate
          </h1>
          <p className="text-muted-foreground">
            Quick story estimation for agile teams
          </p>
        </div>
        <Button asChild>
          <Link to="/estimate/new">
            <Plus className="mr-2 h-4 w-4" />
            Start Estimating
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
                <Spade className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="mb-2">No estimate sessions</CardTitle>
              <CardDescription className="text-center max-w-sm">
                Start an estimation session to estimate stories with your team
                in real-time.
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

function ActiveSessionCard({ item }: { item: EstimateListItem }) {
  const status = item.ongoing?.status
  return (
    <Card className="hover:border-primary/50 transition-colors h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{item.name}</CardTitle>
          <Badge variant={status === 'voting' ? 'default' : 'secondary'}>
            {status === 'waiting'
              ? 'Waiting'
              : status === 'voting'
                ? 'Voting'
                : 'Revealed'}
          </Badge>
        </div>
        <CardDescription>{item.teamName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{item.ongoing?.onlineCount ?? 0} online</span>
          </div>
          <Button asChild size="sm">
            <Link to="/estimate/$sessionId" params={{ sessionId: item.id }}>
              Join Session
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SessionHistoryCard({ item }: { item: EstimateListItem }) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const c = item.completed

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(ESTIMATES_ENDPOINTS.PERMANENT_DELETE(item.id)),
    onSuccess: () => {
      toast.success('Session deleted')
      queryClient.invalidateQueries({ queryKey: ['estimate-history'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete session')
    },
  })

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <Link
              to="/estimate/$sessionId"
              params={{ sessionId: item.id }}
              className="min-w-0 flex-1"
            >
              <CardTitle className="text-base truncate">{item.name}</CardTitle>
              <CardDescription className="truncate">
                {item.teamName}
                {c?.currentStory && (
                  <span className="ml-2 text-muted-foreground/70">
                    · {c.currentStory}
                  </span>
                )}
              </CardDescription>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">Completed</Badge>
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
        <Link to="/estimate/$sessionId" params={{ sessionId: item.id }}>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {c?.participantCount ?? 0} participants
              </span>
              <span>{c?.roundCount ?? 0} rounds</span>
              <span>{c?.totalVotes ?? 0} votes</span>
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
            <AlertDialogTitle>Delete Estimate Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{item.name}&rdquo;? This
              action cannot be undone. All rounds, stories, and votes will be
              permanently removed.
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
