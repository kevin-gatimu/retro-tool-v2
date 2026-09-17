import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { MetricExplanation } from '../types'

interface MetricInfoProps {
  explanation: MetricExplanation
  className?: string
}

/**
 * Small "?" affordance that explains how a report figure is calculated.
 *
 * Uses a popover rather than a tooltip: the content is a paragraph plus a
 * formula and caveats, it has to work on touch, and it must stay open while
 * being read.
 */
export function MetricInfo({ explanation, className }: MetricInfoProps) {
  const { label, summary, formula, notes } = explanation

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${label} is calculated`}
          className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-left">
        <p className="text-sm font-semibold leading-none">{label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {summary}
        </p>
        {formula ? (
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              How it&apos;s calculated
            </p>
            <p className="rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {formula}
            </p>
          </div>
        ) : null}
        {notes?.length ? (
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
