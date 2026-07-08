import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Shuffle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ICEBREAKER_PROMPT_DECISIONS } from '@/common/enums/icebreaker.enums'
import type { TIcebreakerPromptDecision } from '@/common/enums/icebreaker.enums'
import type { IcebreakerDeckPrompt } from '@/common/types/icebreakers'

const NAV_THRESHOLD = 90
const SLIDE_MS = 260
const SELECT_BOUNCE_MS = 600
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

interface SwipeDeckProps {
  /** Pending prompts in deck order. */
  pending: IcebreakerDeckPrompt[]
  disabled?: boolean
  /** Commit a decision on a specific card (the one currently shown). */
  onDecide: (
    decision: TIcebreakerPromptDecision,
    sessionPromptId: string,
  ) => void
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Facilitator-only prompt browser. Dragging the card (or ← / →) moves between
 * pending prompts WITHOUT committing — it's a carousel that also peeks the next
 * card. Skip / Select commit a decision on the card on screen; Shuffle
 * re-randomises the browse order.
 */
export function SwipeDeck({ pending, disabled, onDecide }: SwipeDeckProps) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // Card id currently playing the celebratory "Select" bounce.
  const [bouncingId, setBouncingId] = useState<string | null>(null)
  // Local browse order (card ids). Lets Shuffle reorder without touching the
  // server-side deck.
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    pending.map((p) => p.id),
  )
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const byId = useMemo(() => {
    const map = new Map<string, IcebreakerDeckPrompt>()
    for (const p of pending) map.set(p.id, p)
    return map
  }, [pending])

  // Reconcile the local order when the deck changes (a card was decided, etc.):
  // keep the current order, drop ids no longer pending, append any new ones.
  useEffect(() => {
    const pendingIds = pending.map((p) => p.id)
    const next = [
      ...orderIds.filter((id) => byId.has(id)),
      ...pendingIds.filter((id) => !orderIds.includes(id)),
    ]
    if (
      next.length !== orderIds.length ||
      next.some((id, i) => id !== orderIds[i])
    ) {
      setOrderIds(next)
    }
  }, [pending, byId, orderIds])

  const deck = orderIds
    .map((id) => byId.get(id))
    .filter((p): p is IcebreakerDeckPrompt => Boolean(p))

  const safeIndex = Math.min(index, Math.max(0, deck.length - 1))
  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex)
  }, [index, safeIndex])

  const hasPrev = safeIndex > 0
  const hasNext = safeIndex < deck.length - 1
  const nextCard = hasNext ? deck[safeIndex + 1] : null

  const goPrev = () => {
    if (hasPrev) setIndex(safeIndex - 1)
    setDragX(0)
  }
  const goNext = () => {
    if (hasNext) setIndex(safeIndex + 1)
    setDragX(0)
  }

  const handleSelect = (sessionPromptId: string) => {
    if (disabled || bouncingId) return
    // Play the bounce, then commit once it has finished.
    setBouncingId(sessionPromptId)
    window.setTimeout(() => {
      onDecide(ICEBREAKER_PROMPT_DECISIONS.Kept, sessionPromptId)
    }, SELECT_BOUNCE_MS)
  }

  const handleShuffle = () => {
    if (disabled || bouncingId) return
    setOrderIds((ids) => shuffled(ids))
    setIndex(0)
    setDragX(0)
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    if (disabled || bouncingId) return
    draggingRef.current = true
    setIsDragging(true)
    startXRef.current = event.clientX
    cardRef.current?.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return
    setDragX(event.clientX - startXRef.current)
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    cardRef.current?.releasePointerCapture(event.pointerId)

    // Drag right → previous card, drag left → next card (carousel browsing).
    if (dragX > NAV_THRESHOLD) {
      goPrev()
    } else if (dragX < -NAV_THRESHOLD) {
      goNext()
    } else {
      setDragX(0)
    }
  }

  // Keyboard: ← / → browse the deck (no commit).
  useEffect(() => {
    if (disabled || bouncingId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1))
        setDragX(0)
      } else if (event.key === 'ArrowRight') {
        setIndex((i) => Math.min(deck.length - 1, i + 1))
        setDragX(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, bouncingId, deck.length])

  if (deck.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-muted-foreground">
        No prompts left in the deck.
      </div>
    )
  }

  // Safe: deck is non-empty and safeIndex is clamped to its bounds.
  const current = deck[safeIndex]
  const rotation = dragX * 0.03

  return (
    <div
      className="flex w-full flex-col items-center gap-6"
      role="group"
      aria-label={`Icebreaker prompt ${safeIndex + 1} of ${deck.length}: ${current.text}`}
    >
      <div className="flex w-full max-w-2xl items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={goPrev}
          disabled={disabled || !hasPrev}
          aria-label="Previous prompt"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="relative h-64 w-full max-w-md">
          {/* Faint depth card. */}
          <div
            className="absolute inset-0 translate-y-4 scale-[0.9] rounded-2xl border bg-card/40"
            aria-hidden="true"
          />

          {/* Sneak peek of the NEXT card: offset + rotated behind the top one,
              with its text grayed so the host can see what's coming. */}
          {nextCard ? (
            <div
              className="absolute inset-0 flex translate-x-6 translate-y-2 rotate-[4deg] items-center justify-center overflow-hidden rounded-2xl border bg-card/80 p-8 text-center"
              aria-hidden="true"
            >
              <p className="text-balance text-lg font-semibold leading-relaxed text-muted-foreground/40">
                {nextCard.text}
              </p>
            </div>
          ) : null}

          <div
            ref={cardRef}
            // key forces a fresh mount per card so switching slides cleanly in.
            key={current.id}
            className={cn(
              'absolute inset-0 flex cursor-grab touch-none select-none flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-lg active:cursor-grabbing',
              bouncingId === current.id && 'animate-select-bounce',
            )}
            style={
              bouncingId === current.id
                ? undefined
                : {
                    transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                    transition: isDragging
                      ? 'none'
                      : `transform ${SLIDE_MS}ms ${EASING}`,
                  }
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 to-transparent"
              aria-hidden="true"
            />
            <p className="text-balance text-xl font-semibold leading-relaxed">
              {current.text}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={goNext}
          disabled={disabled || !hasNext}
          aria-label="Next prompt"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Position dots. */}
      <div className="flex items-center gap-1.5">
        {deck.map((p, i) => (
          <span
            key={p.id}
            className={
              i === safeIndex
                ? 'h-2 w-2 rounded-full bg-primary'
                : 'h-2 w-2 rounded-full bg-muted-foreground/30'
            }
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          disabled={disabled || bouncingId !== null}
          onClick={() =>
            onDecide(ICEBREAKER_PROMPT_DECISIONS.Skipped, current.id)
          }
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Skip
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={disabled || bouncingId !== null || deck.length < 2}
          onClick={handleShuffle}
          className="gap-2"
        >
          <Shuffle className="h-4 w-4" />
          Shuffle
        </Button>
        <Button
          size="lg"
          disabled={disabled || bouncingId !== null}
          onClick={() => handleSelect(current.id)}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          Select
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag or use ← / → to browse · Skip / Select decides this card ·{' '}
        {deck.length} prompt{deck.length === 1 ? '' : 's'} left
      </p>
    </div>
  )
}
