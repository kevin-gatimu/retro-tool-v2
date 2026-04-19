import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
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
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { Retro } from '@/common/types/retros'
import { authClient } from '@/lib/auth-client'
import { usesConvexForRetros } from '@/lib/realtime-config'
import { getRetroSocket } from '@/lib/socket'
import { RetroListConvexSync } from './components/retro-list-convex-sync'

const PAGE_SIZE_OPTIONS = [6, 12, 24, 48]

async function fetchRetrosPage(page: number, limit: number) {
  const raw = await api.get<
    { retros: Retro[]; total: number; page: number; limit: number } | Retro[]
  >(`${RETROS_ENDPOINTS.LIST}?page=${page}&limit=${limit}`)

  if (Array.isArray(raw)) {
    return { retros: raw, total: raw.length, page, limit }
  }
  return raw
}

function retrosQueryOptions(page: number, limit: number) {
  return {
    queryKey: ['retros', page, limit] as const,
    queryFn: () => fetchRetrosPage(page, limit),
    staleTime: 30_000,
  }
}

function RetrosListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header with title and button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Grid of retro cards - 3 columns on large screens */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/retros/')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Math.max(1, Math.floor(Number(search.page) || 1)),
    limit: PAGE_SIZE_OPTIONS.includes(Number(search.limit))
      ? Number(search.limit)
      : 6,
  }),
  loaderDeps: ({ search }) => ({ page: search.page, limit: search.limit }),
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(retrosQueryOptions(deps.page, deps.limit)),
  pendingComponent: RetrosListSkeleton,
  component: RetrosPage,
})

function RetrosPage() {
  const { page, limit } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
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

  const { data, isLoading, isFetching } = useQuery({
    ...retrosQueryOptions(page, limit),
    placeholderData: (prev) => prev,
  })

  const retros = data?.retros ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Check if user can delete retros
  // Currently only showing for system/super admins since the list endpoint
  // doesn't include per-retro permission info (creator, team lead, org admin)
  // TODO: Backend should include `canDelete: boolean` for each retro
  const isSystemAdmin =
    userRole === 'system-admin' || userRole === 'super-admin'

  const deleteRetroMutation = useMutation({
    mutationFn: (retroId: string) =>
      api.delete(RETROS_ENDPOINTS.BY_ID(retroId)),
    onSuccess: () => {
      toast.success('Retrospective deleted')
      queryClient.invalidateQueries({ queryKey: ['retros', page, limit] })
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

  const goToPage = (p: number) =>
    navigate({ to: '/retros', search: { page: p, limit } })

  const setLimit = (val: string) =>
    navigate({ to: '/retros', search: { page: 1, limit: Number(val) } })

  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ['retros', page, limit] })

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

      {total === 0 && !isLoading ? (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {retros.map((retro) => (
              <Card
                key={retro.id}
                className="hover:border-primary/50 transition-colors relative"
              >
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
                          handleDeleteClick(
                            e as unknown as React.MouseEvent,
                            retro,
                          )
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
                    <CardTitle
                      className={isSystemAdmin ? 'text-lg pr-8' : 'text-lg'}
                    >
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
            ))}
          </div>

          {total >= 9 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select value={String(limit)} onValueChange={setLimit}>
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>
                  Page {page} of {totalPages} &middot; {total} retros
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={handleRefresh}
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
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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

function StatusBadge({ status }: { status: string }) {
  const statusStyles = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-blue-100 text-blue-700',
    grouping: 'bg-violet-100 text-violet-700',
    voting: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status as keyof typeof statusStyles]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
