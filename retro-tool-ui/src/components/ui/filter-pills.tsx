import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface FilterPillOption<TValue extends string> {
  value: TValue
  label: string
  /** Optional hover description shown in a tooltip. */
  description?: string
}

interface FilterPillsProps<TValue extends string> {
  options: FilterPillOption<TValue>[]
  value: TValue
  onChange: (value: TValue) => void
  /** Accessible label for the group. */
  ariaLabel?: string
  className?: string
}

/**
 * A row of clickable filter pills (single-select), styled to match the
 * SpaceSwitcher pills. Each pill optionally shows a hover tooltip describing
 * what it filters to.
 */
export function FilterPills<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: FilterPillsProps<TValue>) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn('flex flex-wrap items-center gap-2', className)}
      >
        {options.map((option) => {
          const active = option.value === value
          const pill = (
            <button
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {option.label}
            </button>
          )

          if (!option.description) {
            return <span key={option.value}>{pill}</span>
          }

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>{pill}</TooltipTrigger>
              <TooltipContent>{option.description}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
