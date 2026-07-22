import type { SessionView, SortMode } from '@/common/types/user-preferences'

/** Sentinel for the "All Spaces" tab (mirrors API `SPACE_ALL`). */
export const SPACE_ALL = 'all'

/** Status bucket a session falls into. */
export type StatusBucket = 'ongoing' | 'completed'

/** A team "space" used for grouping session lists. */
export interface Space {
  id: string
  name: string
  emoji?: string | null
  count: number
}

/** Retro completed bucket iff status === 'completed'. */
export function retroStatusBucket(status: string): StatusBucket {
  return status === 'completed' ? 'completed' : 'ongoing'
}

/** Comparator for within-group ordering. */
export function sortComparator<T>(
  sort: SortMode,
  getName: (item: T) => string,
  getTimestamp: (item: T) => number,
): (a: T, b: T) => number {
  switch (sort) {
    case 'name':
      return (a, b) => getName(a).localeCompare(getName(b))
    case 'oldest':
      return (a, b) => getTimestamp(a) - getTimestamp(b)
    case 'recent':
    default:
      return (a, b) => getTimestamp(b) - getTimestamp(a)
  }
}

/**
 * Whether a group should render collapsed, given the persisted set and whether
 * this group defaults to collapsed.
 *
 * The persisted `collapsedGroups` array is interpreted per-group:
 * - Default-open groups (the norm): a key PRESENT means "collapsed".
 * - Default-collapsed groups (e.g. Completed): the meaning is INVERTED — a key
 *   present means "expanded". So an absent key keeps the group collapsed by
 *   default, and the user's explicit expand is what's remembered.
 *
 * `groupKey` encodes the status bucket, so default-collapsed (completed) keys
 * never collide with default-open keys.
 */
export function isGroupCollapsed(
  collapsedGroups: string[] | undefined,
  key: string,
  defaultCollapsed = false,
): boolean {
  const present = (collapsedGroups ?? []).includes(key)
  return defaultCollapsed ? !present : present
}

/**
 * Compute the next `collapsedGroups` array when a group is toggled, honoring the
 * inverted meaning for default-collapsed groups (see {@link isGroupCollapsed}).
 */
export function nextCollapsedGroups(
  collapsedGroups: string[] | undefined,
  key: string,
  open: boolean,
  defaultCollapsed = false,
): string[] {
  const current = collapsedGroups ?? []
  // For default-collapsed groups the array tracks EXPANDED keys, so add on open;
  // for default-open groups it tracks COLLAPSED keys, so add on close.
  const shouldStoreKey = defaultCollapsed ? open : !open
  if (shouldStoreKey) {
    return current.includes(key) ? current : [...current, key]
  }
  return current.filter((k) => k !== key)
}

/** Human label for a status bucket. */
export const STATUS_BUCKET_LABELS: Record<StatusBucket, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
}

/** Stable group key used for persisted collapse state. */
export function groupKey(
  view: Pick<SessionView, 'groupBy'>,
  spaceId: string | null,
  bucket: StatusBucket | null,
): string {
  return [view.groupBy, spaceId ?? '*', bucket ?? '*'].join(':')
}
