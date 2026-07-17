import { Eye, Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { EstimateSession } from '@/common/types/estimates'
import type { VoteOption } from '../types'
import { EndSessionDialog } from './end-session-dialog'

type Mutation = { mutate: () => void; isPending: boolean }

interface SessionControlsProps {
  session: EstimateSession
  voteOptions: VoteOption[]
  agreedPoints: string
  stats: { avg: string; min: number; max: number } | null
  votedCount: number
  revealVotesMutation: Mutation
  revoteMutation: Mutation
  startRoundMutation: { isPending: boolean }
  endSessionMutation: Mutation
  setConsensusMutation: { isPending: boolean }
  onOpenRoundModal: () => void
  onAgreedPointsChange: (value: string) => void
}

export function SessionControls({
  session,
  voteOptions,
  agreedPoints,
  stats,
  votedCount,
  revealVotesMutation,
  revoteMutation,
  startRoundMutation,
  endSessionMutation,
  setConsensusMutation,
  onOpenRoundModal,
  onAgreedPointsChange,
}: SessionControlsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Session Controls</CardTitle>
        <CardDescription>
          You can control the voting and change the Agreed Points.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Left — round & session actions */}
          <div className="flex flex-wrap items-center gap-2">
            {session.status !== 'revealed' ? (
              <Button
                onClick={() => revealVotesMutation.mutate()}
                disabled={
                  revealVotesMutation.isPending ||
                  votedCount === 0 ||
                  !session.currentRound
                }
              >
                <Eye className="mr-2 h-4 w-4" />
                Reveal Votes
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => revoteMutation.mutate()}
                  disabled={revoteMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Revote
                </Button>
                <Button
                  onClick={onOpenRoundModal}
                  disabled={startRoundMutation.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Round
                </Button>
              </>
            )}

            {!session.currentRound && (
              <Button
                onClick={onOpenRoundModal}
                disabled={startRoundMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Start Round
              </Button>
            )}

            <EndSessionDialog
              onConfirm={() => endSessionMutation.mutate()}
              isPending={endSessionMutation.isPending}
            />
          </div>

          {/* Agreed points (only when votes are revealed) */}
          {session.status === 'revealed' && (
            <>
              <div className="w-full h-px bg-border sm:w-px sm:h-auto sm:self-stretch" />
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="agreed-points-input"
                  className="text-sm font-medium text-muted-foreground whitespace-nowrap"
                >
                  Agreed Points
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {voteOptions
                    .filter((v) => v.value !== '?')
                    .map((v) => (
                      <Button
                        key={v.value}
                        variant={
                          agreedPoints === v.value ? 'default' : 'secondary'
                        }
                        size="sm"
                        className="h-8 min-w-[2rem] px-2.5 text-sm font-semibold"
                        onClick={() => onAgreedPointsChange(v.value)}
                      >
                        {v.label}
                      </Button>
                    ))}
                </div>
                <div className="relative">
                  <Input
                    id="agreed-points-input"
                    className="w-28 cursor-default border-primary/60 bg-primary/5 text-center font-semibold focus-visible:ring-primary focus-visible:border-primary"
                    placeholder={stats?.avg ?? '—'}
                    value={agreedPoints}
                    readOnly
                  />
                  {setConsensusMutation.isPending && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
