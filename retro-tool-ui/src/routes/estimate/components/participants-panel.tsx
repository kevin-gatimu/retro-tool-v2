import { Check, Users } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EstimateSession } from '@/common/types/estimates'

type DisplayedParticipant = EstimateSession['participants'][number]

interface ParticipantsPanelProps {
  session: EstimateSession
  displayedParticipants: DisplayedParticipant[]
  selectedPoints: string | null
  votedCount: number
  savedAgreedPoints: string | null
  stats: { avg: string; min: number; max: number } | null
}

export function ParticipantsPanel({
  session,
  displayedParticipants,
  selectedPoints,
  votedCount,
  savedAgreedPoints,
  stats,
}: ParticipantsPanelProps) {
  const displayVote = (points: string): string => {
    if (!session.template) return points
    return (
      session.template.values.find((v) => v.value === points)?.label ?? points
    )
  }

  const closestLabel = (avg: string | null): string | null => {
    if (!avg || !session.template) return null
    const avgNum = parseFloat(avg)
    if (isNaN(avgNum)) return null
    const numeric = session.template.values
      .map((v) => ({ label: v.label, n: parseFloat(v.value) }))
      .filter((v) => !isNaN(v.n))
      .sort((a, b) => Math.abs(a.n - avgNum) - Math.abs(b.n - avgNum))
    return numeric[0]?.label ?? null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({votedCount}/{displayedParticipants.length} voted)
          </CardTitle>
          {/* Reserve a fixed-height row so the card never shifts when
              stats appear. Items are always rendered but invisible until
              they have a value — this keeps the layout stable. */}
          <div className="flex min-h-[1.75rem] flex-wrap items-center gap-3 text-sm">
            {savedAgreedPoints ? (
              <span className="inline-flex items-center gap-1 rounded-md border-2 border-primary bg-primary/10 px-2 py-0.5 font-bold text-primary">
                <Check className="h-3 w-3" />
                Agreed: {savedAgreedPoints}
              </span>
            ) : (
              <span className="invisible inline-flex items-center gap-1 rounded-md border-2 px-2 py-0.5 font-bold">
                Agreed: —
              </span>
            )}
            {stats ? (
              <>
                <span className="text-muted-foreground">
                  Avg: <strong className="text-foreground">{stats.avg}</strong>
                  {closestLabel(stats.avg) && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (~{closestLabel(stats.avg)})
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  Range:{' '}
                  <strong className="text-foreground">
                    {stats.min} - {stats.max}
                  </strong>
                </span>
              </>
            ) : (
              <span className="invisible text-muted-foreground">
                Avg: — Range: —
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {displayedParticipants.map((participant) => {
            // Check optimistic local vote first, then server data
            const isCurrentUser = participant.userId === session.currentUserId
            const serverVote = session.votes.find(
              (v) => v.voterId === participant.userId,
            )
            // For current user: show optimistic selectedPoints if voting, otherwise server vote
            const vote =
              isCurrentUser && selectedPoints
                ? { points: selectedPoints, voterId: participant.userId }
                : serverVote
            const hasVoted = !!vote
            const isRevealed = session.status === 'revealed' || isCurrentUser

            return (
              <div
                key={participant.id}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 w-32',
                  hasVoted ? 'border-primary/30 bg-primary/5' : 'border-border',
                  isCurrentUser && 'ring-1 ring-primary/20',
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={participant.user.image ?? undefined} />
                  <AvatarFallback>
                    {participant.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-center truncate w-full">
                  {participant.user.name}
                  {isCurrentUser && ' (You)'}
                </span>
                {participant.user.jobRole && (
                  <Badge
                    className={`text-xs ${
                      {
                        Dev: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        QA: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        QE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                        'QA/QE':
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                        DevOps:
                          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                        'BI-Dev':
                          'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
                        Oversight:
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      }[participant.user.jobRole]
                    }`}
                  >
                    {participant.user.jobRole}
                  </Badge>
                )}
                <div
                  className={cn(
                    'w-full min-h-10 rounded border-2 flex items-center justify-center font-bold text-sm transition-all duration-200 px-1 py-1 text-center break-words',
                    hasVoted
                      ? isRevealed
                        ? 'border-primary bg-primary/10 text-primary animate-in zoom-in-95 duration-200'
                        : 'border-primary/50 bg-primary/20 animate-in zoom-in-95 duration-200'
                      : 'border-dashed border-muted-foreground/30',
                  )}
                >
                  {hasVoted ? (
                    isRevealed ? (
                      <span className="animate-in zoom-in-50 duration-150 break-words w-full text-center leading-tight">
                        {displayVote(vote.points)}
                      </span>
                    ) : (
                      <Check className="h-4 w-4 text-primary animate-in zoom-in-50 duration-150" />
                    )
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
