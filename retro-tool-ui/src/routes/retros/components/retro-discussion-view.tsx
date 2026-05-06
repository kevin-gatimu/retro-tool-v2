import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  MessageSquare,
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
}: RetroDiscussionViewProps) {
  const [newCommentText, setNewCommentText] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)
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

  // When a carried item is focused, don't auto-fall-back to a card
  const currentCarriedItem = retro.currentDiscussionActionItemId
    ? (previousCarriedItems.find(
        (i) => i.id === retro.currentDiscussionActionItemId,
      ) ?? null)
    : null

  const currentCard = currentCarriedItem
    ? null
    : (sortedCards.find((c) => c.id === retro.currentDiscussionCardId) ??
      firstUndiscussedCard ??
      null)

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

  // Scroll to bottom when comments change or focused item switches
  useEffect(() => {
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [
    currentCard?.comments.length,
    currentCard?.id,
    currentCarriedItem?.comments?.length,
    currentCarriedItem?.id,
  ])

  const handleCardFocus = (cardId: string) => {
    if (canControl) discussCardMutation.mutate(cardId)
  }

  const handleCarriedFocus = (itemId: string) => {
    if (canControl) markCarriedItemDiscussingMutation.mutate(itemId)
  }

  const handlePrev = () => {
    if (canControl && prevUndiscussedCard)
      discussCardMutation.mutate(prevUndiscussedCard.id)
  }

  const handleNext = () => {
    if (canControl && nextUndiscussedCard)
      discussCardMutation.mutate(nextUndiscussedCard.id)
  }

  const handleSendComment = () => {
    const text = newCommentText.trim()
    if (!text) return

    if (currentCarriedItem) {
      createCarriedItemCommentMutation.mutate({
        actionItemId: currentCarriedItem.id,
        content: text,
      })
    } else if (currentCard) {
      createCommentMutation.mutate({ cardId: currentCard.id, content: text })
    }
    setNewCommentText('')
  }

  const isSendingComment =
    createCommentMutation.isPending ||
    createCarriedItemCommentMutation.isPending

  // Unified comments list — either from current card or current carried item
  const activeComments: Array<{
    id: string
    content: string
    isOwn?: boolean
    author: { id: string; name: string | null; image: string | null } | null
  }> = currentCarriedItem
    ? (currentCarriedItem.comments ?? [])
    : (currentCard?.comments ?? [])

  return (
    <div className="flex gap-4 h-[calc(100vh-17rem)]">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <div className="w-64 xl:w-72 shrink-0 flex flex-col min-h-0 rounded-xl border bg-card overflow-hidden">
        {/* Discussion Points */}
        <div className="px-3 py-2.5 border-b bg-muted/30 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Discussion Points ({sortedCards.length})
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {sortedCards.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              No cards to discuss.
            </p>
          )}
          {sortedCards.map((card) => {
            const isActive = card.id === currentCard?.id && !currentCarriedItem
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
                  isDiscussed && !isActive ? 'opacity-60' : '',
                  canControl && !isActive ? 'cursor-pointer' : 'cursor-default',
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

        {/* ── Carried Forward partition ─────────────────────────── */}
        {previousCarriedItems.length > 0 && (
          <>
            <div className="border-t border-amber-200/60 dark:border-amber-800/50 px-3 py-2 bg-amber-100/40 dark:bg-amber-900/20 shrink-0">
              <div className="flex items-center gap-1.5">
                <HistoryIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Carried Forward ({previousCarriedItems.length})
                </p>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-border/50 shrink-0">
              {previousCarriedItems.map((item) => {
                const isActive = item.id === currentCarriedItem?.id
                const isDone = item.status === 'completed'
                const isStarting =
                  markCarriedItemDiscussingMutation.isPending &&
                  pendingCarriedDiscussItemId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!canControl || isActive || isStarting}
                    onClick={() => handleCarriedFocus(item.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 border-l-2 transition-colors',
                      isActive
                        ? 'bg-amber-500/10 border-amber-500'
                        : 'border-transparent hover:bg-amber-50/50 dark:hover:bg-amber-900/20',
                      isDone && !isActive ? 'opacity-50' : '',
                      canControl && !isActive
                        ? 'cursor-pointer'
                        : 'cursor-default',
                    )}
                  >
                    <p
                      className={cn(
                        'text-xs leading-snug line-clamp-2',
                        isActive
                          ? 'font-semibold text-foreground'
                          : 'text-muted-foreground/70',
                      )}
                    >
                      {item.title}
                    </p>
                    {isDone && (
                      <span className="text-[10px] text-green-600/80 flex items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Done
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
        {!currentCard && !currentCarriedItem && (
          <div className="flex-1 flex items-center justify-center rounded-xl border bg-card text-muted-foreground text-sm">
            No cards to discuss yet.
          </div>
        )}

        {/* ── Regular card focused panel ── */}
        {currentCard && !currentCarriedItem && (
          <>
            <div className="rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm shrink-0">
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

            {/* Discussion notes for card */}
            <DiscussionNotesPanel
              comments={activeComments}
              newCommentText={newCommentText}
              onCommentChange={setNewCommentText}
              onSend={handleSendComment}
              onDeleteComment={deleteCommentMutation.mutate}
              isSending={isSendingComment}
              chatScrollRef={chatScrollRef}
            />
          </>
        )}

        {/* ── Carried Forward focused panel ── */}
        {currentCarriedItem && (
          <>
            <div className="rounded-xl border-2 border-amber-400/40 dark:border-amber-600/40 bg-card p-5 shadow-sm shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <HistoryIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                  Carried Forward
                </span>
                {currentCarriedItem.status === 'completed' && (
                  <Badge className="ml-auto bg-green-500/10 text-green-600 border-green-300 dark:border-green-800 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Done
                  </Badge>
                )}
              </div>

              {currentCarriedItem.sourceContents &&
              currentCarriedItem.sourceContents.length > 1 ? (
                <ul className="list-disc list-inside space-y-1.5 text-base leading-relaxed">
                  {currentCarriedItem.sourceContents.map((content, idx) => (
                    <li key={idx} className="font-medium">
                      {content}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base sm:text-lg leading-relaxed font-medium">
                  {currentCarriedItem.title}
                </p>
              )}

              {currentCarriedItem.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {currentCarriedItem.description}
                </p>
              )}

              {canControl && currentCarriedItem.status !== 'completed' && (
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/20"
                    onClick={() =>
                      carryItemForwardMutation.mutate({
                        id: currentCarriedItem.id,
                        title: currentCarriedItem.title,
                      })
                    }
                    disabled={carryItemForwardMutation.isPending}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Carry Forward Again
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1 ml-auto"
                    onClick={() =>
                      markCarriedItemDoneMutation.mutate(currentCarriedItem.id)
                    }
                    disabled={
                      markCarriedItemDoneMutation.isPending &&
                      pendingCarriedDoneItemId === currentCarriedItem.id
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark as Done
                  </Button>
                </div>
              )}
            </div>

            {/* Discussion notes for carried item */}
            <DiscussionNotesPanel
              comments={activeComments}
              newCommentText={newCommentText}
              onCommentChange={setNewCommentText}
              onSend={handleSendComment}
              onDeleteComment={deleteCommentMutation.mutate}
              isSending={isSendingComment}
              chatScrollRef={chatScrollRef}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared Discussion Notes Panel ────────────────────────────────────────────
function DiscussionNotesPanel({
  comments,
  newCommentText,
  onCommentChange,
  onSend,
  onDeleteComment,
  isSending,
  chatScrollRef,
}: {
  comments: Array<{
    id: string
    content: string
    isOwn?: boolean
    author: { id: string; name: string | null; image: string | null } | null
  }>
  newCommentText: string
  onCommentChange: (v: string) => void
  onSend: () => void
  onDeleteComment: (id: string) => void
  isSending: boolean
  chatScrollRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="flex-1 flex flex-col rounded-xl border bg-card overflow-hidden min-h-0">
      <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2 shrink-0">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-sm font-medium">Discussion Notes</p>
        {comments.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-[10px] h-5">
            {comments.length}
          </Badge>
        )}
      </div>

      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3"
      >
        {comments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No discussion notes yet. Be the first to add one.
          </p>
        )}
        {comments.map((comment) => (
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
                onClick={() => onDeleteComment(comment.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="border-t p-3 shrink-0">
        <div className="relative">
          <Input
            placeholder="Add a discussion note…"
            value={newCommentText}
            onChange={(e) => onCommentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && newCommentText.trim()) {
                e.preventDefault()
                onSend()
              }
            }}
            className="w-full pr-10"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!newCommentText.trim() || isSending}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
