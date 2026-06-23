import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { USER_PREFERENCES_ENDPOINTS } from '@/lib/api-endpoints'
import type {
  SessionView,
  SessionViewPage,
  UserNotificationPreferences,
} from '@/common/types/user-preferences'
import { SPACE_ALL } from '@/components/spaces/utils'

const PREFERENCES_QUERY_KEY = ['user-preferences'] as const
const PATCH_DEBOUNCE_MS = 500

/** Defaults applied when a user has never configured a view. */
const DEFAULT_VIEW: SessionView = {
  space: SPACE_ALL,
  groupBy: 'space-status',
  layout: 'cards',
  sort: 'recent',
  favorites: [],
  showCompleted: true,
  collapsedGroups: [],
}

function mergeView(stored: Partial<SessionView> | undefined): SessionView {
  return { ...DEFAULT_VIEW, ...(stored ?? {}) }
}

interface UseSessionViewPreferencesResult {
  view: SessionView
  setView: (patch: Partial<SessionView>) => void
  isLoading: boolean
}

/**
 * Reads and persists the remembered "Team Spaces" view config for a list page.
 *
 * - Reads the shared `['user-preferences']` query (same key/fetcher as the
 *   profile settings page) and merges the stored view over hard defaults.
 * - `setView` updates the React Query cache immediately (instant UI) and then
 *   issues a debounced, **silent** PATCH of only the changed sub-tree. The
 *   backend deep-merges, so sending just the delta never clobbers the sibling
 *   page's view. We deliberately do NOT reuse `useUserPreferencesMutation`,
 *   which toasts on every call and would spam on view tweaks.
 */
export function useSessionViewPreferences(
  page: SessionViewPage,
): UseSessionViewPreferencesResult {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: () =>
      api.get<UserNotificationPreferences>(USER_PREFERENCES_ENDPOINTS.BASE),
    staleTime: 60_000,
  })

  const view = useMemo(
    () => mergeView(data?.uiPreferences?.sessionViews?.[page]),
    [data, page],
  )

  // Debounce timer + the latest pending patch for this page.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Partial<SessionView>>({})

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const patch = pendingRef.current
    pendingRef.current = {}
    if (Object.keys(patch).length === 0) return

    void api
      .patch<UserNotificationPreferences>(USER_PREFERENCES_ENDPOINTS.BASE, {
        uiPreferences: { sessionViews: { [page]: patch } },
      })
      .then((updated) => {
        queryClient.setQueryData(PREFERENCES_QUERY_KEY, updated)
      })
      .catch(() => {
        // Silent: a remembered-view write failing is non-critical. Refetch to
        // resync the cache with the server's actual state.
        void queryClient.invalidateQueries({ queryKey: PREFERENCES_QUERY_KEY })
      })
  }, [page, queryClient])

  const setView = useCallback(
    (patch: Partial<SessionView>) => {
      // 1. Optimistic cache update so the UI reflects the change instantly.
      queryClient.setQueryData<UserNotificationPreferences | undefined>(
        PREFERENCES_QUERY_KEY,
        (prev) => {
          if (!prev) return prev
          const sessionViews = prev.uiPreferences?.sessionViews ?? {}
          return {
            ...prev,
            uiPreferences: {
              ...prev.uiPreferences,
              sessionViews: {
                ...sessionViews,
                [page]: { ...(sessionViews[page] ?? {}), ...patch },
              },
            },
          }
        },
      )

      // 2. Accumulate the delta and (re)arm the debounced PATCH.
      pendingRef.current = { ...pendingRef.current, ...patch }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, PATCH_DEBOUNCE_MS)
    },
    [flush, page, queryClient],
  )

  // Flush any pending write on unmount so quick changes aren't lost.
  useEffect(() => () => flush(), [flush])

  return { view, setView, isLoading }
}
