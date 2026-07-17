import { useQueryClient, useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  History as HistoryIcon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RetrosListSkeleton } from './skeleton'
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
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Retro } from '@/common/types/retros'
import { authClient } from '@/lib/auth-client'
import { usesConvexForRetros } from '@/lib/realtime-config'
import { getRetroSocket } from '@/lib/socket'
import { RetroListConvexSync } from './components/retro-list-convex-sync'
import { ViewConfigToolbar } from '@/components/spaces/view-config-toolbar'
import { GroupedSessionView } from '@/components/spaces/grouped-session-view'
import { LoadMoreFooter } from '@/components/spaces/load-more-footer'
import type { CompletedPage } from '@/components/spaces/use-session-list'
import { useSessionList } from '@/components/spaces/use-session-list'
import {
  SPACE_ALL,
  nextCollapsedGroups,
  retroStatusBucket,
} from '@/components/spaces/utils'
import { useSessionViewPreferences } from '@/hooks/use-session-view-preferences'

const COMPLETED_PAGE_SIZE = 12
const ONGOING_LIMIT = 100

type RetroListResponse =
  | { retros: Retro[]; total: number; page: number; limit: number }
  | Retro[]

function normalizeRetroResponse(
  raw: RetroListResponse,
  page: number,
  limit: number,
): { retros: Retro[]; total: number; page: number; limit: number } {
  if (Array.isArray(raw)) {
    return { retros: raw, total: raw.length, page, limit }
  }
  return raw
}

async function fetchOngoingRetros(
  teamId?: string,
  search?: string,
): Promise<Retro[]> {
  const params = new URLSearchParams({
    status: 'ongoing',
    page: '1',
    limit: String(ONGOING_LIMIT),
  })
  if (teamId) params.set('teamId', teamId)
  const trimmed = search?.trim()
  if (trimmed) params.set('search', trimmed)
  const raw = await api.get<RetroListResponse>(
    `${RETROS_ENDPOINTS.LIST}?${params.toString()}`,
  )
  return normalizeRetroResponse(raw, 1, ONGOING_LIMIT).retros
}

async function fetchCompletedRetros(
  page: number,
  teamId?: string,
  search?: string,
): Promise<CompletedPage<Retro>> {
  const params = new URLSearchParams({
    status: 'completed',
    page: String(page),
    limit: String(COMPLETED_PAGE_SIZE),
  })
  if (teamId) params.set('teamId', teamId)
  const trimmed = search?.trim()
  if (trimmed) params.set('search', trimmed)
  const raw = await api.get<RetroListResponse>(
    `${RETROS_ENDPOINTS.LIST}?${params.toString()}`,
  )
  const norm = normalizeRetroResponse(raw, page, COMPLETED_PAGE_SIZE)
  return {
    items: norm.retros,
    total: norm.total,
    page: norm.page,
    limit: norm.limit,
  }
}

export const Route = createFileRoute('/retros/')({
  component: RetrosPage,
})

function RetrosPage() {
  const queryClient = useQueryClient()
  const usesConvexRealtime = usesConvexForRetros()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [retroToDelete, setRetroToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const { data: session } = authClient.useSession()
  const userRole = session?.user
    ? (session.user as { role?: string }).role
    : undefined

  const { view: storedView, setView } = useSessionViewPreferences('retros')
  // The space switcher was removed, so `space` is no longer selectable. Force
  // "All Spaces" so a previously-persisted team filter can't permanently strand
  // the list (it's still read by teamScope + GroupedSessionView below).
  const view =
    storedView.space === SPACE_ALL
      ? storedView
      : { ...storedView, space: SPACE_ALL }

  // Debounced search — applied server-side to BOTH ongoing and completed so it
  // spans the full history, not just the loaded pages.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // When a specific space is selected, scope completed pagination server-side.
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
  } = useSessionList<Retro, Retro>({
    ongoingKey: ['retros', 'ongoing', teamScope ?? null, search],
    fetchOngoing: () => fetchOngoingRetros(teamScope, search),
    completedKey: ['retros', 'completed', teamScope ?? null, search],
    fetchCompleted: (page) => fetchCompletedRetros(page, teamScope, search),
    completedEnabled: view.showCompleted,
  })

  const retros = [...ongoing, ...completed]
  const listTotal = ongoing.length + completedTotal

  // Only system/super admins can delete from the list (endpoint lacks
  // per-retro permission info; see backend TODO for `canDelete`).
  const isSystemAdmin =
    userRole === 'system-admin' || userRole === 'super-admin'

  const deleteRetroMutation = useMutation({
    mutationFn: (retroId: string) =>
      api.delete(RETROS_ENDPOINTS.BY_ID(retroId)),
    onSuccess: () => {
      toast.success('Retrospective deleted')
      queryClient.invalidateQueries({ queryKey: ['retros'] })
      setDeleteDialogOpen(false)
      setRetroToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete retrospective')
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, retro: Retro) => {
    e.preventDefault()
    e.stopPropagation()
    setRetroToDelete({ id: retro.id, name: retro.name })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (retroToDelete) {
      deleteRetroMutation.mutate(retroToDelete.id)
    }
  }

  useEffect(() => {
    if (usesConvexRealtime) return

    const socket = getRetroSocket()

    const onRetroListChanged = () => {
      void queryClient.invalidateQueries({ queryKey: ['retros'] })
    }

    socket.on('retro-list-changed', onRetroListChanged)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('retro-list-changed', onRetroListChanged)
    }
  }, [queryClient, usesConvexRealtime])

  const renderRetroCard = (retro: Retro) => (
    <Card className="hover:border-primary/50 transition-colors relative h-full">
      {isSystemAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 h-8 w-8"
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDeleteClick(e, retro)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Link to="/retros/$retroId" params={{ retroId: retro.id }}>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{retro.teamEmoji}</span>
            <span className="text-sm text-muted-foreground">
              {retro.teamName}
            </span>
          </div>
          <CardTitle className={isSystemAdmin ? 'text-lg pr-8' : 'text-lg'}>
            {retro.name}
          </CardTitle>
          <CardDescription>{retro.templateName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <StatusBadge status={retro.status} />
            <span className="text-muted-foreground">
              {new Date(retro.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  )

  // First load (nothing fetched yet) → structure-matching skeleton, so the
  // empty-state ("No retrospectives match…") never flashes before data arrives.
  if (isLoading && retros.length === 0) {
    return (
      <>
        {usesConvexRealtime ? <RetroListConvexSync /> : null}
        <RetrosListSkeleton />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {usesConvexRealtime ? <RetroListConvexSync /> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retrospectives</h1>
          <p className="text-muted-foreground">
            View and manage your team retrospectives
          </p>
        </div>
        <Button asChild>
          <Link to="/retros/new">
            <Plus className="mr-2 h-4 w-4" />
            New Retrospective
          </Link>
        </Button>
      </div>

      {listTotal === 0 && !isLoading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HistoryIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No retrospectives yet</CardTitle>
            <CardDescription className="text-center mb-4">
              Start your first retrospective to gather feedback from your team.
            </CardDescription>
            <Button asChild>
              <Link to="/retros/new">
                <Plus className="mr-2 h-4 w-4" />
                Create your first retro
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ViewConfigToolbar view={view} setView={setView} />
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search retrospectives…"
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
            items={retros}
            view={view}
            getId={(r) => r.id}
            getTeamId={(r) => r.teamId}
            getTeamName={(r) => r.teamName ?? 'Unknown team'}
            getTeamEmoji={(r) => r.teamEmoji}
            getStatusBucket={(r) => retroStatusBucket(r.status)}
            getSortName={(r) => r.name}
            getTimestamp={(r) => new Date(r.createdAt).getTime()}
            renderItem={renderRetroCard}
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
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No retrospectives match the current filters.
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
              label="completed retrospectives"
            />
          )}
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retrospective</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{retroToDelete?.name}"? This
              action cannot be undone. All cards, votes, and comments will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRetroMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteRetroMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRetroMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  waiting: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  grouping: 'bg-violet-100 text-violet-700',
  voting: 'bg-amber-100 text-amber-700',
  discussing: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-green-100 text-green-700',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
