import { Check } from 'lucide-react'

import { TShirtIcon, getShirtScale } from '@/components/t-shirt-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { VoteOption } from '../types'

interface VoteCardsProps {
  templateName: string | null
  voteOptions: VoteOption[]
  selectedPoints: string | null
  disabled: boolean
  isTShirtTemplate: boolean
  tShirtThemeColor: string
  onVote: (points: string) => void
}

export function VoteCards({
  templateName,
  voteOptions,
  selectedPoints,
  disabled,
  isTShirtTemplate,
  tShirtThemeColor,
  onVote,
}: VoteCardsProps) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-3">
        Select your estimate
        {templateName && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            · {templateName}
          </span>
        )}
      </h3>
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {voteOptions.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onVote(option.value)}
                disabled={disabled}
                style={
                  !isTShirtTemplate &&
                  option.color &&
                  selectedPoints !== option.value
                    ? {
                        borderColor: `${option.color}40`,
                        color: option.color,
                      }
                    : undefined
                }
                className={cn(
                  'relative cursor-pointer rounded-lg transition-all duration-150 ease-out',
                  'hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  'flex flex-col items-center justify-center active:scale-95',
                  'text-center',
                  isTShirtTemplate
                    ? 'w-20 h-20 sm:w-24 sm:h-24 border-0 bg-transparent p-0 overflow-hidden'
                    : 'min-w-12 sm:min-w-14 min-h-16 sm:min-h-20 border-2 font-bold text-sm sm:text-base bg-card px-2 py-1 break-words',
                  !isTShirtTemplate &&
                    (selectedPoints === option.value
                      ? 'border-primary bg-primary/10 text-primary shadow-lg scale-105 animate-in zoom-in-95 duration-200'
                      : 'border-border hover:border-primary/50'),
                  isTShirtTemplate &&
                    selectedPoints === option.value &&
                    'scale-110 shadow-lg drop-shadow-md animate-in zoom-in-95 duration-200',
                  disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
                )}
              >
                {isTShirtTemplate ? (
                  <TShirtIcon
                    label={option.label}
                    themeColor={option.color ?? tShirtThemeColor}
                    selected={selectedPoints === option.value}
                    scale={getShirtScale(option.label)}
                  />
                ) : (
                  option.label
                )}
                {selectedPoints === option.value && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center animate-in zoom-in-50 duration-200">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{option.value}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
