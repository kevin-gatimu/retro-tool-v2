import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  CheckCircle2,
  GitMerge,
  MoreVertical,
  Plus,
  RotateCcw,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { RetroDetail } from '@/common/types/retros'
import type { TRetroStatus } from '@/common/enums/retro.enums'
import type { LocalPendingCards, Mutation } from '../types'

const JOB_ROLE_BADGE_CLASSES: Record<string, string> = {
  Dev: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QA: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  QE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'QA/QE':
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  DevOps:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'BI-Dev':
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Oversight: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface RetroBoardProps {
  retroStatus: TRetroStatus
  templateColumns: RetroDetail['template']['columns']
  cards: RetroDetail['cards']
  currentDiscussionCardId: string | null
  userVoteCount: number
  maxVotesPerUser: number
  selectedCardIds: Record<string, boolean>
  onToggleCardSelection: (cardId: string) => void
  localPendingCards: LocalPendingCards
  newCardContent: Partial<Record<string, string>>
  onNewCardContentChange: Dispatch<
    SetStateAction<Partial<Record<string, string>>>
  >
  scrollRefs: RefObject<Record<string, HTMLDivElement | null>>
  createCardMutation: Mutation<{ columnId: string; content: string }>
  deleteCardMutation: Mutation<string>
  mergeCardsMutation: Mutation<{ cardIds: string[]; columnId: string }>
  unmergeCardMutation: Mutation<string>
  voteMutation: Mutation<string>
  removeVoteMutation: Mutation<string>
  onTypingStart: () => void
  onTypingStop: () => void
}

/**
 * The active/voting/grouping card grid. Owns the dnd-kit drag machinery and the
 * grouping-phase stable card ordering; all mutations and board state are passed
 * in from the route. Lazy-loaded so dnd-kit stays out of the initial route
 * chunk (only mounts for the phases that render a board).
 */
export function RetroBoard({
  retroStatus,
  templateColumns,
  cards,
  currentDiscussionCardId,
  userVoteCount,
  maxVotesPerUser,
  selectedCardIds,
  onToggleCardSelection,
  localPendingCards,
  newCardContent,
  onNewCardContentChange,
  scrollRefs,
  createCardMutation,
  deleteCardMutation,
  mergeCardsMutation,
  unmergeCardMutation,
  voteMutation,
  removeVoteMutation,
  onTypingStart,
  onTypingStop,
}: RetroBoardProps) {
  const isGrouping = retroStatus === 'grouping'

  // DnD sensors — require 8px movement before drag starts so clicks still register
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingCardId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCardId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeData = active.data.current as { columnId: string }
    const overData = over.data.current as { columnId: string }

    // Prevent cross-column merging
    if (activeData.columnId !== overData.columnId) {
      toast.warning('Cards can only be merged within the same column')
      return
    }

    mergeCardsMutation.mutate({
      cardIds: [active.id as string, over.id as string],
      columnId: activeData.columnId,
    })
  }

  // Preserve card positions during grouping so the merged card doesn't jump
  // when the Convex snapshot arrives with a brand-new server-side card ID.
  const stableCardOrderRef = useRef<string[]>([])

  const stableRetroCards = useMemo(() => {
    const allCards = cards
    if (!isGrouping) {
      stableCardOrderRef.current = []
      return allCards
    }

    const prevOrder = stableCardOrderRef.current
    if (prevOrder.length === 0) {
      stableCardOrderRef.current = allCards.map((c) => c.id)
      return allCards
    }

    const incomingMap = new Map(allCards.map((c) => [c.id, c]))
    const prevSet = new Set(prevOrder)
    const newCards = allCards.filter((c) => !prevSet.has(c.id))

    const result: RetroDetail['cards'] = []
    let newCardsInserted = false

    for (const id of prevOrder) {
      if (incomingMap.has(id)) {
        result.push(incomingMap.get(id)!)
      } else if (!newCardsInserted && newCards.length > 0) {
        // Card was removed (merged); slot in the replacement card(s) here
        for (const card of newCards) result.push(card)
        newCardsInserted = true
      }
    }

    if (!newCardsInserted) {
      for (const card of newCards) result.push(card)
    }

    stableCardOrderRef.current = result.map((c) => c.id)
    return result
  }, [cards, isGrouping])

  const getColumnCards = useCallback(
    (columnId: string) => {
      const columnCards = stableRetroCards.filter(
        (c) => c.columnId === columnId,
      )
      if (retroStatus === 'grouping' || retroStatus === 'voting')
        return columnCards
      // active phase: oldest first so newest cards appear at the bottom (chat-like)
      if (retroStatus === 'active') return [...columnCards].reverse()
      return [...columnCards].sort(
        (a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0),
      )
    },
    [stableRetroCards, retroStatus],
  )

  const handleVoteClick = useCallback(
    (cardId: string, hasVoted: boolean) => {
      if (hasVoted) {
        removeVoteMutation.mutate(cardId)
        return
      }

      if (userVoteCount >= maxVotesPerUser) {
        toast.warning(
          `You have used all ${maxVotesPerUser} votes. Remove a vote to change your selection.`,
        )
        return
      }

      voteMutation.mutate(cardId)
    },
    [userVoteCount, maxVotesPerUser, voteMutation, removeVoteMutation],
  )

  return (
    <DndContext
      sensors={dndSensors}
      onDragStart={isGrouping ? handleDragStart : undefined}
      onDragEnd={isGrouping ? handleDragEnd : undefined}
    >
      <div
        className={cn(
          'grid gap-3 sm:gap-4 pb-2',
          'grid-cols-1',
          templateColumns.length >= 2 && 'sm:grid-cols-2',
          templateColumns.length >= 3 && 'lg:grid-cols-3',
          templateColumns.length >= 4 && 'xl:grid-cols-4',
        )}
      >
        {templateColumns.map((column, index) => {
          const columnCards = getColumnCards(column.id)
          const selectedCardsInColumn = columnCards.filter(
            (card) => selectedCardIds[card.id],
          )
          // Filter out pending cards already confirmed by the server to prevent
          // the brief duplicate while the cleanup effect hasn't run yet
          const pendingCards = (localPendingCards[column.id] ?? []).filter(
            (p) =>
              !columnCards.some((sc) => sc.content.trim() === p.content.trim()),
          )
          const totalCards = columnCards.length + pendingCards.length
          const canShowPendingCards =
            retroStatus === 'active' || retroStatus === 'voting'

          const gradients = [
            'from-rose-500/10 via-pink-500/5 to-transparent',
            'from-violet-500/10 via-purple-500/5 to-transparent',
            'from-amber-500/10 via-orange-500/5 to-transparent',
            'from-emerald-500/10 via-green-500/5 to-transparent',
            'from-sky-500/10 via-blue-500/5 to-transparent',
            'from-fuchsia-500/10 via-pink-500/5 to-transparent',
          ]
          const borderColors = [
            'border-rose-500/20',
            'border-violet-500/20',
            'border-amber-500/20',
            'border-emerald-500/20',
            'border-sky-500/20',
            'border-fuchsia-500/20',
          ]
          const gradient = gradients[index % gradients.length]
          const borderColor = borderColors[index % borderColors.length]

          return (
            <div
              key={column.id}
              className={cn(
                'flex min-w-0 flex-col rounded-xl border-2 bg-linear-to-b shadow-sm overflow-hidden',
                'max-h-[28rem] sm:max-h-[32rem] lg:h-[calc(100vh-17rem)] lg:max-h-none',
                borderColor,
                gradient,
              )}
            >
              {/* Column Header */}
              <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-background/80 text-xl sm:text-2xl shadow-sm backdrop-blur-sm shrink-0">
                  {column.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="font-semibold text-sm sm:text-base truncate">
                      {column.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className="text-[10px] sm:text-xs shrink-0 bg-background/60 backdrop-blur-sm"
                    >
                      {totalCards}
                    </Badge>
                  </div>
                  {isGrouping && selectedCardsInColumn.length >= 1 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs font-semibold bg-amber-400 text-amber-950 hover:bg-amber-300 border border-amber-300 shadow-sm"
                      onClick={() =>
                        mergeCardsMutation.mutate({
                          cardIds: selectedCardsInColumn.map((card) => card.id),
                          columnId: column.id,
                        })
                      }
                      disabled={
                        selectedCardsInColumn.length < 2 ||
                        mergeCardsMutation.isPending
                      }
                    >
                      <GitMerge className="mr-1 h-3 w-3" />
                      Merge ({selectedCardsInColumn.length})
                    </Button>
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 hidden sm:block">
                    {isGrouping
                      ? 'Drag cards onto each other to merge, or check to select'
                      : column.prompt}
                  </p>
                </div>
              </div>

              {/* Cards List */}
              <div
                ref={(el) => {
                  scrollRefs.current[column.id] = el
                }}
                className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-3"
              >
                <div className="space-y-2 sm:space-y-3 py-3">
                  {columnCards.length === 0 && pendingCards.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                      <div className="text-3xl sm:text-4xl mb-2 opacity-50">
                        {column.emoji}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {retroStatus === 'active'
                          ? 'No cards yet. Add your thoughts!'
                          : retroStatus === 'voting'
                            ? 'No cards are available to vote on yet.'
                            : 'No cards are available in this column yet.'}
                      </p>
                    </div>
                  )}
                  {columnCards.map((card) => {
                    const isCurrentDiscussion =
                      currentDiscussionCardId === card.id
                    const isDiscussed = card.isDiscussed
                    return (
                      <DraggableCard
                        key={card.id}
                        id={card.id}
                        columnId={card.columnId}
                        enabled={isGrouping}
                        className={cn(
                          'group relative transition-all duration-200 bg-background rounded-lg overflow-hidden',
                          'before:absolute before:inset-0 before:bg-linear-to-r before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100',
                          'shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]',
                          isGrouping &&
                            selectedCardIds[card.id] &&
                            'ring-2 ring-primary/60',
                          isGrouping && 'cursor-pointer',
                          card.hasVoted &&
                            'ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]',
                          isCurrentDiscussion &&
                            'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
                          isDiscussed && 'opacity-60',
                        )}
                        onClick={
                          isGrouping
                            ? (e) => {
                                // Don't fire if the user clicked a button, input, or link
                                if (
                                  (e.target as HTMLElement).closest(
                                    'button, input, a',
                                  )
                                )
                                  return
                                onToggleCardSelection(card.id)
                              }
                            : undefined
                        }
                      >
                        {isGrouping && (
                          <label className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px]">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedCardIds[card.id])}
                              onChange={() => onToggleCardSelection(card.id)}
                              className="h-3 w-3"
                            />
                            Select
                          </label>
                        )}
                        <div className="relative px-3 py-2.5">
                          {card.sourceContents &&
                          card.sourceContents.length > 1 ? (
                            <ul className="text-sm leading-relaxed list-disc list-inside space-y-1">
                              {card.sourceContents.map((content, idx) => (
                                <li key={idx} className="whitespace-pre-wrap">
                                  {content}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {card.content}
                            </p>
                          )}
                        </div>
                        <div className="relative flex items-center justify-between px-3 py-1.5 bg-linear-to-r from-muted/40 to-muted/20">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {card.canUnmerge ? (
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary cursor-default select-none">
                                      <GitMerge className="h-3 w-3" />
                                      {card.mergedCount ??
                                        card.mergedFromNames?.length ??
                                        2}{' '}
                                      cards merged
                                    </span>
                                  </TooltipTrigger>
                                  {(card.mergedFromNames?.length ?? 0) > 0 && (
                                    <TooltipContent side="top">
                                      <p className="text-xs font-medium mb-0.5">
                                        Merged from:
                                      </p>
                                      <ul className="text-xs space-y-0.5">
                                        {card.mergedFromNames!.map(
                                          (name, i) => (
                                            <li key={i}>{name}</li>
                                          ),
                                        )}
                                      </ul>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                {isGrouping && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-6 gap-1 px-2 text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-400 border border-rose-400 shadow-sm"
                                    onClick={() =>
                                      unmergeCardMutation.mutate(card.id)
                                    }
                                    disabled={unmergeCardMutation.isPending}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Unmerge
                                  </Button>
                                )}
                              </div>
                            ) : card.author ? (
                              <>
                                <Avatar className="h-4 w-4 ring-1 ring-border">
                                  <AvatarImage
                                    src={card.author.image ?? undefined}
                                  />
                                  <AvatarFallback className="text-[8px]">
                                    {card.author.name?.charAt(0) ?? '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-[11px]">
                                  {card.author.name}
                                </span>
                                {card.author.jobRole && (
                                  <Badge
                                    className={`text-[10px] h-5 ${
                                      JOB_ROLE_BADGE_CLASSES[
                                        card.author.jobRole
                                      ]
                                    }`}
                                  >
                                    {card.author.jobRole}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="italic text-muted-foreground/70 text-[11px]">
                                Anonymous
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5">
                            {/* Vote button (only in voting phase) */}
                            {retroStatus === 'voting' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={
                                      card.hasVoted ? 'default' : 'ghost'
                                    }
                                    size="sm"
                                    className={cn(
                                      'h-6 gap-1 px-2 text-xs transition-all',
                                      card.hasVoted && 'shadow-sm',
                                    )}
                                    onClick={() =>
                                      handleVoteClick(
                                        card.id,
                                        Boolean(card.hasVoted),
                                      )
                                    }
                                    disabled={
                                      voteMutation.isPending ||
                                      removeVoteMutation.isPending
                                    }
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                    {(card.voteCount ?? 0) > 0 && (
                                      <span className="font-semibold">
                                        {card.voteCount}
                                      </span>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {card.hasVoted
                                    ? 'Remove vote'
                                    : 'Vote for this'}
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Discussed badge */}
                            {isDiscussed && (
                              <Badge className="h-5 gap-1 text-[10px] bg-green-500/10 text-green-600 border-green-300 dark:border-green-800">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Discussed
                              </Badge>
                            )}

                            {/* Delete button (only for own cards in active phase) */}
                            {retroStatus === 'active' && card.isOwn && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      deleteCardMutation.mutate(card.id)
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </DraggableCard>
                    )
                  })}
                  {canShowPendingCards &&
                    pendingCards.map((card) => (
                      <div
                        key={card.id}
                        className="relative bg-background rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)] opacity-70"
                      >
                        <div className="px-3 py-2.5">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {card.content}
                          </p>
                        </div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-linear-to-r from-muted/40 to-muted/20">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {card.author ? (
                              <>
                                <Avatar className="h-4 w-4 ring-1 ring-border">
                                  <AvatarImage
                                    src={card.author.image ?? undefined}
                                  />
                                  <AvatarFallback className="text-[8px]">
                                    {card.author.name?.charAt(0) ?? '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-[11px]">
                                  {card.author.name}
                                </span>
                              </>
                            ) : (
                              <span className="italic text-muted-foreground/70 text-[11px]">
                                Anonymous
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Add Card Input (only in active phase) */}
              {retroStatus === 'active' && (
                <div className="shrink-0 border-t border-border/50 p-2 sm:p-4 bg-background/50 backdrop-blur-sm rounded-b-xl">
                  <Textarea
                    placeholder={`Share your "${column.name.toLowerCase()}"...`}
                    value={newCardContent[column.id] ?? ''}
                    onChange={(e) => {
                      onNewCardContentChange((prev) => ({
                        ...prev,
                        [column.id]: e.target.value,
                      }))
                      onTypingStart()
                    }}
                    onBlur={onTypingStop}
                    className="min-h-15 sm:min-h-20 resize-none border-border/50 bg-background/80 focus-visible:ring-primary/50 transition-all text-sm"
                    onKeyDown={(e) => {
                      const content = (newCardContent[column.id] ?? '').trim()
                      if (e.key === 'Enter' && !e.shiftKey && content) {
                        e.preventDefault()
                        onTypingStop()
                        createCardMutation.mutate({
                          columnId: column.id,
                          content,
                        })
                      }
                    }}
                  />
                  <div className="flex items-center justify-between mt-2 sm:mt-3">
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">
                      Press Enter to submit
                    </p>
                    <Button
                      size="sm"
                      disabled={
                        !(newCardContent[column.id] ?? '').trim() ||
                        createCardMutation.isPending
                      }
                      onClick={() => {
                        const content = (newCardContent[column.id] ?? '').trim()
                        if (content) {
                          onTypingStop()
                          createCardMutation.mutate({
                            columnId: column.id,
                            content,
                          })
                        }
                      }}
                      className="shadow-sm h-7 sm:h-8 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <Plus className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-4 sm:w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {draggingCardId && (
          <div className="rounded-lg bg-background border-2 border-primary shadow-xl px-3 py-2.5 opacity-90 text-sm font-medium text-muted-foreground rotate-2">
            {cards.find((c) => c.id === draggingCardId)?.content.slice(0, 60) ??
              'Card'}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ─── DraggableCard ────────────────────────────────────────────────────────────
// Wraps a card with dnd-kit draggable + droppable during the grouping phase.
const DraggableCard = memo(function DraggableCardComponent({
  id,
  columnId,
  enabled,
  className,
  children,
  onClick,
}: {
  id: string
  columnId: string
  enabled: boolean
  className?: string
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id, data: { columnId }, disabled: !enabled })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id,
    data: { columnId },
    disabled: !enabled,
  })

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRef}
      {...(enabled ? listeners : {})}
      {...(enabled ? attributes : {})}
      className={cn(
        className,
        isDragging && 'opacity-40',
        isOver && enabled && 'ring-2 ring-blue-400 ring-offset-1',
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
})
