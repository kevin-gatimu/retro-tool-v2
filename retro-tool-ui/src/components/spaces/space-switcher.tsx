import { useMemo } from 'react'
import { Layers, MoreHorizontal, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Space } from './utils'
import { SPACE_ALL, orderSpacesByFavorites } from './utils'

/** Max pills (excluding "All") rendered inline before overflowing to a menu. */
const MAX_INLINE_PILLS = 6

interface SpaceSwitcherProps {
  spaces: Space[]
  value: string
  onChange: (value: string) => void
  favorites: string[]
  onToggleFavorite: (teamId: string) => void
  /** Total count for the "All Spaces" pill. */
  totalCount: number
}

/**
 * Pill-tab switcher for selecting which space (team) the list shows. Renders
 * `All Spaces` first, then favorited spaces (pinned), then the rest, with an
 * overflow dropdown once there are more than MAX_INLINE_PILLS teams.
 *
 * Hidden entirely when the user has 1 or fewer spaces — there's nothing to
 * switch between.
 */
export function SpaceSwitcher({
  spaces,
  value,
  onChange,
  favorites,
  onToggleFavorite,
  totalCount,
}: SpaceSwitcherProps) {
  const ordered = useMemo(
    () => orderSpacesByFavorites(spaces, favorites),
    [spaces, favorites],
  )

  // Nothing to switch between.
  if (spaces.length <= 1) return null

  const inline = ordered.slice(0, MAX_INLINE_PILLS)
  const overflow = ordered.slice(MAX_INLINE_PILLS)
  const favSet = new Set(favorites)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SpacePill
        active={value === SPACE_ALL}
        onClick={() => onChange(SPACE_ALL)}
        icon={<Layers className="h-3.5 w-3.5" />}
        label="All Spaces"
        count={totalCount}
      />

      {inline.map((space) => (
        <SpacePill
          key={space.id}
          active={value === space.id}
          onClick={() => onChange(space.id)}
          icon={
            <span className="text-sm leading-none">{space.emoji ?? '👥'}</span>
          }
          label={space.name}
          count={space.count}
          favorited={favSet.has(space.id)}
          onToggleFavorite={() => onToggleFavorite(space.id)}
        />
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <MoreHorizontal className="h-4 w-4" />
              {overflow.length} more
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
            {overflow.map((space) => (
              <DropdownMenuItem
                key={space.id}
                onClick={() => onChange(space.id)}
                className={cn(
                  'flex items-center gap-2',
                  value === space.id && 'bg-accent',
                )}
              >
                <span className="text-sm leading-none">
                  {space.emoji ?? '👥'}
                </span>
                <span className="flex-1 truncate">{space.name}</span>
                <Badge variant="secondary">{space.count}</Badge>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFavorite(space.id)
                  }}
                  className="ml-1 text-muted-foreground hover:text-amber-500"
                  aria-label={
                    favSet.has(space.id)
                      ? 'Unpin space'
                      : 'Pin space to favorites'
                  }
                >
                  <Star
                    className={cn(
                      'h-3.5 w-3.5',
                      favSet.has(space.id) && 'fill-amber-400 text-amber-400',
                    )}
                  />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

interface SpacePillProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
  favorited?: boolean
  onToggleFavorite?: () => void
}

function SpacePill({
  active,
  onClick,
  icon,
  label,
  count,
  favorited,
  onToggleFavorite,
}: SpacePillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5"
      >
        {icon}
        <span className="max-w-40 truncate">{label}</span>
        <Badge
          variant={active ? 'secondary' : 'outline'}
          className={cn('ml-0.5', active && 'bg-primary-foreground/20')}
        >
          {count}
        </Badge>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={favorited ? 'Unpin space' : 'Pin space to favorites'}
          className={cn(
            'ml-0.5 transition-colors',
            active
              ? 'text-primary-foreground/70 hover:text-primary-foreground'
              : 'text-muted-foreground hover:text-amber-500',
          )}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              favorited && 'fill-amber-400 text-amber-400',
            )}
          />
        </button>
      )}
    </div>
  )
}
