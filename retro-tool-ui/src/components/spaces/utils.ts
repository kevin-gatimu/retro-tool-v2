import type { SessionView, SortMode } from '@/common/types/user-preferences'
import type { Team } from '@/common/types/teams'

/** Sentinel for the "All Spaces" tab (mirrors API `SPACE_ALL`). */
export const SPACE_ALL = 'all'

/** Status bucket a session falls into. */
export type StatusBucket = 'ongoing' | 'completed'

/** A selectable space (team) in the SpaceSwitcher. */
export interface Space {
  id: string
  name: string
  emoji?: string | null
  count: number
}

/** Minimal shape every grouped session must expose. */
export interface SessionLike {
  teamId: string
  teamName?: string | null
  teamEmoji?: string | null
}

/**
 * Build the list of spaces to show in the switcher: the union of the user's
 * teams (from `/api/teams`) and any team that actually appears in the loaded
 * sessions (so a session whose team you've since left still shows). Names and
 * emojis are seeded from `/api/teams` first, falling back to the fields carried
 * on each session. `count` is the number of sessions per team in the supplied
 * (already space-agnostic) list.
 */
export function deriveSpaces(
  teams: Pick<Team, 'id' | 'name' | 'emoji'>[],
  sessions: SessionLike[],
): Space[] {
  const map = new Map<string, Space>()

  for (const team of teams) {
    map.set(team.id, {
      id: team.id,
      name: team.name,
      emoji: team.emoji,
      count: 0,
    })
  }

  for (const session of sessions) {
    if (!session.teamId) continue
    const existing = map.get(session.teamId)
    if (existing) {
      existing.count += 1
    } else {
      map.set(session.teamId, {
        id: session.teamId,
        name: session.teamName ?? 'Unknown team',
        emoji: session.teamEmoji,
        count: 1,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/** Retro completed bucket iff status === 'completed'. */
export function retroStatusBucket(status: string): StatusBucket {
  return status === 'completed' ? 'completed' : 'ongoing'
}

/**
 * Estimate completed bucket iff status is 'completed'. Revealed sessions are
 * still live (awaiting consensus) and count as ongoing — matching the API's
 * getActiveSessions, which includes revealed.
 */
export function estimateStatusBucket(status: string): StatusBucket {
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

/** Order spaces with favorites pinned first, each block kept alphabetical. */
export function orderSpacesByFavorites(
  spaces: Space[],
  favorites: string[],
): Space[] {
  const favSet = new Set(favorites)
  const favored = spaces.filter((s) => favSet.has(s.id))
  const rest = spaces.filter((s) => !favSet.has(s.id))
  return [...favored, ...rest]
}

/** Toggle a teamId in a favorites list (immutably). */
export function toggleFavorite(favorites: string[], teamId: string): string[] {
  return favorites.includes(teamId)
    ? favorites.filter((id) => id !== teamId)
    : [...favorites, teamId]
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
