import { useMemo } from 'react'
import type { ReactNode } from 'react'

import type { SessionView } from '@/common/types/user-preferences'
import { cn } from '@/lib/utils'
import { SessionGroupSection } from './SessionGroupSection'
import type { Space, StatusBucket } from './utils'
import {
  SPACE_ALL,
  STATUS_BUCKET_LABELS,
  groupKey,
  isGroupCollapsed,
  sortComparator,
} from './utils'

export interface GroupedSessionViewProps<T> {
  items: T[]
  view: SessionView
  spaces: Space[]
  /** Accessors so the component stays generic over retros/estimates. */
  getId: (item: T) => string
  getTeamId: (item: T) => string
  getTeamName: (item: T) => string
  getTeamEmoji: (item: T) => string | null | undefined
  getStatusBucket: (item: T) => StatusBucket
  getSortName: (item: T) => string
  getTimestamp: (item: T) => number
  renderItem: (item: T) => ReactNode
  /**
   * Toggle a group's collapsed state (persisted by the parent hook). The
   * `defaultCollapsed` flag tells the parent whether this group defaults to
   * collapsed, so it can store the correctly-inverted key.
   */
  onToggleGroup: (key: string, open: boolean, defaultCollapsed: boolean) => void
  /** Optional empty-state node when nothing matches the current filters. */
  emptyState?: ReactNode
  /** Status bucket that should render collapsed by default (e.g. 'completed'). */
  defaultCollapsedBucket?: StatusBucket
}

const STATUS_ORDER: StatusBucket[] = ['ongoing', 'completed']
const STATUS_ICONS: Record<StatusBucket, string> = {
  ongoing: '🟢',
  completed: '✅',
}

export function GroupedSessionView<T>({
  items,
  view,
  spaces,
  getId,
  getTeamId,
  getTeamName,
  getTeamEmoji,
  getStatusBucket,
  getSortName,
  getTimestamp,
  renderItem,
  onToggleGroup,
  emptyState,
  defaultCollapsedBucket,
}: GroupedSessionViewProps<T>) {
  const bucketDefaultsCollapsed = (bucket: StatusBucket | null) =>
    bucket !== null && bucket === defaultCollapsedBucket
  const isCollapsed = (key: string, bucket: StatusBucket | null) =>
    isGroupCollapsed(view.collapsedGroups, key, bucketDefaultsCollapsed(bucket))

  // 1. Filter by active space + showCompleted.
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (view.space !== SPACE_ALL && getTeamId(item) !== view.space) {
        return false
      }
      if (!view.showCompleted && getStatusBucket(item) === 'completed') {
        return false
      }
      return true
    })
  }, [items, view.space, view.showCompleted, getTeamId, getStatusBucket])

  const comparator = useMemo(
    () => sortComparator<T>(view.sort, getSortName, getTimestamp),
    [view.sort, getSortName, getTimestamp],
  )

  const spaceName = useMemo(() => {
    const map = new Map(spaces.map((s) => [s.id, s] as const))
    return (teamId: string, item: T): Space => ({
      id: teamId,
      name: map.get(teamId)?.name ?? getTeamName(item),
      emoji: map.get(teamId)?.emoji ?? getTeamEmoji(item),
      count: 0,
    })
  }, [spaces, getTeamName, getTeamEmoji])

  const sorted = useMemo(
    () => [...filtered].sort(comparator),
    [filtered, comparator],
  )

  const gridClass =
    view.layout === 'cards'
      ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'
      : 'flex flex-col gap-2'

  if (sorted.length === 0) {
    return <>{emptyState ?? null}</>
  }

  const renderItems = (group: T[]) => (
    <div className={gridClass}>
      {group.map((item) => (
        <div key={getId(item)}>{renderItem(item)}</div>
      ))}
    </div>
  )

  // ---- groupBy: none — flat list ----
  if (view.groupBy === 'none') {
    return renderItems(sorted)
  }

  // ---- groupBy: status — two buckets, team shown on each card ----
  if (view.groupBy === 'status') {
    const byBucket = new Map<StatusBucket, T[]>()
    for (const item of sorted) {
      const bucket = getStatusBucket(item)
      const arr = byBucket.get(bucket) ?? []
      arr.push(item)
      byBucket.set(bucket, arr)
    }
    return (
      <div className="space-y-6">
        {STATUS_ORDER.filter((b) => byBucket.has(b)).map((bucket) => {
          const group = byBucket.get(bucket)!
          const key = groupKey(view, null, bucket)
          return (
            <SessionGroupSection
              key={key}
              icon={STATUS_ICONS[bucket]}
              label={STATUS_BUCKET_LABELS[bucket]}
              count={group.length}
              open={!isCollapsed(key, bucket)}
              onOpenChange={(open) =>
                onToggleGroup(key, open, bucketDefaultsCollapsed(bucket))
              }
              level="space"
            >
              {renderItems(group)}
            </SessionGroupSection>
          )
        })}
      </div>
    )
  }

  // ---- groupBy: space or space-status — outer group per team ----
  const byTeam = new Map<string, T[]>()
  for (const item of sorted) {
    const teamId = getTeamId(item)
    const arr = byTeam.get(teamId) ?? []
    arr.push(item)
    byTeam.set(teamId, arr)
  }

  const orderedTeamIds = Array.from(byTeam.keys()).sort((a, b) => {
    const sa = spaces.find((s) => s.id === a)
    const sb = spaces.find((s) => s.id === b)
    return (sa?.name ?? a).localeCompare(sb?.name ?? b)
  })

  return (
    <div className="space-y-6">
      {orderedTeamIds.map((teamId) => {
        const group = byTeam.get(teamId)!
        const space = spaceName(teamId, group[0])
        const outerKey = groupKey(view, teamId, null)

        return (
          <div
            key={teamId}
            className={cn('rounded-lg border bg-card/40 p-4 space-y-3')}
          >
            <SessionGroupSection
              icon={space.emoji ?? '👥'}
              label={space.name}
              count={group.length}
              open={!isCollapsed(outerKey, null)}
              onOpenChange={(open) => onToggleGroup(outerKey, open, false)}
              level="space"
            >
              {view.groupBy === 'space' ? (
                renderItems(group)
              ) : (
                <div className="space-y-4 pl-1">
                  {STATUS_ORDER.map((bucket) => {
                    const subset = group.filter(
                      (item) => getStatusBucket(item) === bucket,
                    )
                    if (subset.length === 0) return null
                    const innerKey = groupKey(view, teamId, bucket)
                    return (
                      <SessionGroupSection
                        key={innerKey}
                        icon={STATUS_ICONS[bucket]}
                        label={STATUS_BUCKET_LABELS[bucket]}
                        count={subset.length}
                        open={!isCollapsed(innerKey, bucket)}
                        onOpenChange={(open) =>
                          onToggleGroup(
                            innerKey,
                            open,
                            bucketDefaultsCollapsed(bucket),
                          )
                        }
                        level="status"
                      >
                        {renderItems(subset)}
                      </SessionGroupSection>
                    )
                  })}
                </div>
              )}
            </SessionGroupSection>
          </div>
        )
      })}
    </div>
  )
}
