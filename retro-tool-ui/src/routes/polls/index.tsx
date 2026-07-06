import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Vote } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PollCard } from '@/components/polls/poll-card'
import { CreatePollDialog } from '@/components/polls/create-poll-dialog'
import { usePollMutations } from '@/hooks/use-poll-mutations'
import { PollListConvexSync } from '@/routes/polls/components/poll-list-convex-sync'
import { usesConvexForPolls } from '@/lib/realtime-config'
import { api } from '@/lib/api'
import { POLLS_ENDPOINTS, TEAMS_ENDPOINTS } from '@/lib/api-endpoints'
import type { PollView } from '@/common/types/polls'
import type { Team } from '@/common/types/teams'

export const Route = createFileRoute('/polls/')({
  component: PollsIndexPage,
})

function PollsIndexPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPoll, setEditingPoll] = useState<PollView | null>(null)

  const convexRealtime = usesConvexForPolls()

  const { data: polls, isLoading } = useQuery({
    queryKey: ['polls'],
    queryFn: () => api.get<PollView[]>(POLLS_ENDPOINTS.LIST),
    staleTime: 15_000,
    refetchInterval: convexRealtime ? false : 15_000,
  })

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<{ teams: Team[] }>(TEAMS_ENDPOINTS.LIST),
    staleTime: 60_000,
  })

  // Optimistically patch a single poll in the ['polls'] list cache so votes
  // feel instant. Returns a rollback used if the request fails.
  const patchPoll = (pollId: string, updater: (poll: PollView) => PollView) => {
    const key = ['polls']
    const previous = queryClient.getQueryData<PollView[]>(key)
    queryClient.setQueryData<PollView[]>(key, (current) =>
      current?.map((poll) => (poll.id === pollId ? updater(poll) : poll)),
    )
    return () => queryClient.setQueryData(key, previous)
  }

  const {
    createPollMutation,
    updatePollMutation,
    voteMutation,
    retractVoteMutation,
    setClosedMutation,
    deletePollMutation,
  } = usePollMutations(() => {
    void queryClient.invalidateQueries({ queryKey: ['polls'] })
  }, patchPoll)

  const teams = teamsData?.teams ?? []

  if (isLoading) {
    return (
      <div className="space-y-6">
        {convexRealtime ? <PollListConvexSync /> : null}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      {convexRealtime ? <PollListConvexSync /> : null}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Vote className="h-8 w-8 text-primary" />
              Polls
            </h1>
            <p className="text-muted-foreground">
              Quick team pulse checks and decisions
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={teams.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Poll
          </Button>
        </div>

        {!polls || polls.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Vote className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="mb-2">No polls yet</CardTitle>
              <CardDescription className="text-center max-w-sm">
                Create a poll to get a quick read on how your team is feeling or
                to settle a decision.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {polls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                showTeam
                onVote={(pollId, optionId) =>
                  voteMutation.mutate({ pollId, optionId })
                }
                onRetractVote={(pollId) => retractVoteMutation.mutate(pollId)}
                onSetClosed={(pollId, isClosed) =>
                  setClosedMutation.mutate({ pollId, isClosed })
                }
                onDelete={(pollId) => deletePollMutation.mutate(pollId)}
                onEdit={(p) => setEditingPoll(p)}
              />
            ))}
          </div>
        )}

        {teams.length > 0 && (
          <CreatePollDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            teams={teams}
            onCreate={(data) =>
              createPollMutation.mutate(data, {
                onSuccess: () => setCreateOpen(false),
              })
            }
            isCreating={createPollMutation.isPending}
          />
        )}

        {editingPoll && (
          <CreatePollDialog
            open={!!editingPoll}
            onOpenChange={(open) => {
              if (!open) setEditingPoll(null)
            }}
            editingPoll={editingPoll}
            onCreate={() => {}}
            onUpdate={(data) =>
              updatePollMutation.mutate(
                { pollId: editingPoll.id, data },
                { onSuccess: () => setEditingPoll(null) },
              )
            }
            isCreating={updatePollMutation.isPending}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
