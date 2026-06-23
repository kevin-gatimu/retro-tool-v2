import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SessionGroupSectionProps {
  /** Leading emoji or icon (e.g. team emoji, or a status glyph). */
  icon?: ReactNode
  /** Group label (team name or status). */
  label: string
  /** Item count shown as a badge. */
  count: number
  /** Whether the section is open. */
  open: boolean
  /** Called when the user toggles the section. */
  onOpenChange: (open: boolean) => void
  /** Visual weight — outer (space) headers are larger than inner (status). */
  level?: 'space' | 'status'
  children: ReactNode
}

/**
 * Collapsible group wrapper used by GroupedSessionView. Mirrors the section
 * header styling already used on the estimate-history page (icon + label +
 * count badge), with a persisted open/closed state driven by the parent.
 */
export function SessionGroupSection({
  icon,
  label,
  count,
  open,
  onOpenChange,
  level = 'space',
  children,
}: SessionGroupSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="space-y-3">
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center gap-2 text-left',
          level === 'space' ? 'mt-2' : 'mt-1',
        )}
      >
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
        {icon ? <span className="text-lg leading-none">{icon}</span> : null}
        <span
          className={cn(
            level === 'space'
              ? 'text-base font-semibold tracking-tight'
              : 'text-xs font-medium uppercase tracking-wide text-muted-foreground',
          )}
        >
          {label}
        </span>
        <Badge variant="secondary" className="ml-1">
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}
