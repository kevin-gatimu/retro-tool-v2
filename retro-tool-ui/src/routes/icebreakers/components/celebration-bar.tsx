import confetti from 'canvas-confetti'
import type { Options, Shape } from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Three "good answer" reactions with escalating intensity:
//   Celebrate = good · Applause = better · Fire = best.
// Each fires a burst that launches UP from the clicked button (emoji + paper
// confetti). Local-only — in a screen-share that's all everyone sees anyway.
type Celebration = {
  kind: 'celebrate' | 'applause' | 'fire'
  label: string
  buttonEmoji: string
  emojis: string[]
  particleCount: number
  spread: number
  startVelocity: number
  colors: string[]
}

const CELEBRATIONS: Celebration[] = [
  {
    kind: 'celebrate',
    label: 'Celebrate',
    buttonEmoji: '🎉',
    emojis: ['🎉', '🎊'],
    particleCount: 45,
    spread: 50,
    startVelocity: 48,
    colors: ['#34d399', '#a7f3d0', '#ffffff'],
  },
  {
    kind: 'applause',
    label: 'Applause',
    buttonEmoji: '👏',
    emojis: ['👏', '🙌', '✨'],
    particleCount: 90,
    spread: 70,
    startVelocity: 58,
    colors: ['#f59e0b', '#fbbf24', '#fde68a', '#ffffff'],
  },
  {
    kind: 'fire',
    label: 'Fire',
    buttonEmoji: '🔥',
    emojis: ['🔥', '🎆', '🎇'],
    particleCount: 160,
    spread: 95,
    startVelocity: 68,
    colors: ['#ef4444', '#f97316', '#facc15'],
  },
]

// Draw above everything (dialogs, sticky headers). canvas-confetti's default
// z-index is 100; bump it so the burst is never hidden behind app chrome.
const Z_INDEX = 2000

function emojiShapes(emojis: string[]): Shape[] {
  const shapes: Shape[] = []
  for (const emoji of emojis) {
    try {
      shapes.push(confetti.shapeFromText({ text: emoji, scalar: 2.2 }))
    } catch {
      // shapeFromText can fail in rare environments — skip that emoji.
    }
  }
  return shapes
}

// Normalised viewport origin (0–1) at the centre of the clicked button, so the
// burst visibly launches from the button itself.
function originFromElement(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  }
}

function fireCelebration(celebration: Celebration, el: HTMLElement) {
  const base: Options = {
    origin: originFromElement(el),
    angle: 90, // straight up
    startVelocity: celebration.startVelocity,
    spread: celebration.spread,
    zIndex: Z_INDEX,
    ticks: 220,
  }

  // Paper-confetti layer rising from the button.
  confetti({
    ...base,
    particleCount: celebration.particleCount,
    colors: celebration.colors,
  })

  // Emoji layer flying up alongside it.
  const shapes = emojiShapes(celebration.emojis)
  if (shapes.length) {
    confetti({
      ...base,
      particleCount: Math.max(12, Math.round(celebration.particleCount / 3)),
      scalar: 2.2,
      shapes,
    })
  }
}

interface CelebrationBarProps {
  className?: string
}

export function CelebrationBar({ className }: CelebrationBarProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-3', className)}
      role="group"
      aria-label="Celebrate a great answer"
    >
      {CELEBRATIONS.map((celebration) => (
        <Button
          key={celebration.kind}
          variant="outline"
          size="lg"
          className="gap-2 text-base"
          onClick={(event) => fireCelebration(celebration, event.currentTarget)}
        >
          <span aria-hidden="true">{celebration.buttonEmoji}</span>
          {celebration.label}
        </Button>
      ))}
    </div>
  )
}
