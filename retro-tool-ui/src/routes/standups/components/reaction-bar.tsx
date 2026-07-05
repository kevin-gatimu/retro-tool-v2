import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { StandupReaction } from '@/common/types/standups'
import { QUICK_REACTIONS } from '../helpers'

interface ReactionBarProps {
  reactions: StandupReaction[]
  currentUserId: string
  onToggle: (emoji: string, hasReacted: boolean) => void
}

export function ReactionBar({
  reactions,
  currentUserId,
  onToggle,
}: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // Group reactions by emoji.
  const grouped = reactions.reduce<
    Record<string, { count: number; users: string[]; mine: boolean }>
  >((acc, reaction) => {
    const group = acc[reaction.emoji] ?? { count: 0, users: [], mine: false }
    group.count += 1
    group.users.push(reaction.userName)
    if (reaction.userId === currentUserId) group.mine = true
    acc[reaction.emoji] = group
    return acc
  }, {})

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(grouped).map(([emoji, group]) => (
        <Tooltip key={emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onToggle(emoji, group.mine)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors hover:border-primary/60',
                group.mine
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/40',
              )}
            >
              <span>{emoji}</span>
              <span className="text-xs font-medium">{group.count}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{group.users.join(', ')}</TooltipContent>
        </Tooltip>
      ))}

      <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
          >
            <SmilePlus className="h-4 w-4" />
            <span className="sr-only">Add reaction</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="flex gap-1 p-1.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md p-1.5 text-lg transition-colors hover:bg-accent"
              onClick={() => {
                const mine = reactions.some(
                  (reaction) =>
                    reaction.emoji === emoji &&
                    reaction.userId === currentUserId,
                )
                onToggle(emoji, mine)
                setPickerOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
