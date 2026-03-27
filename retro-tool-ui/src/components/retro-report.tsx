import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Forward,
  Mail,
  MessageSquare,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { RETROS_ENDPOINTS } from '@/lib/api-endpoints'
import type { RetroDetail } from '@/common/types/retros'
import { cn } from '@/lib/utils'
import { useSendRetroReport } from '@/routes/retros/hooks/useSendRetroReport'

interface RetroReportProps {
  retro: RetroDetail
}

export function RetroReport({ retro }: RetroReportProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const [selectedCarryForward, setSelectedCarryForward] = useState<
    Record<string, boolean>
  >({})
  const sendRetroReportMutation = useSendRetroReport(retro.id)

  const columns = retro.template.columns
  const allCards = retro.cards

  const discussedCards = allCards.filter((c) => c.isDiscussed)
  const carriedForwardCards = allCards.filter(
    (c) => !c.isDiscussed && c.isCarriedForward,
  )
  const undiscussedCards = allCards.filter(
    (c) => !c.isDiscussed && !c.isCarriedForward,
  )

  const totalVotes = allCards.reduce((sum, c) => sum + (c.voteCount ?? 0), 0)
  const totalComments = allCards.reduce((sum, c) => sum + c.comments.length, 0)

  const mostVoted: RetroDetail['cards'][number] | null =
    allCards.length > 0
      ? [...allCards].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))[0]
      : null

  const completedAt = retro.completedAt
    ? new Date(retro.completedAt).toLocaleString()
    : null

  const carryForwardMutation = useMutation({
    mutationFn: () => {
      const cardIds = Object.entries(selectedCarryForward)
        .filter(([, checked]) => checked)
        .map(([id]) => id)
      return api.post<{ created: number }>(
        RETROS_ENDPOINTS.CARRY_FORWARD(retro.id),
        { cardIds },
      )
    },
    onSuccess: (data) => {
      toast.success(
        `${data.created} action item${data.created !== 1 ? 's' : ''} created for carry-forward`,
      )
      setSelectedCarryForward({})
      queryClient.invalidateQueries({ queryKey: ['retro', retro.id] })
    },
    onError: (e: Error) =>
      toast.error(e.message || 'Failed to create action items'),
  })

  const selectedCount =
    Object.values(selectedCarryForward).filter(Boolean).length

  const getCardsForColumn = (columnId: string, cards: typeof allCards) =>
    cards.filter((c) => c.columnId === columnId)

  return (
    <div className="mt-8 space-y-4">
      {/* Report Header Toggle */}
      <div className="flex w-full items-center justify-between gap-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center justify-between rounded-xl border bg-card px-5 py-4 text-left shadow-sm hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-base">Retro Report</p>
              <p className="text-xs text-muted-foreground">
                {discussedCards.length} discussed · {undiscussedCards.length}{' '}
                not discussed
                {carriedForwardCards.length > 0
                  ? ` · ${carriedForwardCards.length} carried forward`
                  : ''}{' '}
                · {completedAt ?? 'Completed'}
              </p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            sendRetroReportMutation.mutate({})
          }}
          disabled={sendRetroReportMutation.isPending}
          title="Send report to all team members by email"
        >
          <Mail className="h-4 w-4 mr-1.5" />
          {sendRetroReportMutation.isPending ? 'Sending...' : 'Email Report'}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Participants"
              value={retro.participants.length}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Cards"
              value={allCards.length}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <StatCard
              label="Votes Cast"
              value={totalVotes}
              icon={<ThumbsUp className="h-4 w-4" />}
            />
            <StatCard
              label="Comments"
              value={totalComments}
              icon={<MessageSquare className="h-4 w-4" />}
            />
          </div>

          {mostVoted && (mostVoted.voteCount ?? 0) > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs font-medium text-primary mb-1">
                Most Voted
              </p>
              {mostVoted.sourceContents &&
              mostVoted.sourceContents.length > 1 ? (
                <ul className="text-sm font-medium list-disc list-inside space-y-0.5">
                  {mostVoted.sourceContents.map((content, idx) => (
                    <li key={idx}>{content}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium">{mostVoted.content}</p>
              )}
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="h-3 w-3" />
                {mostVoted.voteCount} votes ·{' '}
                {columns.find((c) => c.id === mostVoted.columnId)?.name ??
                  'Unknown column'}
              </div>
            </div>
          )}

          {/* Discussed Cards */}
          {discussedCards.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm">
                  Discussed ({discussedCards.length})
                </h3>
              </div>
              {columns.map((col) => {
                const cards = getCardsForColumn(col.id, discussedCards)
                if (cards.length === 0) return null
                return (
                  <div key={col.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {col.emoji} {col.name}
                    </p>
                    <div className="space-y-1.5 pl-2 border-l-2 border-green-200 dark:border-green-900">
                      {cards.map((card) => (
                        <ReportCard
                          key={card.id}
                          card={card}
                          status="discussed"
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {/* Undiscussed Cards */}
          {undiscussedCards.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">
                  Not Discussed ({undiscussedCards.length})
                </h3>
              </div>

              {columns.map((col) => {
                const cards = getCardsForColumn(col.id, undiscussedCards)
                if (cards.length === 0) return null
                return (
                  <div key={col.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {col.emoji} {col.name}
                    </p>
                    <div className="space-y-1.5 pl-2 border-l-2 border-amber-200 dark:border-amber-900">
                      {cards.map((card) => (
                        <ReportCard
                          key={card.id}
                          card={card}
                          status="undiscussed"
                          selected={
                            retro.isCreator
                              ? !!selectedCarryForward[card.id]
                              : undefined
                          }
                          onSelect={
                            retro.isCreator
                              ? (checked) =>
                                  setSelectedCarryForward((prev) => ({
                                    ...prev,
                                    [card.id]: checked,
                                  }))
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Carry Forward Action - only visible to retro creator */}
              {retro.isCreator && (
                <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        Carry Forward to Next Retro
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select undiscussed items above to create action items
                        for the next session.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        selectedCount === 0 || carryForwardMutation.isPending
                      }
                      onClick={() => carryForwardMutation.mutate()}
                      className="shrink-0"
                    >
                      {carryForwardMutation.isPending
                        ? 'Creating...'
                        : selectedCount > 0
                          ? `Carry Forward (${selectedCount})`
                          : 'Carry Forward'}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Carried Forward Cards */}
          {carriedForwardCards.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Forward className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">
                  Carried Forward ({carriedForwardCards.length})
                </h3>
              </div>
              {columns.map((col) => {
                const cards = getCardsForColumn(col.id, carriedForwardCards)
                if (cards.length === 0) return null
                return (
                  <div key={col.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {col.emoji} {col.name}
                    </p>
                    <div className="space-y-1.5 pl-2 border-l-2 border-purple-200 dark:border-purple-900">
                      {cards.map((card) => (
                        <ReportCard
                          key={card.id}
                          card={card}
                          status="carried-forward"
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}

          {undiscussedCards.length === 0 && discussedCards.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-center">
              <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                All cards were discussed!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function ReportCard({
  card,
  status,
  selected,
  onSelect,
}: {
  card: RetroDetail['cards'][number]
  status: 'discussed' | 'undiscussed' | 'carried-forward'
  selected?: boolean
  onSelect?: (checked: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 bg-background',
        status === 'discussed' && 'opacity-80',
        status === 'carried-forward' &&
          'border-purple-200 bg-purple-50/30 dark:border-purple-800/50 dark:bg-purple-950/20',
      )}
    >
      {status === 'undiscussed' && onSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelect(!!v)}
          className="mt-0.5 shrink-0"
        />
      )}
      {status === 'discussed' && (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
      )}
      {status === 'carried-forward' && (
        <Forward className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        {card.sourceContents && card.sourceContents.length > 1 ? (
          <ul className="text-sm leading-snug list-disc list-inside space-y-0.5">
            {card.sourceContents.map((content, idx) => (
              <li key={idx}>{content}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-snug">{card.content}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {(card.voteCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {card.voteCount}
            </span>
          )}
          {card.comments.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {card.comments.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
