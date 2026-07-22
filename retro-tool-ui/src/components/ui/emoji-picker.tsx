import { useState } from 'react'
import { EmojiPicker as Frimousse } from 'frimousse'
import { Smile, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  /** Currently-selected emoji character, or empty when none. */
  value?: string | null
  /** Called with the picked emoji character (e.g. "😄"); saved to the DB as-is. */
  onSelect: (emoji: string) => void
  /** Called when the user clears the emoji. Omit to hide the clear affordance. */
  onClear?: () => void
  className?: string
  disabled?: boolean
  /** Accessible label for the trigger button. */
  ariaLabel?: string
}

/**
 * Reusable emoji picker used anywhere a user attaches an emoji (poll options,
 * standup questions, team/space icons, …). A compact trigger button shows the
 * current emoji (or a placeholder icon); clicking opens a searchable Frimousse
 * picker in a popover. The selected value is the raw emoji character string, so
 * it persists directly into the existing `emoji` text columns — no schema change.
 *
 * Emoji data is fetched live from Frimousse's default CDN (Emojibase), so the
 * set stays current without a rebuild.
 */
export function EmojiPicker({
  value,
  onSelect,
  onClear,
  className,
  disabled = false,
  ariaLabel = 'Pick an emoji',
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn('w-14 shrink-0 text-lg', className)}
        >
          {value ? (
            <span aria-hidden>{value}</span>
          ) : (
            <Smile className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,90vw)] p-0" align="start">
        <Frimousse.Root
          className="isolate flex h-80 w-full flex-col bg-popover text-popover-foreground"
          onEmojiSelect={({ emoji }) => {
            onSelect(emoji)
            setOpen(false)
          }}
        >
          <div className="flex items-center gap-2 border-b p-2">
            <Frimousse.Search
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Search emoji…"
            />
            {onClear && value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                aria-label="Clear emoji"
                onClick={() => {
                  onClear()
                  setOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Frimousse.Viewport className="relative flex-1 outline-none">
            <Frimousse.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading…
            </Frimousse.Loading>
            <Frimousse.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No emoji found.
            </Frimousse.Empty>
            <Frimousse.List
              className="select-none pb-1.5"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pb-1.5 pt-3 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-accent"
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </Frimousse.Viewport>
        </Frimousse.Root>
      </PopoverContent>
    </Popover>
  )
}
