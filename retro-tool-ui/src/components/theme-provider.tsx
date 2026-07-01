import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { applyTheme, ThemeContext } from '@/hooks/use-theme'
import type { Theme } from '@/hooks/use-theme'
import { authClient } from '@/lib/auth-client'
import { api } from '@/lib/api'
import { USER_PREFERENCES_ENDPOINTS } from '@/lib/api-endpoints'
import type { UserNotificationPreferences } from '@/common/types/user-preferences'

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

const PREFERENCES_QUERY_KEY = ['user-preferences'] as const

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem(storageKey) as Theme | null
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored
  }
  return fallback
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session

  // localStorage is the synchronous source of truth for first paint (no flash).
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(storageKey, defaultTheme),
  )

  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(
    () => {
      if (typeof window === 'undefined') return 'light'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    },
  )

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (theme === 'system') return systemPreference
    return theme
  }, [theme, systemPreference])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // ── DB sync ────────────────────────────────────────────────────────────────
  // Reads the shared user-preferences record (only when signed in) and, if it
  // holds a theme, adopts it — so the choice follows the user across devices.
  // localStorage still wins first paint; the DB value is applied once it loads.
  const { data: preferences } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: () =>
      api.get<UserNotificationPreferences>(USER_PREFERENCES_ENDPOINTS.BASE),
    staleTime: 60_000,
    enabled: isAuthenticated,
  })

  // Update state + localStorage WITHOUT writing back to the server (used by the
  // DB-sync effect so adopting the stored value doesn't cause a PATCH loop).
  const applyThemeLocally = useCallback(
    (next: Theme) => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
    },
    [storageKey],
  )

  const storedTheme = preferences?.uiPreferences?.theme
  useEffect(() => {
    if (!storedTheme) return
    setThemeState((current) => {
      if (current === storedTheme) return current
      localStorage.setItem(storageKey, storedTheme)
      return storedTheme
    })
  }, [storedTheme, storageKey])

  const setTheme = useCallback(
    (newTheme: Theme) => {
      applyThemeLocally(newTheme)

      // Persist to the shared preferences record (silent — theme changes
      // shouldn't toast). Only when signed in; guests keep localStorage only.
      if (!isAuthenticated) return
      void api
        .patch<UserNotificationPreferences>(USER_PREFERENCES_ENDPOINTS.BASE, {
          uiPreferences: { theme: newTheme },
        })
        .then((updated) => {
          queryClient.setQueryData(PREFERENCES_QUERY_KEY, updated)
        })
        .catch(() => {
          // Non-critical: localStorage already holds the choice.
        })
    },
    [applyThemeLocally, isAuthenticated, queryClient],
  )

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
