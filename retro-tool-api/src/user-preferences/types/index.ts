/**
 * UI preference contract for the "Team Spaces" feature.
 *
 * These types are the source of truth for the `ui_preferences` jsonb column.
 * They are mirrored on the UI side in
 * `retro-tool-ui/src/common/types/user-preferences.ts` — keep the two in sync.
 *
 * Every field is optional at the persistence layer so partial PATCHes are safe
 * (the service deep-merges) and the UI fills in defaults.
 */

/**
 * Active space tab. Either the sentinel `'all'` (the SPACE_ALL constant below)
 * or a specific teamId. Typed as `string` because a string-literal union with
 * `string` collapses to `string` anyway.
 */
export type SessionViewSpace = string;

/** Sentinel value for the "All Spaces" tab. */
export const SPACE_ALL = 'all';

/** How sessions are grouped on a list page. */
export type GroupByMode = 'space-status' | 'status' | 'space' | 'none';

/** Card grid vs. compact rows. */
export type LayoutMode = 'cards' | 'list';

/** Within-group ordering. */
export type SortMode = 'recent' | 'oldest' | 'name';

/** Per-page view configuration that the app remembers for each user. */
export interface SessionView {
  /** Active SpaceSwitcher tab. */
  space: SessionViewSpace;
  /** Grouping strategy. */
  groupBy: GroupByMode;
  /** Layout density. */
  layout: LayoutMode;
  /** Sort order within groups. */
  sort: SortMode;
  /** Pinned teamIds, shown first in the switcher. */
  favorites: string[];
  /** Whether the Completed bucket is shown. */
  showCompleted: boolean;
  /** Collapsed group keys (persisted open/closed state). */
  collapsedGroups?: string[];
}

/** Root jsonb blob. Keyed by list page so each remembers its own view. */
export interface UiPreferences {
  sessionViews?: {
    retros?: Partial<SessionView>;
    estimates?: Partial<SessionView>;
  };
}
