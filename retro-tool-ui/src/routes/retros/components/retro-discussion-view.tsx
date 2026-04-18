import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { RetroDetail } from '@/common/types/retros'
import type { CarriedForwardItem } from '../types'

type MutateFn<T> = (arg: T) => void

interface RetroDiscussionViewProps {
  retro: RetroDetail
  previousCarriedItems: CarriedForwardItem[]
  canControl: boolean
  retroId: string
  discussCardMutation: { mutate: MutateFn<string>; isPending: boolean }
  markDiscussedMutation: { mutate: MutateFn<string>; isPending: boolean }
  createCommentMutation: {
    mutate: MutateFn<{ cardId: string; content: string }>
    isPending: boolean
  }
  deleteCommentMutation: { mutate: MutateFn<string> }
  markCarriedItemDiscussingMutation: {
    mutate: MutateFn<string>
    isPending: boolean
  }
  markCarriedItemDoneMutation: { mutate: MutateFn<string>; isPending: boolean }
  carryItemForwardMutation: {
    mutate: MutateFn<{ id: string; title: string }>
    isPending: boolean
  }
  createCarriedItemCommentMutation: {
    mutate: MutateFn<{ actionItemId: string; content: string }>
    isPending: boolean
  }
  pendingCarriedDiscussItemId: string | null
  pendingCarriedDoneItemId: string | null
  newCarriedItemComments: Partial<Record<string, string>>
  onNewCarriedItemCommentsChange: Dispatch<
    SetStateAction<Partial<Record<string, string>>>
  >
}

export function RetroDiscussionView({
  retro,
  previousCarriedItems,
  canControl,
  discussCardMutation,
  markDiscussedMutation,
  createCommentMutation,
  deleteCommentMutation,
  markCarriedItemDiscussingMutation,
  markCarriedItemDoneMutation,
  carryItemForwardMutation,
  createCarriedItemCommentMutation,
  pendingCarriedDiscussItemId,
  pendingCarriedDoneItemId,
  newCarriedItemComments,
  onNewCarriedItemCommentsChange,
}: RetroDiscussionViewProps) {
  const [newCommentText, setNewCommentText] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const discussionQueueRef = useRef<string[]>([])

  const cardsById = new Map(retro.cards.map((card) => [card.id, card]))

  if (discussionQueueRef.current.length === 0) {
    discussionQueueRef.current = [...retro.cards]
      .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      .map((card) => card.id)
  } else {
    const currentIds = new Set(retro.cards.map((card) => card.id))
    const stillPresent = discussionQueueRef.current.filter((id) =>
      currentIds.has(id),
    )
    const seen = new Set(stillPresent)
    const newcomers = [...retro.cards]
      .filter((card) => !seen.has(card.id))
      .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      .map((card) => card.id)
    discussionQueueRef.current = [...stillPresent, ...newcomers]
  }

  const sortedCards = discussionQueueRef.current
    .map((id) => cardsById.get(id))
    .filter((card): card is RetroDetail['cards'][number] => card !== undefined)

  const firstUndiscussedCard =
    sortedCards.find((card) => !card.isDiscussed) ?? sortedCards.at(0) ?? null

  const currentCard =
    sortedCards.find((c) => c.id === retro.currentDiscussionCardId) ??
    firstUndiscussedCard ??
    null

  const currentIdx = sortedCards.findIndex((c) => c.id === currentCard?.id)
  const nextUndiscussedCard =
    currentIdx >= 0
      ? sortedCards.slice(currentIdx + 1).find((card) => !card.isDiscussed)
      : undefined
  const prevUndiscussedCard =
    currentIdx > 0
      ? [...sortedCards.slice(0, currentIdx)]
          .reverse()
          .find((card) => !card.isDiscussed)
      : undefined

  const currentColumn = currentCard
    ? retro.template.columns.find((col) => col.id === currentCard.columnId)
    : null

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentCard?.comments.length])

  const handleCardFocus = (cardId: string) => {
    if (canControl) {
      discussCardMutation.mutate(cardId)
    }
  }

  const handlePrev = () => {
    if (canControl && prevUndiscussedCard) {
      discussCardMutation.mutate(prevUndiscussedCard.id)
    }
  }

  const handleNext = () => {
    if (canControl && nextUndiscussedCard) {
      discussCardMutation.mutate(nextUndiscussedCard.id)
    }
  }

  const handleSendComment = () => {
    if (!newCommentText.trim() || !currentCard) return
    createCommentMutation.mutate({
      cardId: currentCard.id,
      content: newCommentText.trim(),
    })
    setNewCommentText('')
  }

  return (
    <div className="flex gap-4 min-h-145">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-64 xl:w-72 shrink-0 flex flex-col gap-3">
        {/* Discussion points list */}
        <div className="rounded-xl border bg-card flex flex-col overflow-hidden flex-1">
          <div className="px-3 py-2.5 border-b bg-muted/30 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Discussion Points ({sortedCards.length})
            </p>
          </div>

          <div className="overflow-y-auto flex-1">
            {sortedCards.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No cards to discuss.
              </p>
            )}
            {sortedCards.map((card) => {
              const isActive = card.id === currentCard?.id
              const isDiscussed = card.isDiscussed
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={!canControl || isActive}
                  onClick={() => handleCardFocus(card.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-l-2 transition-colors',
                    isActive
                      ? 'bg-primary/10 border-primary'
                      : 'border-transparent hover:bg-muted/40',
                    isDiscussed && !isActive ? 'opacity-40' : '',
                    canControl && !isActive
                      ? 'cursor-pointer'
                      : 'cursor-default',
                  )}
                >
                  <p
                    className={cn(
                      'text-xs leading-snug',
                      isActive
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground/70 line-clamp-2',
                    )}
                  >
                    {card.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(card.voteCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                        <ThumbsUp className="h-2.5 w-2.5" />
                        {card.voteCount}
                      </span>
                    )}
                    {isDiscussed && (
                      <span className="text-[10px] text-green-600/80 flex items-center gap-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Done
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Prev / Next navigation */}
          {canControl && sortedCards.length > 1 && (
            <div className="border-t p-2 flex gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs gap-1"
                onClick={handlePrev}
                disabled={!prevUndiscussedCard || discussCardMutation.isPending}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs gap-1"
                onClick={handleNext}
                disabled={!nextUndiscussedCard || discussCardMutation.isPending}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Carried forward items in sidebar */}
        {previousCarriedItems.length > 0 && (
          <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10 overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-amber-200/60 dark:border-amber-800/50 bg-amber-100/40 dark:bg-amber-900/20">
              <div className="flex items-center gap-1.5">
                <HistoryIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Carried Forward ({previousCarriedItems.length})
                </p>
              </div>
            </div>
            <div className="divide-y divide-amber-200/40 dark:divide-amber-800/30 max-h-48 overflow-y-auto">
              {previousCarriedItems.map((item) => {
                const isBeingDiscussed =
                  retro.currentDiscussionActionItemId === item.id ||
                  pendingCarriedDiscussItemId === item.id
                const isSaving =
                  markCarriedItemDoneMutation.isPending &&
                  pendingCarriedDoneItemId === item.id
                const isStarting =
                  markCarriedItemDiscussingMutation.isPending &&
                  pendingCarriedDiscussItemId === item.id

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'px-3 py-2',
                      isBeingDiscussed ? 'bg-primary/5' : '',
                    )}
                  >
                    <p
                      className={cn(
                        'text-xs leading-snug',
                        isBeingDiscussed
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground/60 line-clamp-2',
                      )}
                    >
                      {item.title}
                    </p>
                    {canControl && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {isBeingDiscussed ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] px-1.5 text-green-600 hover:text-green-700"
                            onClick={() =>
                              markCarriedItemDoneMutation.mutate(item.id)
                            }
                            disabled={isSaving}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                            {isSaving ? 'Saving…' : 'Done'}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] px-1.5 text-blue-600 hover:text-blue-700"
                            onClick={() =>
                              markCarriedItemDiscussingMutation.mutate(item.id)
                            }
                            disabled={isStarting}
                          >
                            <Play className="h-2.5 w-2.5 mr-0.5" />
                            {isStarting ? 'Starting…' : 'Focus'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 text-[10px] px-1.5 text-amber-600 hover:text-amber-700"
                          onClick={() =>
                            carryItemForwardMutation.mutate({
                              id: item.id,
                              title: item.title,
                            })
                          }
                          disabled={carryItemForwardMutation.isPending}
                        >
                          <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                          Carry
                        </Button>
                      </div>
                    )}
                    {/* Inline comment for focused carried item */}
                    {isBeingDiscussed && (
                      <div className="mt-2 flex gap-1.5">
                        <Input
                          placeholder="Add note…"
                          className="h-6 text-xs"
                          value={newCarriedItemComments[item.id] ?? ''}
                          onChange={(e) =>
                            onNewCarriedItemCommentsChange((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const content =
                              newCarriedItemComments[item.id]?.trim() ?? ''
                            if (content) {
                              createCarriedItemCommentMutation.mutate({
                                actionItemId: item.id,
                                content,
                              })
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          disabled={
                            !(newCarriedItemComments[item.id] ?? '').trim() ||
                            createCarriedItemCommentMutation.isPending
                          }
                          onClick={() => {
                            const content =
                              newCarriedItemComments[item.id]?.trim() ?? ''
                            if (content) {
                              createCarriedItemCommentMutation.mutate({
                                actionItemId: item.id,
                                content,
                              })
                            }
                          }}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {!currentCard && (
          <div className="flex-1 flex items-center justify-center rounded-xl border bg-card text-muted-foreground text-sm">
            No cards to discuss yet.
          </div>
        )}

        {currentCard && (
          <>
            {/* Focused card panel */}
            <div className="rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                {currentColumn && (
                  <>
                    <span className="text-lg">
                      {currentColumn.emoji ?? '💬'}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {currentColumn.name}
                    </span>
                  </>
                )}
                {(currentCard.voteCount ?? 0) > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto gap-1 bg-primary/10 text-primary border-0"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    {currentCard.voteCount}
                  </Badge>
                )}
              </div>

              {currentCard.sourceContents &&
              currentCard.sourceContents.length > 1 ? (
                <ul className="list-disc list-inside space-y-1.5 text-base leading-relaxed">
                  {currentCard.sourceContents.map((content, idx) => (
                    <li key={idx} className="font-medium">
                      {content}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base sm:text-lg leading-relaxed font-medium">
                  {currentCard.content}
                </p>
              )}

              <div className="flex items-center justify-between mt-4">
                {currentCard.isDiscussed ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-300 dark:border-green-800 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Discussed
                  </Badge>
                ) : (
                  <span />
                )}
                {canControl && !currentCard.isDiscussed && (
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                    onClick={() => markDiscussedMutation.mutate(currentCard.id)}
                    disabled={markDiscussedMutation.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark as Discussed
                  </Button>
                )}
              </div>
            </div>

            {/* Chat / Discussion notes */}
            <div className="flex-1 flex flex-col rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2 shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Discussion Notes</p>
                {currentCard.comments.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] h-5"
                  >
                    {currentCard.comments.length}
                  </Badge>
                )}
              </div>

              <div className="overflow-y-auto p-3 space-y-3 min-h-45 max-h-95">
                {currentCard.comments.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    No discussion notes yet. Be the first to add one.
                  </p>
                )}
                {currentCard.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={comment.author?.image ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {comment.author?.name?.charAt(0) ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 rounded-lg bg-muted/50 px-3 py-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                        {comment.author?.name ?? 'Unknown'}
                      </p>
                      <p className="text-sm leading-snug">{comment.content}</p>
                    </div>
                    {comment.isOwn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t p-3 flex gap-2 shrink-0">
                <Input
                  placeholder="Add a discussion note…"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      newCommentText.trim()
                    ) {
                      e.preventDefault()
                      handleSendComment()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleSendComment}
                  disabled={
                    !newCommentText.trim() || createCommentMutation.isPending
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
