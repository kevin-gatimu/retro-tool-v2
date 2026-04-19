import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  History as HistoryIcon,
  Plus,
  RefreshCw,
  Search,
  Spade,
  Trash2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { ESTIMATES_ENDPOINTS } from '@/lib/api-endpoints'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { EstimateSession } from '@/common/types/estimates'
import { usesConvexForEstimates } from '@/lib/realtime-config'
import { EstimateListConvexSync } from './components/estimate-list-convex-sync'
import type { HistorySession, HistoryResponse } from './types'

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/estimate/')({
  component: EstimateIndexPage,
})

// ─── Page ────────────────────────────────────────────────────────────────────

function EstimateIndexPage() {
  return (
    <div className="space-y-6">
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

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            <Spade className="mr-1.5 h-3.5 w-3.5" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="mr-1.5 h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <ActiveSessionsTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Active Sessions Tab ──────────────────────────────────────────────────────

function ActiveSessionsTab() {
  const usesConvexRealtime = usesConvexForEstimates()
  const { data: sessions = [] } = useQuery({
    queryKey: ['active-estimate-sessions'],
    queryFn: () => api.get<EstimateSession[]>(ESTIMATES_ENDPOINTS.ACTIVE),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  if (sessions.length === 0) {
    return (
      <>
        {usesConvexRealtime ? <EstimateListConvexSync /> : null}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Spade className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mb-2">No active sessions</CardTitle>
            <CardDescription className="text-center max-w-sm">
              Start an estimation session to estimate stories with your team in
              real-time.
            </CardDescription>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {usesConvexRealtime ? <EstimateListConvexSync /> : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <Card
            key={session.id}
            className="hover:border-primary/50 transition-colors"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{session.name}</CardTitle>
                <Badge
                  variant={
                    session.status === 'voting' ? 'default' : 'secondary'
                  }
                >
                  {session.status === 'waiting'
                    ? 'Waiting'
                    : session.status === 'voting'
                      ? 'Voting'
                      : 'Revealed'}
                </Badge>
              </div>
              <CardDescription>{session.team.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {session.participants.filter((p) => p.isOnline).length}{' '}
                    online
                  </span>
                </div>
                <Button asChild size="sm">
                  <Link
                    to="/estimate/$sessionId"
                    params={{ sessionId: session.id }}
                  >
                    Join Session
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

// ─── History Tab ──────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE_OPTIONS = [6, 12, 24, 48]
const DEFAULT_HISTORY_PAGE_SIZE = 12

function HistoryTab() {
  const { data: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()
  const isSystemAdmin =
    currentUser?.role === 'super-admin' || currentUser?.role === 'system-admin'

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_HISTORY_PAGE_SIZE)
  const [search, setSearch] = useState('')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['estimate-history', page, pageSize, search],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      })
      const normalizedSearch = search.trim()
      if (normalizedSearch) {
        params.set('search', normalizedSearch)
      }
      return api.get<HistoryResponse>(
        `${ESTIMATES_ENDPOINTS.HISTORY}?${params.toString()}`,
      )
    },
    placeholderData: keepPreviousData,
  })

  const sessions = data?.sessions ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ['estimate-history'] })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    )
  }

  const searchControl = (
    <div className="max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search history"
          className="pl-9"
        />
      </div>
    </div>
  )

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        {searchControl}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HistoryIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No completed sessions</CardTitle>
            <CardDescription className="text-center max-w-sm">
              Completed estimation sessions will appear here.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Group by org for system admins
  if (isSystemAdmin) {
    const byOrg = new Map<
      string,
      { orgName: string; items: HistorySession[] }
    >()
    for (const s of sessions) {
      const key = s.orgId ?? '__none__'
      if (!byOrg.has(key)) {
        byOrg.set(key, { orgName: s.orgName ?? 'No Organization', items: [] })
      }
      byOrg.get(key)!.items.push(s)
    }

    return (
      <div className="space-y-6">
        {searchControl}
        {Array.from(byOrg.entries()).map(([orgId, { orgName, items }]) => (
          <section key={orgId} className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {orgName}
              </h3>
              <Badge variant="outline" className="text-xs">
                {items.length}
              </Badge>
            </div>
            {items.map((s) => (
              <SessionHistoryCard key={s.id} session={s} onDeleted={() => {}} />
            ))}
          </section>
        ))}
        <HistoryPaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          isFetching={isFetching}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onRefresh={handleRefresh}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {searchControl}
      {sessions.map((s) => (
        <SessionHistoryCard key={s.id} session={s} onDeleted={() => {}} />
      ))}
      <HistoryPaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onRefresh={handleRefresh}
      />
    </div>
  )
}

function SessionHistoryCard({
  session,
  onDeleted,
}: {
  session: HistorySession
  onDeleted: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(ESTIMATES_ENDPOINTS.PERMANENT_DELETE(session.id)),
    onSuccess: () => {
      toast.success('Session deleted')
      queryClient.invalidateQueries({ queryKey: ['estimate-history'] })
      onDeleted(session.id)
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
              params={{ sessionId: session.id }}
              className="min-w-0 flex-1"
            >
              <CardTitle className="text-base truncate">
                {session.name}
              </CardTitle>
              <CardDescription className="truncate">
                {session.teamName}
                {session.currentStory && (
                  <span className="ml-2 text-muted-foreground/70">
                    · {session.currentStory}
                  </span>
                )}
              </CardDescription>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary">Completed</Badge>
              {session.canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
        <Link to="/estimate/$sessionId" params={{ sessionId: session.id }}>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {session.participantCount} participants
              </span>
              <span>{session.roundCount} rounds</span>
              <span>{session.totalVotes} votes</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(session.updatedAt).toLocaleDateString()}
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
              Are you sure you want to delete &ldquo;{session.name}&rdquo;? This
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

function HistoryPaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  isFetching: boolean
  onPageChange: (p: number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
}) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={(val) => onPageSizeChange(Number(val))}
        >
          <SelectTrigger className="h-8 w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HISTORY_PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          Page {page} of {totalPages} &middot; {total} sessions
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          onClick={onRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
