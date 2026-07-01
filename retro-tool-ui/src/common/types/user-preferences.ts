// UI-side mirror of the Team Spaces preference contract.
// Source of truth lives in the API at
// `retro-tool-api/src/user-preferences/types/index.ts` — keep the two in sync.

/** Active space tab: 'all' or a specific teamId. */
export type SessionViewSpace = 'all' | string

/** How sessions are grouped on a list page. */
export type GroupByMode = 'space-status' | 'status' | 'space' | 'none'

/** Card grid vs. compact rows. */
export type LayoutMode = 'cards' | 'list'

/** Within-group ordering. */
export type SortMode = 'recent' | 'oldest' | 'name'

/** Per-page view configuration that the app remembers for each user. */
export interface SessionView {
  space: SessionViewSpace
  groupBy: GroupByMode
  layout: LayoutMode
  sort: SortMode
  favorites: string[]
  showCompleted: boolean
  collapsedGroups?: string[]
}

/** Which list page a SessionView belongs to. */
export type SessionViewPage = 'retros' | 'estimates' | 'icebreakers'

/** Preferred colour theme. `system` follows the OS setting. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** Root jsonb blob. Keyed by list page so each remembers its own view. */
export interface UiPreferences {
  sessionViews?: {
    retros?: Partial<SessionView>
    estimates?: Partial<SessionView>
    icebreakers?: Partial<SessionView>
  }
  /** Colour theme, synced across devices (localStorage still caches it). */
  theme?: ThemePreference
  /** Whether the user has opted into browser push notifications. */
  pushNotifications?: boolean
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export interface UserNotificationPreferences {
  id: string
  userId: string
  emailVerificationReminders: boolean
  uiPreferences?: UiPreferences
  createdAt: Date
  updatedAt: Date
}

export interface UpdatePreferencesInput {
  emailVerificationReminders?: boolean
  uiPreferences?: DeepPartial<UiPreferences>
}
