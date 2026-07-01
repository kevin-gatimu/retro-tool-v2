import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clock, Plus, Sparkles, Trash2 } from 'lucide-react'
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
import { api } from '@/lib/api'
import { ICEBREAKERS_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  IcebreakerHistoryResponse,
  IcebreakerSessionSummary,
} from '@/common/types/icebreakers'
import { usesConvexForIcebreakers } from '@/lib/realtime-config'
import { IcebreakerListConvexSync } from './components/icebreaker-list-convex-sync'
import { IcebreakerListSkeleton } from './skeleton'
import { STATUS_LABELS } from './helpers'

const COMPLETED_PAGE_SIZE = 12

export const Route = createFileRoute('/icebreakers/')({
  component: IcebreakerIndexPage,
})

function IcebreakerIndexPage() {
  const usesConvexRealtime = usesConvexForIcebreakers()

  const { data: ongoing, isLoading: ongoingLoading } = useQuery({
    queryKey: ['active-icebreaker-sessions'],
    queryFn: () =>
      api.get<IcebreakerSessionSummary[]>(ICEBREAKERS_ENDPOINTS.ACTIVE),
    refetchInterval: usesConvexRealtime ? false : 8_000,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['icebreaker-history'],
    queryFn: () =>
      api.get<IcebreakerHistoryResponse>(
        `${ICEBREAKERS_ENDPOINTS.HISTORY}?page=1&limit=${COMPLETED_PAGE_SIZE}`,
      ),
  })

  if (ongoingLoading && historyLoading) {
    return (
      <>
        {usesConvexRealtime ? <IcebreakerListConvexSync /> : null}
        <IcebreakerListSkeleton />
      </>
    )
  }

  const ongoingSessions = ongoing ?? []
  const completedSessions = history?.sessions ?? []
  const isEmpty = ongoingSessions.length === 0 && completedSessions.length === 0

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

      {isEmpty ? (
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
      ) : (
        <div className="space-y-8">
          {ongoingSessions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ongoing
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ongoingSessions.map((session) => (
                  <ActiveSessionCard key={session.id} session={session} />
                ))}
              </div>
            </section>
          )}

          {completedSessions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Completed
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedSessions.map((session) => (
                  <SessionHistoryCard key={session.id} session={session} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ActiveSessionCard({ session }: { session: IcebreakerSessionSummary }) {
  return (
    <Card className="hover:border-primary/50 transition-colors h-full">
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <CardTitle className="min-w-0 flex-1 truncate text-lg">
            {session.name}
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
            {STATUS_LABELS[session.status]}
          </Badge>
        </div>
        <CardDescription className="truncate">
          {session.team.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link
              to="/icebreakers/$sessionId"
              params={{ sessionId: session.id }}
            >
              Join Session
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SessionHistoryCard({
  session,
}: {
  session: IcebreakerHistoryResponse['sessions'][number]
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(ICEBREAKERS_ENDPOINTS.PERMANENT_DELETE(session.id)),
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
              params={{ sessionId: session.id }}
              className="min-w-0 flex-1"
            >
              <CardTitle className="text-base truncate">
                {session.name}
              </CardTitle>
              <CardDescription className="truncate">
                {session.teamName ?? 'Unknown team'}
              </CardDescription>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="whitespace-nowrap">
                Completed
              </Badge>
              {session.canDelete && (
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
        <Link to="/icebreakers/$sessionId" params={{ sessionId: session.id }}>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{session.promptCount} prompts</span>
              <span>{session.keptCount} discussed</span>
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
            <AlertDialogTitle>Delete Icebreaker Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{session.name}&rdquo;? This
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
